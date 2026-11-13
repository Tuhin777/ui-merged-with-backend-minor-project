import os
import sys
import time
import json
import socket
import asyncio
import tempfile
import threading
import subprocess
from collections import deque
from pathlib import Path
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

# Ensure dpi root is in sys.path
DPI_DIR = Path(__file__).resolve().parent
if str(DPI_DIR) not in sys.path:
    sys.path.insert(0, str(DPI_DIR))

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from capture.packet_capture import PacketCapture, find_tshark_path
from feature.feature_extractor import FeatureExtractor
from flow.flow_manager import FlowManager
from model.predict import engine, model, features
from lab.simulator_engine import mock_services, lab_simulator
from utils.logger import logger as log

logger = log()

app = FastAPI(
    title="DPI ML Network Intelligence API",
    description="Real-time Deep Packet Inspection and ML Flow Classification Server",
    version="1.0.0"
)

# Enable CORS for Next.js web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Asynchronous DNS & Reverse Lookup Engine
# ============================================================================
class DNSResolver:
    """
    Non-blocking reverse DNS resolver with passive learning and in-memory LRU cache.
    Resolves source and destination IP addresses into human-readable site/host names.
    Ensures network capture and packet classification are NEVER blocked by slow queries.
    """
    def __init__(self, max_workers: int = 4):
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="dns_resolver")
        self._pending = set()
        self._cache: Dict[str, str] = {
            "127.0.0.1": "localhost (loopback)",
            "::1": "localhost (IPv6 loopback)",
            "0.0.0.0": "all-interfaces",
            # Common public DNS servers
            "8.8.8.8": "dns.google",
            "8.8.4.4": "dns.google",
            "1.1.1.1": "one.one.one.one (Cloudflare)",
            "1.0.0.1": "one.one.one.one (Cloudflare)",
            "9.9.9.9": "dns.quad9.net",
        }

    def get_hostname(self, ip: Optional[str]) -> Optional[str]:
        """Returns the cached hostname or queues a background non-blocking lookup."""
        if not ip or ip == "0.0.0.0" or ip == "None":
            return None

        with self._lock:
            if ip in self._cache:
                return self._cache[ip]
            if ip in self._pending:
                return None
            self._pending.add(ip)

        # Queue lookup in background thread so packet ingestion is NEVER delayed
        self._executor.submit(self._do_lookup, ip)
        return None

    def _do_lookup(self, ip: str):
        try:
            # Special case: Docker bridge lab subnet (172.30.0.x)
            if ip.startswith("172.30.0."):
                octet = ip.split(".")[-1]
                lab_names = {
                    "10": "kgec-vuln-ftp.lab",
                    "11": "kgec-vuln-ssh.lab",
                    "12": "kgec-dvwa.lab",
                    "13": "kgec-dvwa-db.lab",
                    "20": "kgec-vuln-host.lab",
                }
                name = lab_names.get(octet, f"docker-host-{octet}.lab")
            elif ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172.16."):
                # Private LAN - try socket reverse DNS with quick timeout
                socket.setdefaulttimeout(1.0)
                host_info = socket.gethostbyaddr(ip)
                name = host_info[0] if host_info else ip
            else:
                # Public IP reverse DNS
                socket.setdefaulttimeout(1.2)
                host_info = socket.gethostbyaddr(ip)
                name = host_info[0] if host_info else ip
        except Exception:
            name = ip  # Fallback to IP if PTR doesn't exist

        with self._lock:
            self._cache[ip] = name
            self._pending.discard(ip)

    def learn_dns_mapping(self, ip: str, hostname: str):
        """Passively associates an IP address with a domain observed from DNS traffic."""
        if not ip or not hostname:
            return
        clean_name = hostname.rstrip(".")
        with self._lock:
            self._cache[ip] = clean_name


dns_resolver = DNSResolver()


# ============================================================================
# Session & State Manager
# ============================================================================
class DPISession:
    def __init__(self):
        self.lock = threading.Lock()
        self.is_capturing: bool = False
        self.capture_thread: Optional[threading.Thread] = None
        self.capturer: Optional[PacketCapture] = None
        self.active_interface: Optional[str] = None
        self.bpf_filter: str = "ip or ip6"
        self.start_time: Optional[float] = None
        self.duration_seconds: Optional[int] = None
        self.timer: Optional[threading.Timer] = None

        self.feature_extractor = FeatureExtractor()
        self.flow_manager = FlowManager()

        # Ring buffers for UI
        self.recent_packets = deque(maxlen=300)
        self.flow_store: Dict[str, Dict[str, Any]] = {}
        self.threat_counts: Dict[str, int] = {
            "Benign": 0,
            "FTP-BruteForce": 0,
            "SSH-Bruteforce": 0,
            "Other": 0
        }
        self.total_packets_count: int = 0
        self.total_bytes_count: int = 0
        self.history_metrics = deque(maxlen=60) # 60 seconds rolling metrics

    def reset(self):
        with self.lock:
            if self.timer:
                self.timer.cancel()
                self.timer = None
            if self.is_capturing and self.capturer:
                self.capturer.stop()
                self.is_capturing = False

            self.feature_extractor = FeatureExtractor()
            self.flow_manager = FlowManager()
            self.recent_packets.clear()
            self.flow_store.clear()
            self.threat_counts = {
                "Benign": 0,
                "FTP-BruteForce": 0,
                "SSH-Bruteforce": 0,
                "Other": 0
            }
            self.total_packets_count = 0
            self.total_bytes_count = 0
            self.start_time = None
            self.duration_seconds = None
            self.active_interface = None
            self.history_metrics.clear()

    def process_incoming_packet(self, packet_features: dict) -> dict:
        """Processes a packet through flow aggregation and ML prediction."""
        with self.lock:
            self.total_packets_count += 1
            pkt_len = int(packet_features.get("packet_length", 0) or packet_features.get("ip_length", 0))
            self.total_bytes_count += pkt_len

            src_ip = packet_features.get("src_ip", "")
            dst_ip = packet_features.get("dst_ip", "")
            dns_q = packet_features.get("dns_query")

            if dns_q:
                dns_resolver.learn_dns_mapping(dst_ip, dns_q)

            src_host = dns_resolver.get_hostname(src_ip)
            dst_host = dns_resolver.get_hostname(dst_ip)

            # Add to raw packets list (serializable copy)
            packet_record = {
                "id": self.total_packets_count,
                "timestamp": packet_features.get("timestamp", 0.0),
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_host": src_host,
                "dst_host": dst_host,
                "dns_query": dns_q,
                "src_port": packet_features.get("src_port", 0),
                "dst_port": packet_features.get("dst_port", 0),
                "protocol": packet_features.get("protocol", 0),
                "transport_protocol": packet_features.get("transport_protocol", "OTHER"),
                "length": pkt_len,
                "ttl": packet_features.get("ttl", 0),
                "window_size": packet_features.get("window_size", 0),
                "tcp_flags": {
                    "syn": packet_features.get("tcp_syn", 0),
                    "ack": packet_features.get("tcp_ack", 0),
                    "fin": packet_features.get("tcp_fin", 0),
                    "rst": packet_features.get("tcp_rst", 0),
                    "psh": packet_features.get("tcp_psh", 0)
                },
                "entropy": packet_features.get("payload_entropy", 0.0),
                "iat": packet_features.get("iat", 0.0)
            }
            self.recent_packets.append(packet_record)

            # Flow aggregation
            flow = self.flow_manager.process_packet(packet_features)
            bkey_str = str(flow.bidirectional_key)
            pkt_count = flow.total_packets

            cached = self.flow_store.get(bkey_str)
            # Adaptive ML evaluation schedule: evaluate early packets (1, 2, 3, 5, 10, 20, 50, 100, 250, 500, 1000),
            # periodic checkpoints every 500 packets, or immediately on FIN/RST control flags.
            should_predict = (
                cached is None
                or pkt_count in (1, 2, 3, 5, 10, 20, 50, 100, 250, 500, 1000)
                or (pkt_count % 500 == 0)
                or bool(packet_features.get("tcp_rst"))
                or bool(packet_features.get("tcp_fin"))
            )

            if should_predict or cached is None:
                prediction_result = engine.predict_flow(flow)
                pred_label = prediction_result.get("prediction", "Unknown")

                # Update threat counts on newly classified or existing flows
                old_label = cached.get("prediction") if cached else None
                if old_label != pred_label:
                    if old_label and old_label in self.threat_counts and self.threat_counts[old_label] > 0:
                        self.threat_counts[old_label] -= 1
                    if pred_label in self.threat_counts:
                        self.threat_counts[pred_label] += 1
                    else:
                        self.threat_counts["Other"] += 1

                # Extract 25 statistical features for deep inspection
                flow_features_25 = engine.extract_flow_features(flow)

                flow_src_ip = str(flow.forward_key[0])
                flow_dst_ip = str(flow.forward_key[1])
                flow_src_host = dns_resolver.get_hostname(flow_src_ip)
                flow_dst_host = dns_resolver.get_hostname(flow_dst_ip)

                flow_summary = {
                    "key": bkey_str,
                    "forward_key": str(flow.forward_key),
                    "src_endpoint": f"{flow_src_ip}:{flow.forward_key[2]}",
                    "dst_endpoint": f"{flow_dst_ip}:{flow.forward_key[3]}",
                    "src_ip": flow_src_ip,
                    "dst_ip": flow_dst_ip,
                    "src_host": flow_src_host,
                    "dst_host": flow_dst_host,
                    "dns_name": dns_q or flow_src_host,
                    "transport_protocol": flow.transport_protocol,
                    "protocol": flow.protocol,
                    "total_packets": flow.total_packets,
                    "fwd_packets": getattr(flow, "fwd_packets_count", len(flow.fwd_lengths)),
                    "bwd_packets": getattr(flow, "bwd_packets_count", len(flow.bwd_lengths)),
                    "total_bytes": flow.total_bytes,
                    "fwd_bytes": flow.fwd_bytes,
                    "bwd_bytes": flow.bwd_bytes,
                    "duration": flow.duration,
                    "last_seen": flow.last_time,
                    "prediction": pred_label,
                    "confidence": round(float(prediction_result.get("confidence", 0.0)), 4),
                    "probabilities": prediction_result.get("probabilities", {}),
                    "features_25": flow_features_25
                }
                self.flow_store[bkey_str] = flow_summary
            else:
                # Fast in-place counter update without running redundant ML inferences
                cached["total_packets"] = flow.total_packets
                cached["fwd_packets"] = getattr(flow, "fwd_packets_count", len(flow.fwd_lengths))
                cached["bwd_packets"] = getattr(flow, "bwd_packets_count", len(flow.bwd_lengths))
                cached["total_bytes"] = flow.total_bytes
                cached["fwd_bytes"] = flow.fwd_bytes
                cached["bwd_bytes"] = flow.bwd_bytes
                cached["duration"] = flow.duration
                cached["last_seen"] = flow.last_time
                if dns_q and not cached.get("dns_name"):
                    cached["dns_name"] = dns_q
                flow_summary = cached

            return {
                "packet": packet_record,
                "flow": flow_summary
            }


session = DPISession()


# ============================================================================
# WebSocket Connection Hub
# ============================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dc in dead_connections:
            self.disconnect(dc)


ws_manager = ConnectionManager()
loop_holder = {"loop": None}


def broadcast_sync(message: dict):
    """Safely dispatches WebSocket updates from background threads."""
    loop = loop_holder.get("loop")
    if loop and loop.is_running() and ws_manager.active_connections:
        asyncio.run_coroutine_threadsafe(ws_manager.broadcast(message), loop)


@app.on_event("startup")
async def startup_event():
    loop_holder["loop"] = asyncio.get_running_loop()


# ============================================================================
# API Models
# ============================================================================
class StartCaptureRequest(BaseModel):
    interface: str = "Wi-Fi"
    bpf_filter: str = "ip or ip6"
    packet_count: Optional[int] = None
    duration_seconds: Optional[int] = None


class ManualPredictRequest(BaseModel):
    features: Dict[str, float]


class StartLabRequest(BaseModel):
    mode: str = "ssh"  # ssh | ftp | benign | mixed
    duration_seconds: int = 30
    rate: str = "aggressive"  # aggressive | stealth


# ============================================================================
# REST Endpoints
# ============================================================================
@app.get("/api/status")
def get_status():
    """Returns general system status, telemetry, and health metrics."""
    uptime = 0.0
    if session.start_time:
        uptime = round(time.time() - session.start_time, 2)

    remaining = None
    if session.is_capturing and session.duration_seconds and session.start_time:
        elapsed = time.time() - session.start_time
        remaining = max(0.0, round(session.duration_seconds - elapsed, 1))

    return {
        "status": "capturing" if session.is_capturing else "idle",
        "active_interface": session.active_interface,
        "bpf_filter": session.bpf_filter,
        "uptime": uptime,
        "duration_seconds": session.duration_seconds,
        "remaining_seconds": remaining,
        "total_packets": session.total_packets_count,
        "total_bytes": session.total_bytes_count,
        "active_flows": len(session.flow_store),
        "threat_counts": session.threat_counts,
        "model_loaded": engine.is_loaded,
        "model_path": str(engine.model_path) if engine.model_path else None
    }


@app.get("/api/interfaces")
def get_interfaces():
    """Enumerates available system network interfaces using tshark."""
    tshark = find_tshark_path()
    interfaces = []
    if tshark and os.path.exists(tshark):
        try:
            res = subprocess.run([tshark, "-D"], capture_output=True, text=True, check=True)
            for line in res.stdout.strip().splitlines():
                line = line.strip()
                if line:
                    # Format: 1. \Device\NPF_... (Friendly Name)
                    parts = line.split(". ", 1)
                    if len(parts) == 2:
                        idx = parts[0]
                        desc = parts[1]
                        name = desc
                        if "(" in desc and desc.endswith(")"):
                            name = desc.split("(")[-1][:-1]
                        interfaces.append({
                            "id": idx,
                            "raw": desc,
                            "name": name
                        })
        except Exception as e:
            logger.warning(f"Failed to query tshark interfaces: {e}")

    if not interfaces:
        interfaces = [
            {"id": "1", "raw": "Wi-Fi", "name": "Wi-Fi"},
            {"id": "2", "raw": "Ethernet", "name": "Ethernet"},
            {"id": "3", "raw": "Loopback", "name": "Loopback"}
        ]
    return interfaces


@app.post("/api/capture/start")
def start_capture(req: StartCaptureRequest):
    """Starts live packet capture on the specified interface."""
    if session.is_capturing:
        raise HTTPException(status_code=400, detail="Capture is already running.")

    session.is_capturing = True
    session.active_interface = req.interface
    session.bpf_filter = req.bpf_filter
    session.start_time = time.time()
    session.duration_seconds = req.duration_seconds if (req.duration_seconds and req.duration_seconds > 0) else None
    session.capturer = PacketCapture()

    if session.duration_seconds:
        def auto_stop():
            logger.info(f"Capture duration limit ({session.duration_seconds}s) reached. Stopping capture.")
            if session.capturer:
                session.capturer.stop()

        timer = threading.Timer(session.duration_seconds, auto_stop)
        session.timer = timer
        timer.daemon = True
        timer.start()

        def ticker():
            while session.is_capturing and session.start_time and session.duration_seconds:
                elapsed = time.time() - session.start_time
                rem = max(0.0, round(session.duration_seconds - elapsed, 1))
                broadcast_sync({
                    "type": "timer_tick",
                    "remaining_seconds": rem,
                    "duration_seconds": session.duration_seconds
                })
                if rem <= 0:
                    break
                time.sleep(1.0)

        ticker_thread = threading.Thread(target=ticker, daemon=True)
        ticker_thread.start()

    def capture_worker():
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        logger.info(f"Capture worker thread started on interface {req.interface} (duration: {session.duration_seconds}s)")
        
        last_broadcast = [0.0]
        window_packets = [0]
        window_bytes = [0]
        window_start = [time.time()]
        current_rates = {"packet_rate": 0.0, "byte_rate": 0.0}

        try:
            def per_packet(features_dict):
                res = session.process_incoming_packet(features_dict)
                now = time.time()
                window_packets[0] += 1
                window_bytes[0] += res["packet"].get("length", 0)

                # Compute rolling 1-second rates
                elapsed_window = now - window_start[0]
                if elapsed_window >= 1.0:
                    current_rates["packet_rate"] = round(window_packets[0] / elapsed_window, 1)
                    current_rates["byte_rate"] = round(window_bytes[0] / elapsed_window, 1)
                    window_packets[0] = 0
                    window_bytes[0] = 0
                    window_start[0] = now

                # Broadcast immediately for threats; throttle normal packets to ~25 Hz (every 40ms)
                # to prevent saturating browser UI thread and asyncio queues.
                is_threat = res["flow"]["prediction"] != "Benign"
                time_since_broadcast = now - last_broadcast[0]

                if is_threat or time_since_broadcast >= 0.04:
                    last_broadcast[0] = now
                    rem = None
                    if session.duration_seconds and session.start_time:
                        rem = max(0.0, round(session.duration_seconds - (now - session.start_time), 1))

                    broadcast_sync({
                        "type": "packet",
                        "data": res["packet"],
                        "flow": {
                            "key": res["flow"]["key"],
                            "src": res["flow"]["src_endpoint"],
                            "dst": res["flow"]["dst_endpoint"],
                            "prediction": res["flow"]["prediction"],
                            "confidence": res["flow"]["confidence"],
                            "total_packets": res["flow"]["total_packets"],
                            "total_bytes": res["flow"]["total_bytes"]
                        },
                        "stats": {
                            "total_packets": session.total_packets_count,
                            "total_bytes": session.total_bytes_count,
                            "active_flows": len(session.flow_store),
                            "threat_counts": session.threat_counts,
                            "packet_rate": current_rates["packet_rate"],
                            "byte_rate": current_rates["byte_rate"],
                            "duration_seconds": session.duration_seconds,
                            "remaining_seconds": rem
                        }
                    })

            session.capturer.capture_live(
                interface=req.interface,
                packet_count=req.packet_count,
                bpf_filter=req.bpf_filter,
                callback=per_packet,
                feature_extractor=session.feature_extractor
            )
        except Exception as e:
            logger.error(f"Live capture error in thread: {e}")
        finally:
            if session.timer:
                session.timer.cancel()
                session.timer = None
            session.is_capturing = False
            session.duration_seconds = None
            broadcast_sync({"type": "capture_stopped"})
            logger.info("Capture worker thread finished.")
            try:
                new_loop.close()
            except Exception:
                pass

    thread = threading.Thread(target=capture_worker, daemon=True)
    session.capture_thread = thread
    thread.start()

    return {
        "status": "started", 
        "interface": req.interface, 
        "bpf_filter": req.bpf_filter,
        "duration_seconds": session.duration_seconds
    }


@app.post("/api/capture/stop")
def stop_capture():
    """Signals the active capture worker to stop."""
    if not session.is_capturing:
        return {"status": "idle", "message": "No capture was running."}

    if session.timer:
        session.timer.cancel()
        session.timer = None
    session.duration_seconds = None

    if session.capturer:
        session.capturer.stop()
    session.is_capturing = False
    return {"status": "stopping"}


@app.post("/api/capture/upload-pcap")
async def upload_pcap(file: UploadFile = File(...)):
    """Uploads an offline PCAP/PCAPNG file and analyzes all packets with the DPI engine."""
    if not file.filename.endswith((".pcap", ".pcapng", ".cap")):
        raise HTTPException(status_code=400, detail="Only .pcap, .pcapng, and .cap files are supported.")

    session.reset()
    session.start_time = time.time()
    session.active_interface = f"File: {file.filename}"

    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    capturer = PacketCapture()
    processed_count = 0

    def on_pcap_packet(features_dict):
        session.process_incoming_packet(features_dict)

    def run_pcap_thread():
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            return capturer.capture_pcap(
                pcap_file=tmp_path,
                callback=on_pcap_packet,
                feature_extractor=session.feature_extractor
            )
        finally:
            try:
                new_loop.close()
            except Exception:
                pass

    try:
        processed_count = await asyncio.to_thread(run_pcap_thread)
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    return {
        "status": "success",
        "filename": file.filename,
        "packets_processed": processed_count,
        "flows_identified": len(session.flow_store),
        "threat_counts": session.threat_counts
    }


@app.post("/api/session/reset")
def reset_session():
    """Clears all session statistics, buffers, and flows."""
    session.reset()
    return {"status": "reset", "message": "Session reset successfully."}


@app.get("/api/flows")
def get_flows(label: Optional[str] = None, search: Optional[str] = None):
    """Returns all tracked flows with classification, stats, and filters."""
    with session.lock:
        flow_list = list(session.flow_store.values())

    if label:
        flow_list = [f for f in flow_list if f["prediction"].lower() == label.lower()]

    if search:
        s = search.lower()
        flow_list = [
            f for f in flow_list
            if s in f["key"].lower() or s in f["src_endpoint"].lower() or s in f["dst_endpoint"].lower() or s in f["transport_protocol"].lower()
        ]

    # Sort by total packets descending
    flow_list.sort(key=lambda x: x["total_packets"], reverse=True)
    return {
        "total_flows": len(flow_list),
        "flows": flow_list
    }


@app.get("/api/flows/{flow_key}")
def get_flow_detail(flow_key: str):
    """Returns deep feature statistics, probabilities, and XAI reasoning for a specific flow."""
    with session.lock:
        flow = session.flow_store.get(flow_key)

        if not flow:
            # Search by partial key or endpoint
            for k, v in session.flow_store.items():
                if flow_key in k or flow_key in v["src_endpoint"] or flow_key in v["dst_endpoint"]:
                    flow = v
                    break

        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found.")

        # Refresh 25 statistical features and XAI root cause reasoning on demand
        try:
            active_obj = None
            for k, obj in session.flow_manager.flows.items():
                if str(k) == flow.get("key") or str(obj.bidirectional_key) == flow.get("key"):
                    active_obj = obj
                    break

            target = active_obj if active_obj else flow.get("features_25", flow)
            flow["features_25"] = engine.extract_flow_features(target)
            flow["xai_explanation"] = engine.explain_flow(target)
        except Exception as e:
            logger.warning(f"Failed to generate flow features/XAI: {e}")

    return flow


@app.get("/api/flows/{flow_key}/explain")
def get_flow_explanation(flow_key: str):
    """Returns dedicated Explainable AI (XAI) root cause diagnostics for a flow."""
    flow = get_flow_detail(flow_key)
    return flow.get("xai_explanation") or engine.explain_flow(flow)


@app.get("/api/packets")
def get_packets(limit: int = 100):
    """Returns the most recently captured raw packets with extracted features."""
    with session.lock:
        pkts = list(session.recent_packets)[-limit:]
    pkts.reverse()
    return {
        "count": len(pkts),
        "packets": pkts
    }


@app.get("/api/model/info")
def get_model_info():
    """Returns ML model metadata, classes, and expected features."""
    classes = list(getattr(model, "classes_", []))
    return {
        "model_type": type(model).__name__,
        "classes": [str(c) for c in classes],
        "feature_count": len(features) if features else 0,
        "features": list(features) if features else [],
        "model_path": str(engine.model_path) if engine.model_path else ""
    }


@app.post("/api/model/predict")
def predict_custom(req: ManualPredictRequest):
    """Accepts arbitrary flow features and returns ML prediction with probabilities."""
    result = engine.predict_flow(req.features)
    return result


@app.get("/api/model/importance")
def get_feature_importance():
    """Returns feature importance rankings parsed from feature_importance_DT.csv."""
    csv_path = DPI_DIR / "model" / "saved" / "DT" / "feature_importance_DT.csv"
    items = []
    if csv_path.exists():
        import csv
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                feat = row.get("Feature", "")
                if feat and "Unnamed" not in feat:
                    try:
                        val = float(row.get("Importance", 0.0))
                        items.append({"feature": feat, "importance": val})
                    except ValueError:
                        pass
        items.sort(key=lambda x: x["importance"], reverse=True)
    return {
        "count": len(items),
        "rankings": items
    }


# ============================================================================
# Session Forensics & External Dataset Benchmark
# ============================================================================
def run_dataset_evaluation(df: Any, source_name: str = "Uploaded Dataset") -> dict:
    """Helper to evaluate any pandas dataframe using the Decision Tree model."""
    import pandas as pd
    import numpy as np
    from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

    # Normalize column names: strip spaces
    df.columns = [str(c).strip() for c in df.columns]

    # Check for Ground Truth label
    label_col = None
    for cand in ["Label", "label", "Class", "class", "threat", "Threat"]:
        if cand in df.columns:
            label_col = cand
            break

    # Ensure all required features are present
    for f in engine.feature_names:
        if f not in df.columns:
            df[f] = 0.0

    # Ensure Unnamed: 0 is present and valid
    if "Unnamed: 0" in engine.feature_names:
        df["Unnamed: 0"] = 0.0

    # Prepare input matrix
    X = df[engine.feature_names].fillna(0.0)

    # Predict
    preds = engine.model.predict(X)
    probs = None
    if hasattr(engine.model, "predict_proba"):
        probs = engine.model.predict_proba(X)

    total_samples = len(df)
    class_dist = {}
    for p in preds:
        p_str = str(p)
        class_dist[p_str] = class_dist.get(p_str, 0) + 1

    result = {
        "source": source_name,
        "total_samples": total_samples,
        "class_distribution": class_dist,
        "threat_count": sum(c for k, c in class_dist.items() if k != "Benign"),
        "has_ground_truth": False,
        "accuracy": None,
        "precision": None,
        "recall": None,
        "f1_score": None,
        "confusion_matrix": None,
        "samples": []
    }

    if label_col:
        # Standardize ground truth
        actuals = df[label_col].astype(str).str.strip()
        # Normalization for common datasets (e.g. BENIGN -> Benign)
        actuals = actuals.replace({
            "BENIGN": "Benign",
            "benign": "Benign",
            "FTP-Patator": "FTP-BruteForce",
            "SSH-Patator": "SSH-Bruteforce"
        })

        acc = float(accuracy_score(actuals, preds))
        all_classes = sorted(list(set(actuals) | set(preds)))
        cm = confusion_matrix(actuals, preds, labels=all_classes)
        
        p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(actuals, preds, average="macro", zero_division=0)

        result.update({
            "has_ground_truth": True,
            "accuracy": round(acc * 100, 2),
            "precision": round(float(p_macro) * 100, 2),
            "recall": round(float(r_macro) * 100, 2),
            "f1_score": round(float(f1_macro) * 100, 2),
            "confusion_matrix": {
                "classes": all_classes,
                "matrix": cm.tolist()
            }
        })

    # Sample rows (up to 25)
    sample_list = []
    for idx in range(min(25, total_samples)):
        row_actual = str(df[label_col].iloc[idx]) if label_col else None
        pred_label = str(preds[idx])
        conf = 1.0
        if probs is not None:
            conf = float(np.max(probs[idx]))

        sample_list.append({
            "id": idx + 1,
            "actual": row_actual,
            "prediction": pred_label,
            "confidence": round(conf, 4),
            "is_correct": (row_actual == pred_label) if row_actual else None,
            "protocol": int(df.get("Protocol", pd.Series([6])).iloc[idx]),
            "duration": round(float(df.get("Flow Duration", pd.Series([0])).iloc[idx]), 1),
            "fwd_packets": int(df.get("Total Fwd Packets", pd.Series([0])).iloc[idx]),
            "bwd_packets": int(df.get("Total Backward Packets", pd.Series([0])).iloc[idx]),
            "init_bwd_win": float(df.get("Init Bwd Win Bytes", pd.Series([0])).iloc[idx]),
        })
    result["samples"] = sample_list

    return result


@app.get("/api/session/report")
def get_session_report():
    """Generates an executive post-capture security forensics report."""
    with session.lock:
        uptime = round(time.time() - session.start_time, 2) if session.start_time else 0.0
        total_packets = session.total_packets_count
        total_bytes = session.total_bytes_count
        flows = list(session.flow_store.values())
        packets = list(session.recent_packets)
        threat_counts = dict(session.threat_counts)
        active_iface = session.active_interface
        bpf = session.bpf_filter

    ftp_threats = threat_counts.get("FTP-BruteForce", 0)
    ssh_threats = threat_counts.get("SSH-Bruteforce", 0)
    other_threats = threat_counts.get("Other", 0)
    total_threats = ftp_threats + ssh_threats + other_threats
    benign_count = threat_counts.get("Benign", 0)
    total_classified = total_threats + benign_count

    if total_threats == 0:
        verdict = "BENIGN"
        verdict_headline = "Perimeter Secure — No Active Threats Flagged"
        verdict_summary = "All evaluated bidirectional flows conform to normal benign operational traffic."
    elif ftp_threats > 0 or ssh_threats > 0:
        verdict = "CRITICAL"
        threat_names = []
        if ftp_threats > 0: threat_names.append(f"{ftp_threats} FTP Brute-Force")
        if ssh_threats > 0: threat_names.append(f"{ssh_threats} SSH Brute-Force")
        verdict_headline = f"Security Alert — {', '.join(threat_names)} Infiltration Detected"
        verdict_summary = "Intrusion patterns detected matching known credential-stuffing and automated probing signatures."
    else:
        verdict = "WARNING"
        verdict_headline = "Anomalous Traffic Detected"
        verdict_summary = f"{other_threats} flow(s) exhibited statistical deviation from standard baselines."

    # Protocols
    protocols = {"TCP": 0, "UDP": 0, "ICMP": 0, "Other": 0}
    for pkt in packets:
        t_proto = pkt.get("transport_protocol", "Other")
        if t_proto in protocols:
            protocols[t_proto] += 1
        else:
            protocols["Other"] += 1

    # Top talkers (Source IPs)
    src_ip_map = {}
    for pkt in packets:
        src = pkt.get("src_ip")
        if src:
            if src not in src_ip_map:
                src_ip_map[src] = {
                    "ip": src,
                    "host": pkt.get("src_host") or dns_resolver.get_hostname(src),
                    "packets": 0,
                    "bytes": 0
                }
            src_ip_map[src]["packets"] += 1
            src_ip_map[src]["bytes"] += pkt.get("length", 0)
    top_sources = sorted(src_ip_map.values(), key=lambda x: x["packets"], reverse=True)[:5]
    for s in top_sources:
        if not s.get("host"):
            s["host"] = dns_resolver.get_hostname(s["ip"])

    # Top targeted ports
    port_map = {}
    service_names = {21: "FTP", 22: "SSH", 80: "HTTP", 443: "HTTPS", 53: "DNS", 8000: "API", 3000: "WEB"}
    for pkt in packets:
        dport = pkt.get("dst_port")
        if dport and dport > 0:
            if dport not in port_map:
                port_map[dport] = {
                    "port": dport,
                    "service": service_names.get(dport, f"Port {dport}"),
                    "packets": 0,
                    "threat": dport in (21, 22)
                }
            port_map[dport]["packets"] += 1
    top_destinations = sorted(port_map.values(), key=lambda x: x["packets"], reverse=True)[:6]

    # Flagged threat flows
    flagged = []
    for f in flows:
        if f.get("prediction") != "Benign" and f.get("prediction") != "Unknown":
            reasons = []
            f25 = f.get("features_25", {})
            if f25.get("Flow IAT Mean", 1000) < 500:
                reasons.append("High-velocity packet burst (IAT < 500μs)")
            if f25.get("SYN Flag Count", 0) > 0:
                reasons.append("Repeated SYN connection attempts")
            if f25.get("Down/Up Ratio", 1.0) <= 0.5:
                reasons.append("Asymmetric upload probing")
            if not reasons:
                reasons.append("Matches intrusion model decision branch")

            src_ip = f.get("src_ip") or f["src_endpoint"].split(":")[0]
            dst_ip = f.get("dst_ip") or f["dst_endpoint"].split(":")[0]
            src_h = f.get("src_host") or dns_resolver.get_hostname(src_ip)
            dst_h = f.get("dst_host") or dns_resolver.get_hostname(dst_ip)

            flagged.append({
                "key": f["key"],
                "src_endpoint": f["src_endpoint"],
                "dst_endpoint": f["dst_endpoint"],
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_host": src_h,
                "dst_host": dst_h,
                "dns_name": f.get("dns_name") or src_h,
                "prediction": f["prediction"],
                "confidence": f["confidence"],
                "total_packets": f["total_packets"],
                "total_bytes": f["total_bytes"],
                "duration": round(f["duration"], 4),
                "reasons": reasons
            })

    packet_rate = round(total_packets / uptime, 1) if uptime > 0 else 0.0
    byte_rate = round(total_bytes / uptime, 1) if uptime > 0 else 0.0

    return {
        "status": "capturing" if session.is_capturing else "idle",
        "interface": active_iface or "Wi-Fi",
        "bpf_filter": bpf,
        "uptime": uptime,
        "total_packets": total_packets,
        "total_bytes": total_bytes,
        "total_flows": len(flows),
        "packet_rate": packet_rate,
        "byte_rate": byte_rate,
        "threat_counts": threat_counts,
        "total_threats": total_threats,
        "benign_percentage": round((benign_count / total_classified) * 100, 1) if total_classified > 0 else 100.0,
        "threat_verdict": {
            "level": verdict,
            "headline": verdict_headline,
            "summary": verdict_summary
        },
        "protocol_distribution": protocols,
        "top_sources": top_sources,
        "top_destinations": top_destinations,
        "flagged_flows": flagged
    }


@app.get("/api/dns/resolve")
def resolve_ip_address(ip: str):
    """Resolves an IP to its DNS / PTR reverse hostname (non-blocking)."""
    hostname = dns_resolver.get_hostname(ip)
    return {
        "ip": ip,
        "hostname": hostname or ip,
        "resolved": hostname is not None and hostname != ip
    }


@app.post("/api/dataset/evaluate-csv")
async def evaluate_csv_dataset(file: UploadFile = File(...)):
    """Ingests an external CSV dataset, aligns 26 features, and computes benchmark metrics."""
    if not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV or tabular text datasets are supported.")

    content = await file.read()
    try:
        import io
        import pandas as pd
        df = pd.read_csv(io.BytesIO(content))
        return run_dataset_evaluation(df, source_name=file.filename)
    except Exception as e:
        logger.error(f"Failed to evaluate dataset: {e}")
        raise HTTPException(status_code=400, detail=f"Dataset evaluation error: {str(e)}")


@app.get("/api/dataset/sample-benchmark")
def get_sample_benchmark():
    """Runs benchmark evaluation on the built-in 200-sample CIC-IDS benchmark dataset."""
    sample_path = DPI_DIR / "data" / "sample_benchmark.csv"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="Sample benchmark dataset not found.")
    import pandas as pd
    df = pd.read_csv(sample_path)
    return run_dataset_evaluation(df, source_name="CIC-IDS Calibrated Benchmark (200 Flows)")


# ============================================================================
# Cyber Lab & Traffic Simulator Endpoints
# ============================================================================
@app.get("/api/lab/status")
def get_lab_status():
    """Returns active lab target connectivity, simulation state, and live terminal logs."""
    return lab_simulator.get_status()


@app.post("/api/lab/start")
def start_lab_simulation(req: StartLabRequest):
    """Starts non-blocking synthetic attack / benign traffic generation."""
    return lab_simulator.start(mode=req.mode, duration_seconds=req.duration_seconds, rate=req.rate)


@app.post("/api/lab/stop")
def stop_lab_simulation():
    """Signals the active traffic generator to terminate."""
    return lab_simulator.stop()


@app.post("/api/lab/services/start")
def start_lab_services():
    """Starts the in-process mock target responders (FTP, SSH, HTTP)."""
    mock_services.start()
    return {"status": "started", "targets": mock_services.get_status()}


# ============================================================================
# WebSocket Endpoint for Live Telemetry Push
# ============================================================================
@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot
        await websocket.send_json({
            "type": "snapshot",
            "status": "capturing" if session.is_capturing else "idle",
            "stats": {
                "total_packets": session.total_packets_count,
                "total_bytes": session.total_bytes_count,
                "active_flows": len(session.flow_store),
                "threat_counts": session.threat_counts
            }
        })
        while True:
            # Keep-alive ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting DPI Intelligence API Server on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
