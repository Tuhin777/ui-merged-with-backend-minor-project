"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  LabStatus, 
  fetchLabStatus, 
  startLabSimulation, 
  stopLabSimulation, 
  startLabServices 
} from "@/lib/api";
import { 
  FlaskConical, 
  Play, 
  Square, 
  RotateCcw, 
  Terminal, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Server, 
  Radio, 
  Zap, 
  Activity, 
  ArrowUpRight,
  Info,
  Lock
} from "lucide-react";

interface LabViewProps {
  onNavigate: (tab: any) => void;
  isCapturing?: boolean;
}

export function LabView({ onNavigate, isCapturing }: LabViewProps) {
  const [labStatus, setLabStatus] = useState<LabStatus | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("ssh");
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedRate, setSelectedRate] = useState<string>("aggressive");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const refreshStatus = () => {
    fetchLabStatus()
      .then((data) => setLabStatus(data))
      .catch((err) => console.error("Lab status error:", err));
  };

  useEffect(() => {
    refreshStatus();
    // Poll every 1.5 seconds for live log updates and countdown
    const interval = setInterval(refreshStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [labStatus?.logs, autoScroll]);

  const handleStart = async () => {
    try {
      setLoadingAction("start");
      await startLabSimulation(selectedMode, selectedDuration, selectedRate);
      refreshStatus();
    } catch (err: any) {
      alert(`Simulation failed to start: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStop = async () => {
    try {
      setLoadingAction("stop");
      await stopLabSimulation();
      refreshStatus();
    } catch (err: any) {
      alert(`Simulation failed to stop: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBootServices = async () => {
    try {
      setLoadingAction("boot");
      await startLabServices();
      refreshStatus();
    } catch (err: any) {
      alert(`Failed to start mock services: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const isSimulating = labStatus?.is_running || false;

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-mono uppercase px-2 py-0.5 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815] font-bold">
              Cyber Lab & Testbed
            </span>
            {isSimulating ? (
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#b91c1c] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#b91c1c]" />
                <span>INJECTING TRAFFIC ({labStatus?.remaining_seconds}s)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#6b6459]">
                <span className="w-2 h-2 rounded-full bg-[#2f7d4f]" />
                <span>Ready for Simulation</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1815]">
            Synthetic Traffic Injection & Verification
          </h2>
          <p className="text-xs sm:text-sm text-[#6b6459] max-w-2xl leading-relaxed">
            Generate controlled brute-force attacks and authentic benign traffic against loopback targets (127.0.0.1) 
            to verify real-time DPI packet classification, threat alerts, and XAI root cause reasoning.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBootServices}
            disabled={loadingAction === "boot"}
            title="Start in-process mock socket responders"
            className="px-3 py-2 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-xs font-mono font-bold press-shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Server className="w-3.5 h-3.5 text-[#f7b955]" />
            <span>Check Targets</span>
          </button>

          <button
            onClick={() => onNavigate("capture")}
            className="px-3 py-2 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-xs font-mono font-bold press-shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Go to Capture</span>
          </button>
        </div>
      </div>

      {/* Lab Targets Health Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* SSH Target */}
        <div className="p-4 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#6b6459] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#1a1815]" />
              <span>SSH Target</span>
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#1a1815] ${
              labStatus?.targets?.ssh?.online ? "bg-[#2f7d4f] text-white" : "bg-[#f4f1ea] text-[#6b6459]"
            }`}>
              {labStatus?.targets?.ssh?.online ? "ONLINE" : "STANDALONE"}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#1a1815]">
            127.0.0.1:2222
          </div>
          <div className="text-[11px] text-[#6b6459] flex items-center justify-between pt-1 border-t border-[#d6cfc0]">
            <span>OpenSSH Handshake</span>
            <span className="text-[#2f7d4f] font-bold">Zero-Docker Safe</span>
          </div>
        </div>

        {/* FTP Target */}
        <div className="p-4 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#6b6459] flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#1a1815]" />
              <span>FTP Target</span>
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#1a1815] ${
              labStatus?.targets?.ftp?.online ? "bg-[#2f7d4f] text-white" : "bg-[#f4f1ea] text-[#6b6459]"
            }`}>
              {labStatus?.targets?.ftp?.online ? "ONLINE" : "STANDALONE"}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#1a1815]">
            127.0.0.1:2121
          </div>
          <div className="text-[11px] text-[#6b6459] flex items-center justify-between pt-1 border-t border-[#d6cfc0]">
            <span>vsftpd Command Daemon</span>
            <span className="text-[#2f7d4f] font-bold">Zero-Docker Safe</span>
          </div>
        </div>

        {/* HTTP Web Target */}
        <div className="p-4 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#6b6459] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#1a1815]" />
              <span>DVWA / Web Target</span>
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#1a1815] ${
              labStatus?.targets?.http?.online ? "bg-[#2f7d4f] text-white" : "bg-[#f4f1ea] text-[#6b6459]"
            }`}>
              {labStatus?.targets?.http?.online ? "ONLINE" : "STANDALONE"}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#1a1815]">
            127.0.0.1:8080
          </div>
          <div className="text-[11px] text-[#6b6459] flex items-center justify-between pt-1 border-t border-[#d6cfc0]">
            <span>HTTP Web Simulator</span>
            <span className="text-[#2f7d4f] font-bold">Interactive Benign</span>
          </div>
        </div>
      </div>

      {/* Traffic Control & Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 sm:p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#1a1815]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#f7b955]" />
                <h3 className="text-xs sm:text-sm font-bold text-[#1a1815] uppercase font-mono tracking-wider">
                  Simulation Controller
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#6b6459]">Npcap Loopback</span>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-[#1a1815] uppercase block">
                Select Traffic Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMode("ssh")}
                  disabled={isSimulating}
                  className={`p-2.5 rounded border text-left font-mono transition cursor-pointer text-xs ${
                    selectedMode === "ssh"
                      ? "border-2 border-[#1a1815] bg-[#fff1f2] text-[#1a1815] font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#6b6459]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>SSH Brute-Force</span>
                    <span className="w-2 h-2 rounded-full bg-[#b91c1c]" />
                  </div>
                  <div className="text-[10px] text-[#6b6459] font-normal mt-0.5">Hydra Spray :2222</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("ftp")}
                  disabled={isSimulating}
                  className={`p-2.5 rounded border text-left font-mono transition cursor-pointer text-xs ${
                    selectedMode === "ftp"
                      ? "border-2 border-[#1a1815] bg-[#fff1f2] text-[#1a1815] font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#6b6459]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>FTP Brute-Force</span>
                    <span className="w-2 h-2 rounded-full bg-[#c2410c]" />
                  </div>
                  <div className="text-[10px] text-[#6b6459] font-normal mt-0.5">Dictionary :2121</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("benign")}
                  disabled={isSimulating}
                  className={`p-2.5 rounded border text-left font-mono transition cursor-pointer text-xs ${
                    selectedMode === "benign"
                      ? "border-2 border-[#1a1815] bg-[#f0fdf4] text-[#1a1815] font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#6b6459]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Benign Browsing</span>
                    <span className="w-2 h-2 rounded-full bg-[#2f7d4f]" />
                  </div>
                  <div className="text-[10px] text-[#6b6459] font-normal mt-0.5">Human HTTP :8080</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("mixed")}
                  disabled={isSimulating}
                  className={`p-2.5 rounded border text-left font-mono transition cursor-pointer text-xs ${
                    selectedMode === "mixed"
                      ? "border-2 border-[#1a1815] bg-[#fefce8] text-[#1a1815] font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#6b6459]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Mixed Drill</span>
                    <span className="w-2 h-2 rounded-full bg-[#f7b955]" />
                  </div>
                  <div className="text-[10px] text-[#6b6459] font-normal mt-0.5">Safe + Attack Bursts</div>
                </button>
              </div>
            </div>

            {/* Duration Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#1a1815] uppercase block">
                Duration Limit:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 30, 60].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setSelectedDuration(dur)}
                    disabled={isSimulating}
                    className={`py-1.5 rounded border font-mono text-xs transition cursor-pointer ${
                      selectedDuration === dur
                        ? "border-2 border-[#1a1815] bg-[#1a1815] text-white font-bold press-shadow-sm"
                        : "border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] hover:bg-[#ffffff]"
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity / Rate */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#1a1815] uppercase block">
                Attack Speed:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRate("aggressive")}
                  disabled={isSimulating}
                  className={`py-1.5 px-2 rounded border font-mono text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedRate === "aggressive"
                      ? "border-2 border-[#1a1815] bg-[#b91c1c] text-white font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] hover:bg-[#ffffff]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Aggressive Burst</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRate("stealth")}
                  disabled={isSimulating}
                  className={`py-1.5 px-2 rounded border font-mono text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedRate === "stealth"
                      ? "border-2 border-[#1a1815] bg-[#2f7d4f] text-white font-bold press-shadow-sm"
                      : "border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] hover:bg-[#ffffff]"
                  }`}
                >
                  <span>Stealth Pace</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-[#d6cfc0] space-y-2">
              {isSimulating ? (
                <button
                  onClick={handleStop}
                  disabled={loadingAction === "stop"}
                  className="w-full py-2.5 rounded border-2 border-[#1a1815] bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-bold font-mono press-shadow transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Active Simulation</span>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={loadingAction === "start"}
                  className="w-full py-2.5 rounded border-2 border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-xs font-bold font-mono press-shadow transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch {selectedMode.toUpperCase()} Traffic Drill</span>
                </button>
              )}

              <p className="text-[11px] text-[#6b6459] text-center font-mono">
                Tip: Ensure Live Capture is running on <span className="font-bold text-[#1a1815]">Loopback / Wi-Fi</span> to capture these packets.
              </p>
            </div>
          </div>

          {/* Verification Scorecard */}
          <div className="p-4 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between font-bold text-[#1a1815] border-b border-[#d6cfc0] pb-1.5">
              <span>Simulation Scorecard</span>
              <span className="text-[10px] text-[#2f7d4f]">100% In-Memory</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                <div className="text-[10px] text-[#6b6459]">Requests Sent</div>
                <div className="text-lg font-bold text-[#1a1815]">
                  {labStatus?.stats?.requests_sent || 0}
                </div>
              </div>

              <div className="p-2.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                <div className="text-[10px] text-[#6b6459]">Rejections Caught</div>
                <div className="text-lg font-bold text-[#b91c1c]">
                  {labStatus?.stats?.rejected || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-[#6b6459]">DPI Live Capture:</span>
              <span className={isCapturing ? "text-[#2f7d4f] font-bold" : "text-[#c2410c] font-bold"}>
                {isCapturing ? "Active Sniffing" : "Idle (Start on Capture Tab)"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Terminal Live Console (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded border-2 border-[#1a1815] bg-[#0c0e14] press-shadow overflow-hidden flex flex-col h-[520px]">
            {/* Terminal Header */}
            <div className="px-3.5 py-2.5 border-b border-[#2d3342] bg-[#161922] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                </div>
                <span className="font-mono text-xs text-[#94a3b8] font-bold pl-2">
                  kgec-cyberlab@loopback:~# ./attack_injector.sh
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                    autoScroll ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10" : "border-[#2d3342] text-[#94a3b8]"
                  }`}
                >
                  Auto-Scroll: {autoScroll ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Terminal Output Stream */}
            <div
              ref={terminalRef}
              className="flex-1 p-3.5 font-mono text-xs overflow-y-auto space-y-1.5 scrollbar-none select-text"
            >
              {labStatus?.logs && labStatus.logs.length > 0 ? (
                labStatus.logs.map((log, idx) => {
                  let colorClass = "text-[#94a3b8]";
                  if (log.level === "SSH-BRUTE") colorClass = "text-[#f87171] font-bold";
                  else if (log.level === "FTP-BRUTE") colorClass = "text-[#fb923c] font-bold";
                  else if (log.level === "BENIGN") colorClass = "text-[#34d399]";
                  else if (log.level === "INFO") colorClass = "text-[#38bdf8]";
                  else if (log.level === "WARN") colorClass = "text-[#facc15]";
                  else if (log.level === "ERROR") colorClass = "text-[#ef4444] font-black";

                  return (
                    <div key={idx} className="leading-relaxed flex items-start gap-2">
                      <span className="text-[#64748b] shrink-0 text-[11px]">[{log.timestamp}]</span>
                      <span className="text-[#3b82f6] shrink-0 font-bold">[{log.level}]</span>
                      <span className={`${colorClass} break-all`}>{log.message}</span>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#64748b] space-y-2">
                  <Terminal className="w-8 h-8 opacity-40" />
                  <p className="text-xs">Terminal idle. Select a traffic mode and click "Launch Traffic Drill".</p>
                </div>
              )}
            </div>

            {/* Terminal Status Footer */}
            <div className="px-3.5 py-2 border-t border-[#2d3342] bg-[#161922] flex items-center justify-between text-[11px] font-mono text-[#94a3b8] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span>Socket Injector Ready (Ports 2121, 2222, 8080)</span>
              </div>
              <div>
                Logs buffered: <span className="font-bold text-white">{labStatus?.logs?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
