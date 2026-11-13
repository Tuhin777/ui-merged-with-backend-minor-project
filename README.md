# KGEC DPI ML System (2025–27 Batch)

Real-time **Deep Packet Inspection (DPI)** and **Machine Learning Network Traffic Classification** system with a high-density developer dashboard.

---

## 🚀 Quick Start

### Option A: One-Click Launcher (Windows)
Double-click **`start_all.bat`** in this directory to automatically start the Python API (`:8000`), the Next.js Web Studio (`:3000`), and launch your browser. To stop all services cleanly, run **`stop_all.bat`**.

---

### Option B: Manual Terminal Start

#### 1. Start the DPI Intelligence API Server (Port 8000)
```powershell
python dpi/server.py
```
> The API server exposes REST endpoints, XAI root-cause explanations, and a WebSocket feed on `http://localhost:8000`.

#### 2. Start the Developer Web UI (Port 3000)
```powershell
cd apps/web
pnpm dev
# or: npm run dev
```
> Open your browser at `http://localhost:3000` (or jump straight to `http://localhost:3000/?tab=lab` for the Cyber Lab).

---

## 🔬 Cyber Lab & Attack Simulation Drill (Zero-Docker)

Run realistic live network drills locally without Docker Desktop:

```powershell
# Mixed realistic drill (web browsing interleaved with brute-force bursts)
python dpi/lab/simulator_engine.py --mode mixed --duration 30

# SSH brute-force attack drill
python dpi/lab/simulator_engine.py --mode ssh --duration 30

# FTP brute-force attack drill
python dpi/lab/simulator_engine.py --mode ftp --duration 30
```
> You can also launch and monitor simulations visually from the **Cyber Lab** tab in the Web Studio.

---

## 🗂️ System Architecture

- **Capture Engine (`dpi/capture/`)**: PyShark-powered live network sniffing (`tshark`) and offline PCAP/PCAPNG replay.
- **Feature Extraction (`dpi/feature/`)**: Extracts per-packet attributes including Shannon payload entropy and inter-arrival timing (IAT).
- **Flow Aggregator (`dpi/flow/`)**: Maps packet streams into bidirectional 5-tuple conversations with forward/backward directional metrics.
- **ML & Explainable AI (`dpi/model/`)**: Scikit-learn Decision Tree model predicting `Benign`, `FTP-BruteForce`, and `SSH-Bruteforce` over 25 statistical features, with heuristic root-cause impact scoring.
- **Cyber Lab Engine (`dpi/lab/`)**: Standalone mock services on ports 2121 (FTP), 2222 (SSH), and 8080 (HTTP) with live packet injection and auto-scrolling console.
- **Web Dashboard (`apps/web/`)**: Next.js 16 + React 19 + TailwindCSS with real-time telemetry, 25-feature drill-down inspector, Cyber-Tactical Dark Mode, and ML simulation studio.
