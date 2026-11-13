"use client";

import React, { useState, useEffect } from "react";
import { 
  SystemStatus, 
  NetworkInterface, 
  fetchInterfaces, 
  startCapture, 
  stopCapture, 
  uploadPcapFile,
} from "@/lib/api";
import { 
  Radio, 
  Play, 
  Square, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  RefreshCw,
  Timer,
  Clock
} from "lucide-react";
import { DPIPipelineAnimation } from "@/components/DPIPipelineAnimation";

interface CaptureViewProps {
  status: SystemStatus | null;
  onRefresh: () => void;
  isCapturing: boolean;
  setIsCapturing: (val: boolean) => void;
  packetRate?: number;
}

export function CaptureView({ status, onRefresh, isCapturing, setIsCapturing, packetRate = 0 }: CaptureViewProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>("Wi-Fi");
  const [bpfFilter, setBpfFilter] = useState<string>("ip or ip6");
  const [packetCount, setPacketCount] = useState<string>("");
  const [durationPreset, setDurationPreset] = useState<string>("30");
  const [customDuration, setCustomDuration] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // PCAP upload state
  const [pcapFile, setPcapFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  useEffect(() => {
    fetchInterfaces()
      .then((data) => {
        setInterfaces(data);
        if (data.length > 0) {
          const wifi = data.find((i) => i.name.toLowerCase().includes("wi-fi") || i.name.toLowerCase().includes("wifi"));
          if (wifi) {
            setSelectedInterface(wifi.name);
          } else {
            setSelectedInterface(data[0].name);
          }
        }
      })
      .catch((err) => console.error("Could not load interfaces:", err));
  }, []);

  const bpfPresets = [
    { label: "All IP Traffic", filter: "ip or ip6" },
    { label: "TCP Traffic Only", filter: "tcp" },
    { label: "UDP Traffic Only", filter: "udp" },
    { label: "Web (HTTP / HTTPS)", filter: "tcp port 80 or tcp port 443" },
    { label: "Bruteforce Targets (FTP / SSH)", filter: "tcp port 21 or tcp port 22" },
    { label: "DNS Queries", filter: "udp port 53" },
  ];

  const getEffectiveDurationSeconds = (): number | undefined => {
    if (durationPreset === "continuous") return undefined;
    if (durationPreset === "custom") {
      const parsed = parseInt(customDuration, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    }
    const parsed = parseInt(durationPreset, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
  };

  const handleStartCapture = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const count = packetCount ? parseInt(packetCount, 10) : undefined;
      const duration = getEffectiveDurationSeconds();
      await startCapture(selectedInterface, bpfFilter, count, duration);
      setIsCapturing(true);
      setSuccessMsg(`Capture initiated on ${selectedInterface}${duration ? ` (auto-stop in ${duration}s)` : " (continuous)"}`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start capture");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCapture = async () => {
    setIsLoading(true);
    try {
      await stopCapture();
      setIsCapturing(false);
      setSuccessMsg("Capture halted successfully.");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to stop capture");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcapFile) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    try {
      const res = await uploadPcapFile(pcapFile);
      setUploadResult(res);
      setSuccessMsg(`Processed ${res.packets_processed} packets and ${res.flows_identified} flows from ${res.filename}`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "PCAP processing error");
    } finally {
      setUploading(false);
    }
  };

  const isLive = isCapturing || status?.status === "capturing";

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded border border-[#1a1815] bg-[#fff1f2] text-[#b91c1c] text-xs font-semibold flex items-center gap-2 press-shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded border border-[#1a1815] bg-[#f0fdf4] text-[#2f7d4f] text-xs font-semibold flex items-center gap-2 press-shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── DPI Pipeline Animation (visible always, activates on capture) ── */}
      <DPIPipelineAnimation
        isCapturing={isLive}
        packetRate={packetRate}
        totalPackets={status?.total_packets ?? 0}
        threatCounts={{
          Benign:            status?.threat_counts?.Benign            ?? 0,
          "FTP-BruteForce":  status?.threat_counts?.["FTP-BruteForce"] ?? 0,
          "SSH-Bruteforce":  status?.threat_counts?.["SSH-Bruteforce"] ?? 0,
          Other:             status?.threat_counts?.Other             ?? 0,
        }}
        activeInterface={status?.active_interface ?? selectedInterface}
      />

      {/* Grid: Live Capture Config on Left, Offline PCAP Replay on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Live Network Sniffer */}
        <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815]">
                <Radio className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1a1815]">Live Network Capture</h3>
                <p className="text-xs text-[#6b6459]">Stream packets directly from physical adapters via tshark</p>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded text-[11px] font-mono border border-[#1a1815] font-bold ${
              isLive ? "bg-[#2f7d4f] text-white" : "bg-[#f4f1ea] text-[#1a1815]"
            }`}>
              {isLive ? "● RUNNING" : "○ READY"}
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Interface Selector */}
            <div>
              <label className="block text-[#1a1815] font-bold mb-1 font-mono">
                Capture Interface
              </label>
              <select
                value={selectedInterface}
                onChange={(e) => setSelectedInterface(e.target.value)}
                disabled={isLive}
                className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded px-3 py-2 text-[#1a1815] font-mono focus:outline-none focus:ring-2 focus:ring-[#f7b955] disabled:opacity-50"
              >
                {interfaces.map((iface) => (
                  <option key={iface.id} value={iface.name}>
                    {iface.name} ({iface.raw.split(" ")[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* BPF Filter Input & Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#1a1815] font-bold font-mono">
                  Berkeley Packet Filter (BPF)
                </label>
                <span className="text-[10px] text-[#6b6459] font-mono">tcpdump syntax</span>
              </div>
              <input
                type="text"
                value={bpfFilter}
                onChange={(e) => setBpfFilter(e.target.value)}
                disabled={isLive}
                placeholder="e.g. ip or ip6, tcp port 80"
                className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded px-3 py-2 text-[#1a1815] font-mono focus:outline-none focus:ring-2 focus:ring-[#f7b955] disabled:opacity-50"
              />

              {/* Quick Presets */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bpfPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setBpfFilter(preset.filter)}
                    disabled={isLive}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer disabled:opacity-50 ${
                      bpfFilter === preset.filter 
                        ? "bg-[#1a1815] text-[#ffffff] border-[#1a1815] font-bold" 
                        : "bg-[#f4f1ea] border-[#d6cfc0] text-[#6b6459] hover:text-[#1a1815]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Packet Limit */}
            <div>
              <label className="block text-[#1a1815] font-bold mb-1 font-mono">
                Packet Count Limit (Optional)
              </label>
              <input
                type="number"
                value={packetCount}
                onChange={(e) => setPacketCount(e.target.value)}
                disabled={isLive}
                placeholder="Leave blank for continuous capture"
                className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded px-3 py-2 text-[#1a1815] font-mono focus:outline-none focus:ring-2 focus:ring-[#f7b955] disabled:opacity-50"
              />
            </div>

            {/* Session Duration / Auto-Stop Timer */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#1a1815] font-bold font-mono flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-[#1a1815]" />
                  <span>Session Capture Duration</span>
                </label>
                <span className="text-[10px] text-[#6b6459] font-mono">Auto-stop timer</span>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                {[
                  { label: "10s (Test)", val: "10" },
                  { label: "30s (Default)", val: "30" },
                  { label: "60s (1m)", val: "60" },
                  { label: "300s (5m)", val: "300" },
                  { label: "Continuous", val: "continuous" },
                  { label: "Custom", val: "custom" },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    disabled={isLive}
                    onClick={() => setDurationPreset(preset.val)}
                    className={`py-1.5 px-2 rounded text-xs font-mono font-bold border transition cursor-pointer disabled:opacity-50 ${
                      durationPreset === preset.val
                        ? "bg-[#1a1815] text-[#ffffff] border-[#1a1815] press-shadow-sm"
                        : "bg-[#f4f1ea] border-[#1a1815] text-[#1a1815] hover:bg-[#eae5d9]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              {durationPreset === "custom" && (
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="7200"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    disabled={isLive}
                    placeholder="Enter duration in seconds (e.g. 45)"
                    className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded px-3 py-2 pr-16 text-[#1a1815] font-mono focus:outline-none focus:ring-2 focus:ring-[#f7b955] disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#6b6459]">seconds</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Session Countdown Card */}
          {isLive && status?.duration_seconds && status?.remaining_seconds !== null && status?.remaining_seconds !== undefined && (
            <div className="p-3.5 rounded border-2 border-[#1a1815] bg-[#f7b955]/20 press-shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1a1815] animate-spin" style={{ animationDuration: "6s" }} />
                  <span className="font-mono font-bold text-xs text-[#1a1815]">Session Countdown</span>
                </div>
                <div className="font-mono font-black text-sm text-[#1a1815]">
                  {status.remaining_seconds}s <span className="text-[#6b6459] font-normal text-xs">/ {status.duration_seconds}s</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded bg-[#f4f1ea] border border-[#1a1815] overflow-hidden">
                <div 
                  className="h-full bg-[#1a1815] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((status.duration_seconds - status.remaining_seconds) / status.duration_seconds) * 100))}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#6b6459]">
                <span>Auto-stop engaged</span>
                <span>Graceful finalization</span>
              </div>
            </div>
          )}

          {/* Trigger Button */}
          <div className="pt-2">
            {isLive ? (
              <button
                onClick={handleStopCapture}
                disabled={isLoading}
                className="w-full py-2.5 rounded border border-[#1a1815] bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer press-shadow-sm transition disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Active Capture</span>
              </button>
            ) : (
              <button
                onClick={handleStartCapture}
                disabled={isLoading}
                className="w-full py-2.5 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer press-shadow-sm transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Live Sniffing</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Offline PCAP / PCAPNG Analyzer */}
        <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#1a1815]">
                <Upload className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1a1815]">PCAP Replay Studio</h3>
                <p className="text-xs text-[#6b6459]">Offline file inspection without live network traffic</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815] font-bold">
              Safe Replay
            </span>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-[#1a1815] rounded p-6 text-center transition bg-[#f4f1ea]/50">
              <FileText className="w-8 h-8 mx-auto text-[#6b6459] mb-2" />
              <div className="text-xs font-bold text-[#1a1815]">
                {pcapFile ? pcapFile.name : "Select or drag & drop a PCAP file"}
              </div>
              <div className="text-[11px] text-[#6b6459] mt-1 font-mono">
                Supports .pcap, .pcapng, and .cap from Wireshark / tcpdump
              </div>
              <label className="mt-4 inline-block px-3 py-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-xs font-mono font-bold press-shadow-sm cursor-pointer transition">
                Browse Files
                <input
                  type="file"
                  accept=".pcap,.pcapng,.cap"
                  onChange={(e) => setPcapFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!pcapFile || uploading}
              className="w-full py-2.5 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer press-shadow-sm transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing PCAP through DPI Engine...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Analyze PCAP Offline</span>
                </>
              )}
            </button>
          </form>

          {/* Upload Results Detail */}
          {uploadResult && (
            <div className="p-3.5 rounded border border-[#1a1815] bg-[#f4f1ea] text-xs font-mono space-y-1.5 animate-in fade-in press-shadow-sm">
              <div className="text-[#1a1815] font-bold flex items-center justify-between pb-1 border-b border-[#d6cfc0]">
                <span>Analysis Complete</span>
                <span>{uploadResult.filename}</span>
              </div>
              <div className="text-[#6b6459] flex justify-between">
                <span>Packets Ingested:</span>
                <span className="font-bold text-[#1a1815]">{uploadResult.packets_processed}</span>
              </div>
              <div className="text-[#6b6459] flex justify-between">
                <span>Flows Mapped:</span>
                <span className="font-bold text-[#1a1815]">{uploadResult.flows_identified}</span>
              </div>
              <div className="text-[#6b6459] flex justify-between">
                <span>Benign:</span>
                <span className="text-[#2f7d4f] font-bold">{uploadResult.threat_counts?.Benign || 0}</span>
              </div>
              <div className="text-[#6b6459] flex justify-between">
                <span>FTP-BruteForce:</span>
                <span className="text-[#b91c1c] font-bold">{uploadResult.threat_counts?.["FTP-BruteForce"] || 0}</span>
              </div>
              <div className="text-[#6b6459] flex justify-between">
                <span>SSH-Bruteforce:</span>
                <span className="text-[#8a4b00] font-bold">{uploadResult.threat_counts?.["SSH-Bruteforce"] || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
