"""
KGEC DPI Cyber Lab — Standalone Traffic Simulator & Mock Services
=================================================================
Zero-Docker, pure Python simulation engine for generating realistic
benign and brute-force attack traffic against local loopback targets.
"""

import socket
import select
import random
import threading
import time
import itertools
from collections import deque
from datetime import datetime
from typing import Dict, Any, List, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler

# Common wordlists for realistic credential spraying
USERNAMES = ["admin", "root", "labuser", "ftpuser", "guest", "test", "operator", "sysadmin"]
PASSWORDS = ["password123", "123456", "admin", "root", "pass", "letmein", "toor", "qwerty", "welcome"]

class MockHTTPHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler to simulate DVWA / web server traffic."""
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Server", "KGEC-DVWA-Mock/1.0")
        self.end_headers()
        body = b"<html><head><title>KGEC Lab Web Target</title></head><body><h1>DVWA Lab Portal</h1><p>Status: Healthy</p></body></html>"
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Suppress default console stderr noise
        pass


class MockLabServices:
    """
    Manages lightweight in-process TCP responders for FTP (2121), SSH (2222), and HTTP (8080).
    Allows running the Cyber Lab testbed with 100% zero Docker overhead.
    """
    def __init__(self, host: str = "127.0.0.1", ftp_port: int = 2121, ssh_port: int = 2222, http_port: int = 8080):
        self.host = host
        self.ftp_port = ftp_port
        self.ssh_port = ssh_port
        self.http_port = http_port

        self._stop_event = threading.Event()
        self._threads: List[threading.Thread] = []
        self._httpd: Optional[HTTPServer] = None
        self._is_active = False

    def is_port_in_use(self, port: int) -> bool:
        """Checks if a local port has an active listener."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((self.host, port)) == 0

    def start(self):
        """Starts mock services if ports are not already occupied by Docker."""
        if self._is_active:
            return
        self._stop_event.clear()
        self._is_active = True

        # FTP Mock (Port 2121)
        if not self.is_port_in_use(self.ftp_port):
            t_ftp = threading.Thread(target=self._run_ftp_server, daemon=True)
            self._threads.append(t_ftp)
            t_ftp.start()

        # SSH Mock (Port 2222)
        if not self.is_port_in_use(self.ssh_port):
            t_ssh = threading.Thread(target=self._run_ssh_server, daemon=True)
            self._threads.append(t_ssh)
            t_ssh.start()

        # HTTP Mock (Port 8080)
        if not self.is_port_in_use(self.http_port):
            try:
                self._httpd = HTTPServer((self.host, self.http_port), MockHTTPHandler)
                t_http = threading.Thread(target=self._httpd.serve_forever, daemon=True)
                self._threads.append(t_http)
                t_http.start()
            except Exception:
                pass

        time.sleep(0.05)

    def stop(self):
        """Stops all running mock listeners."""
        self._stop_event.set()
        if self._httpd:
            try:
                self._httpd.shutdown()
                self._httpd.server_close()
            except Exception:
                pass
        self._is_active = False

    def _run_ftp_server(self):
        """Pure Python FTP daemon responder."""
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server_sock.bind((self.host, self.ftp_port))
            server_sock.listen(10)
            server_sock.settimeout(1.0)
            while not self._stop_event.is_set():
                try:
                    conn, _ = server_sock.accept()
                    threading.Thread(target=self._handle_ftp_client, args=(conn,), daemon=True).start()
                except socket.timeout:
                    continue
                except Exception:
                    break
        finally:
            server_sock.close()

    def _handle_ftp_client(self, conn: socket.socket):
        try:
            conn.settimeout(3.0)
            conn.sendall(b"220 (vsFTPd 3.0.3 - KGEC Lab Standalone Ready)\r\n")
            while not self._stop_event.is_set():
                data = conn.recv(1024)
                if not data:
                    break
                line = data.decode(errors="ignore").strip()
                if line.upper().startswith("USER"):
                    conn.sendall(b"331 Please specify the password.\r\n")
                elif line.upper().startswith("PASS"):
                    conn.sendall(b"530 Login incorrect.\r\n")
                    break
                elif line.upper().startswith("QUIT"):
                    conn.sendall(b"221 Goodbye.\r\n")
                    break
                else:
                    conn.sendall(b"500 Unknown command.\r\n")
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _run_ssh_server(self):
        """Pure Python SSH handshake responder."""
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server_sock.bind((self.host, self.ssh_port))
            server_sock.listen(10)
            server_sock.settimeout(1.0)
            while not self._stop_event.is_set():
                try:
                    conn, _ = server_sock.accept()
                    threading.Thread(target=self._handle_ssh_client, args=(conn,), daemon=True).start()
                except socket.timeout:
                    continue
                except Exception:
                    break
        finally:
            server_sock.close()

    def _handle_ssh_client(self, conn: socket.socket):
        try:
            conn.settimeout(3.0)
            # Send OpenSSH server identification string
            conn.sendall(b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.4\r\n")
            client_id = conn.recv(1024)
            # Return realistic SSH disconnect packet with authentication failure
            conn.sendall(b"\x00\x00\x00\x1c\x07\x01\x00\x00\x00\x0bAuth failed\x00\x00\x00\x00en")
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _run_http_server(self):
        """Lightweight HTTP server for benign browsing simulation."""
        try:
            self._httpd = HTTPServer((self.host, self.http_port), MockHTTPHandler)
            self._httpd.serve_forever()
        except Exception:
            pass

    def get_status(self) -> Dict[str, Any]:
        """Probes connectivity on all lab ports."""
        ftp_online = self.is_port_in_use(self.ftp_port)
        ssh_online = self.is_port_in_use(self.ssh_port)
        http_online = self.is_port_in_use(self.http_port)

        return {
            "ftp": {
                "port": self.ftp_port,
                "online": ftp_online,
                "service": "vsftpd (FTP Server)",
                "type": "Standalone / Container" if ftp_online else "Offline"
            },
            "ssh": {
                "port": self.ssh_port,
                "online": ssh_online,
                "service": "OpenSSH (SSH Server)",
                "type": "Standalone / Container" if ssh_online else "Offline"
            },
            "http": {
                "port": self.http_port,
                "online": http_online,
                "service": "DVWA / Web App",
                "type": "Standalone / Container" if http_online else "Offline"
            }
        }


class TrafficSimulator:
    """
    Manages non-blocking controlled attack & benign traffic injection.
    Tracks statistics and maintains a live log buffer for the Web UI.
    """
    def __init__(self, services: MockLabServices):
        self.services = services
        self.is_running = False
        self.active_mode: Optional[str] = None
        self.start_time: Optional[float] = None
        self.duration_seconds: int = 30
        self.rate: str = "aggressive"  # "aggressive" | "stealth"

        self.stats = {
            "requests_sent": 0,
            "success": 0,
            "rejected": 0,
            "errors": 0
        }

        self.logs: deque = deque(maxlen=150)
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def log(self, level: str, message: str):
        now_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        entry = {
            "timestamp": now_str,
            "level": level,
            "message": message
        }
        with self._lock:
            self.logs.append(entry)

    def start(self, mode: str = "ssh", duration_seconds: int = 30, rate: str = "aggressive") -> Dict[str, Any]:
        with self._lock:
            if self.is_running:
                return {"status": "error", "message": "Simulation is already running."}

            # Ensure mock services are listening
            self.services.start()

            self.is_running = True
            self.active_mode = mode
            self.duration_seconds = duration_seconds
            self.rate = rate
            self.start_time = time.time()
            self._stop_event.clear()
            self.stats = {"requests_sent": 0, "success": 0, "rejected": 0, "errors": 0}
            self.logs.clear()

        self.log("INFO", f"Cyber Lab Simulation started — Mode: {mode.upper()} ({duration_seconds}s, {rate})")

        thread = threading.Thread(target=self._run_simulation_worker, daemon=True)
        self._worker_thread = thread
        thread.start()

        return {
            "status": "started",
            "mode": mode,
            "duration": duration_seconds,
            "rate": rate
        }

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            if not self.is_running:
                return {"status": "idle", "message": "No simulation active."}
            self._stop_event.set()
            self.is_running = False

        self.log("INFO", "Simulation stopped by operator.")
        return {"status": "stopped", "stats": self.stats}

    def _run_simulation_worker(self):
        mode = self.active_mode
        deadline = time.time() + self.duration_seconds

        try:
            if mode == "ssh":
                self._run_ssh_bruteforce(deadline)
            elif mode == "ftp":
                self._run_ftp_bruteforce(deadline)
            elif mode == "benign":
                self._run_benign_traffic(deadline)
            elif mode == "mixed":
                self._run_mixed_traffic(deadline)
            else:
                self._run_ssh_bruteforce(deadline)
        except Exception as e:
            self.log("ERROR", f"Simulation worker exception: {e}")
        finally:
            with self._lock:
                self.is_running = False
            self.log("INFO", f"Simulation completed — Sent: {self.stats['requests_sent']} | Rejections: {self.stats['rejected']}")

    def _run_ssh_bruteforce(self, deadline: float):
        pairs = list(itertools.product(USERNAMES, PASSWORDS))
        random.shuffle(pairs)
        idx = 0

        delay = 0.05 if self.rate == "aggressive" else 0.4

        while not self._stop_event.is_set() and time.time() < deadline:
            user, pwd = pairs[idx % len(pairs)]
            idx += 1

            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(1.5)
                    s.connect((self.services.host, self.services.ssh_port))
                    _ = s.recv(512) # Read server banner
                    s.sendall(b"SSH-2.0-KGEC_Simulated_Spray_Tool\r\n")
                    _ = s.recv(512) # Read disconnect / rejection
                
                with self._lock:
                    self.stats["requests_sent"] += 1
                    self.stats["rejected"] += 1

                self.log("SSH-BRUTE", f"Attempt: {user}:{pwd} → ✗ REJECT (Auth Failed)")
            except Exception as e:
                with self._lock:
                    self.stats["errors"] += 1
                self.log("WARN", f"Connection error: {e}")

            time.sleep(random.uniform(delay * 0.8, delay * 1.2))

    def _run_ftp_bruteforce(self, deadline: float):
        pairs = list(itertools.product(USERNAMES, PASSWORDS))
        random.shuffle(pairs)
        idx = 0

        delay = 0.06 if self.rate == "aggressive" else 0.5

        while not self._stop_event.is_set() and time.time() < deadline:
            user, pwd = pairs[idx % len(pairs)]
            idx += 1

            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(1.5)
                    s.connect((self.services.host, self.services.ftp_port))
                    _ = s.recv(512) # Read 220 banner
                    s.sendall(f"USER {user}\r\n".encode())
                    _ = s.recv(512)
                    s.sendall(f"PASS {pwd}\r\n".encode())
                    resp = s.recv(512).decode(errors="ignore")

                with self._lock:
                    self.stats["requests_sent"] += 1
                    self.stats["rejected"] += 1

                self.log("FTP-BRUTE", f"USER {user} | PASS {pwd} → ✗ 530 Login Incorrect")
            except Exception as e:
                with self._lock:
                    self.stats["errors"] += 1
                self.log("WARN", f"FTP connection error: {e}")

            time.sleep(random.uniform(delay * 0.8, delay * 1.2))

    def _run_benign_traffic(self, deadline: float):
        paths = ["/", "/login.php", "/dvwa/index.php", "/about", "/dashboard"]
        while not self._stop_event.is_set() and time.time() < deadline:
            path = random.choice(paths)
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(2.0)
                    s.connect((self.services.host, self.services.http_port))
                    req = f"GET {path} HTTP/1.1\r\nHost: {self.services.host}:{self.services.http_port}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n\r\n"
                    s.sendall(req.encode())
                    _ = s.recv(1024)

                with self._lock:
                    self.stats["requests_sent"] += 1
                    self.stats["success"] += 1

                self.log("BENIGN", f"GET {path} → 200 OK (Interactive Browsing)")
            except Exception as e:
                with self._lock:
                    self.stats["errors"] += 1
                self.log("WARN", f"HTTP error: {e}")

            # Natural human typing / navigation delay
            time.sleep(random.uniform(0.6, 1.8))

    def _run_mixed_traffic(self, deadline: float):
        """Interleaves benign HTTP browsing with periodic bursts of SSH/FTP credential attempts."""
        self.log("INFO", "Running mixed traffic simulation: interleaving Benign + Brute-force bursts.")
        while not self._stop_event.is_set() and time.time() < deadline:
            choice = random.choice(["benign", "ssh", "ftp"])
            if choice == "benign":
                self._run_benign_traffic(time.time() + random.uniform(2.0, 4.0))
            elif choice == "ssh":
                self._run_ssh_bruteforce(time.time() + random.uniform(2.0, 4.0))
            else:
                self._run_ftp_bruteforce(time.time() + random.uniform(2.0, 4.0))
            time.sleep(0.5)

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            elapsed = round(time.time() - self.start_time, 1) if (self.is_running and self.start_time) else 0.0
            remaining = max(0.0, round(self.duration_seconds - elapsed, 1)) if self.is_running else 0.0
            return {
                "is_running": self.is_running,
                "mode": self.active_mode,
                "rate": self.rate,
                "duration_seconds": self.duration_seconds,
                "elapsed_seconds": elapsed,
                "remaining_seconds": remaining,
                "stats": dict(self.stats),
                "logs": list(self.logs),
                "targets": self.services.get_status()
            }


# Global singleton instances for API integration
mock_services = MockLabServices()
lab_simulator = TrafficSimulator(mock_services)

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="KGEC Cyber Lab — Standalone Attack & Traffic Simulator")
    parser.add_argument("--mode", choices=["ssh", "ftp", "benign", "mixed"], default="mixed",
                        help="Simulation mode: ssh, ftp, benign, mixed (default: mixed)")
    parser.add_argument("--duration", type=int, default=30, help="Duration in seconds (default: 30)")
    parser.add_argument("--rate", choices=["stealth", "normal", "aggressive"], default="aggressive",
                        help="Traffic injection velocity (default: aggressive)")
    args = parser.parse_args()

    print("\n=======================================================")
    print("   KGEC Cyber Lab — Standalone Traffic Simulator CLI")
    print("=======================================================")
    print(f"[*] Booting mock socket services on loopback (127.0.0.1)...")
    mock_services.start()

    status = mock_services.get_status()
    for key, svc in status.items():
        state = "ONLINE" if svc["online"] else "OFFLINE"
        print(f"  - [{state}] {svc['service']} on port {svc['port']}")

    print(f"\n[*] Starting simulation:")
    print(f"    Mode:     {args.mode.upper()}")
    print(f"    Duration: {args.duration}s")
    print(f"    Rate:     {args.rate}")
    print("=======================================================\n")

    lab_simulator.start(mode=args.mode, duration_seconds=args.duration, rate=args.rate)

    try:
        last_log_count = 0
        while lab_simulator.is_running:
            cur_status = lab_simulator.get_status()
            logs = cur_status["logs"]
            if len(logs) > last_log_count:
                for entry in logs[last_log_count:]:
                    tag = entry["level"]
                    msg = entry["message"]
                    ts = entry["timestamp"]
                    print(f"[{ts}] [{tag:<6}] {msg}")
                last_log_count = len(logs)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\n[!] Simulation interrupted by user.")
        lab_simulator.stop()

    final_status = lab_simulator.get_status()
    stats = final_status["stats"]
    print("\n=======================================================")
    print("   Simulation Complete — Summary")
    print("=======================================================")
    print(f"  Total Requests / Packets Sent : {stats.get('requests_sent', 0)}")
    print(f"  Authentication Rejections     : {stats.get('rejected', 0)}")
    print(f"  Successful Connections        : {stats.get('success', 0)}")
    print(f"  Errors                        : {stats.get('errors', 0)}")
    print("=======================================================\n")
