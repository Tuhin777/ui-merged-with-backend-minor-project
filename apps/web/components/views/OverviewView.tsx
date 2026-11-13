"use client";

import React from "react";
import { SystemStatus, FlowSummary } from "@/lib/api";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Workflow, 
  Binary, 
  Zap, 
  ArrowUpRight, 
  Upload, 
  Cpu, 
  Clock,
  Layers,
  BarChart3,
  Radio,
  Sparkles
} from "lucide-react";
import { DPIPipelineAnimation } from "@/components/DPIPipelineAnimation";

interface OverviewViewProps {
  status: SystemStatus | null;
  recentFlows: FlowSummary[];
  onNavigate: (tab: any) => void;
  onInspectFlow: (flowKey: string) => void;
  onStartCapture: () => void;
  isCapturing?: boolean;
  packetRate?: number;
}

export function OverviewView({ 
  status, 
  recentFlows, 
  onNavigate, 
  onInspectFlow,
  onStartCapture,
  isCapturing = false,
  packetRate = 0,
}: OverviewViewProps) {
  const benignCount = status?.threat_counts["Benign"] || 0;
  const ftpThreats = status?.threat_counts["FTP-BruteForce"] || 0;
  const sshThreats = status?.threat_counts["SSH-Bruteforce"] || 0;
  const totalThreats = ftpThreats + sshThreats;
  const totalClassified = benignCount + totalThreats;

  const benignPct = totalClassified > 0 ? ((benignCount / totalClassified) * 100).toFixed(1) : "100.0";

  const alertFlows = recentFlows.filter((f) => f.prediction !== "Benign" && f.prediction !== "Unknown");

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      {totalThreats > 0 ? (
        <div className="p-4 rounded border-2 border-[#1a1815] bg-[#fff1f2] press-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded border border-[#1a1815] bg-[#b91c1c] text-white shrink-0">
              <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1a1815]">
                Security Alert: {totalThreats} Malicious Flows Identified
              </div>
              <div className="text-xs text-[#6b6459]">
                Model flagged {ftpThreats} FTP-BruteForce and {sshThreats} SSH-Bruteforce conversations.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => onNavigate("analytics")}
              className="px-3.5 py-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-xs font-bold press-shadow-sm flex items-center gap-1.5 cursor-pointer transition"
            >
              <span>Session Forensics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate("flows")}
              className="px-3.5 py-1.5 rounded border border-[#1a1815] bg-[#b91c1c] text-white text-xs font-bold press-shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-[#991b1b] transition"
            >
              <span>Review Flows</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded border border-[#1a1815] bg-[#2f7d4f] text-white shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1a1815]">
                Network Perimeter Status: Normal
              </div>
              <div className="text-xs text-[#6b6459]">
                All inspected traffic matching baseline benign traffic criteria.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => onNavigate("analytics")}
              className="px-3.5 py-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-xs font-bold press-shadow-sm flex items-center gap-1.5 cursor-pointer transition"
            >
              <span>Session Forensics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            {status?.uptime ? (
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#1a1815] bg-[#f4f1ea] px-3 py-1.5 rounded border border-[#1a1815]">
                <Clock className="w-3.5 h-3.5 text-[#1a1815]" />
                <span>Uptime: {formatUptime(status.uptime)}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Live DPI Pipeline Flow Animation ── */}
      <DPIPipelineAnimation
        isCapturing={isCapturing || status?.status === "capturing"}
        packetRate={packetRate}
        totalPackets={status?.total_packets ?? 0}
        threatCounts={{
          Benign:           status?.threat_counts?.Benign            ?? 0,
          "FTP-BruteForce": status?.threat_counts?.["FTP-BruteForce"] ?? 0,
          "SSH-Bruteforce": status?.threat_counts?.["SSH-Bruteforce"] ?? 0,
          Other:            status?.threat_counts?.Other             ?? 0,
        }}
        activeInterface={status?.active_interface ?? "Wi-Fi"}
      />

      {/* ── Studio Quick Launch & Highlights Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <button
          onClick={() => onNavigate("capture")}
          className="p-3 rounded border-2 border-[#1a1815] bg-[#ffffff] hover:bg-[#fffdfa] press-shadow-sm flex items-start gap-3 text-left transition cursor-pointer group"
        >
          <div className="p-2 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815] shrink-0 group-hover:scale-105 transition-transform">
            <Radio className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-mono text-[#1a1815]">Packet Capture</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#f4f1ea] border border-[#1a1815] rounded font-bold">Timer</span>
            </div>
            <p className="text-[11px] text-[#6b6459] mt-0.5 line-clamp-1">
              Timed sessions (10s, 30s, 60s, 5m), auto-stop, live stream
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate("analytics")}
          className="p-3 rounded border-2 border-[#1a1815] bg-[#ffffff] hover:bg-[#fffdfa] press-shadow-sm flex items-start gap-3 text-left transition cursor-pointer group"
        >
          <div className="p-2 rounded border border-[#1a1815] bg-[#1a1815] text-[#f4f1ea] shrink-0 group-hover:scale-105 transition-transform">
            <BarChart3 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-mono text-[#1a1815]">Session Forensics</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#fff1f2] border border-[#b91c1c] text-[#b91c1c] rounded font-bold">Analysis</span>
            </div>
            <p className="text-[11px] text-[#6b6459] mt-0.5 line-clamp-1">
              Post-capture verdict, top talkers, targeted ports, JSON export
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate("analytics")}
          className="p-3 rounded border-2 border-[#1a1815] bg-[#ffffff] hover:bg-[#fffdfa] press-shadow-sm flex items-start gap-3 text-left transition cursor-pointer group"
        >
          <div className="p-2 rounded border border-[#1a1815] bg-[#2f7d4f] text-[#ffffff] shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-mono text-[#1a1815]">Benchmark Studio</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#f4f1ea] border border-[#1a1815] rounded font-bold">External Data</span>
            </div>
            <p className="text-[11px] text-[#6b6459] mt-0.5 line-clamp-1">
              Upload custom CSVs or run calibrated 200-flow CIC-IDS test
            </p>
          </div>
        </button>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Packets */}
        <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#6b6459] font-bold">Packets Ingested</span>
            <div className="p-1 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815]">
              <Binary className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#1a1815] tabular-nums">
            {status?.total_packets.toLocaleString() || 0}
          </div>
          <div className="text-xs text-[#6b6459] mt-1 flex items-center gap-1.5 font-mono">
            <span>Volume:</span>
            <span className="text-[#1a1815] font-semibold">{formatBytes(status?.total_bytes || 0)}</span>
          </div>
        </div>

        {/* Active Flows */}
        <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#6b6459] font-bold">Tracked Flows</span>
            <div className="p-1 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#1a1815]">
              <Workflow className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#1a1815] tabular-nums">
            {status?.active_flows.toLocaleString() || 0}
          </div>
          <div className="text-xs text-[#6b6459] mt-1 font-mono">
            Bidirectional 5-tuple conversations
          </div>
        </div>

        {/* Security Threats */}
        <div className={`p-4 rounded border border-[#1a1815] ${totalThreats > 0 ? "bg-[#fff1f2] press-shadow-sm" : "bg-[#ffffff] press-shadow-card"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#6b6459] font-bold">Threat Alerts</span>
            <div className={`p-1 rounded border border-[#1a1815] ${totalThreats > 0 ? "bg-[#b91c1c] text-white" : "bg-[#f4f1ea] text-[#1a1815]"}`}>
              <ShieldAlert className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${totalThreats > 0 ? "text-[#b91c1c]" : "text-[#1a1815]"}`}>
            {totalThreats}
          </div>
          <div className="text-xs text-[#6b6459] mt-1 flex items-center gap-2 font-mono">
            <span>FTP: {ftpThreats}</span>
            <span>•</span>
            <span>SSH: {sshThreats}</span>
          </div>
        </div>

        {/* ML Inference Engine */}
        <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#6b6459] font-bold">ML Classifier</span>
            <div className="p-1 rounded border border-[#1a1815] bg-[#2f7d4f] text-white">
              <Cpu className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-[#2f7d4f]">
            Decision Tree
          </div>
          <div className="text-xs text-[#6b6459] mt-1 font-mono">
            25 Statistical Features • 3 Classes
          </div>
        </div>
      </div>

      {/* Grid: Traffic Classification Breakdown + Quick Action Launchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Breakdown */}
        <div className="lg:col-span-2 p-5 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#d6cfc0]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1a1815]" />
              <h2 className="text-sm font-bold text-[#1a1815] uppercase tracking-wider font-mono">
                Real-Time Traffic Classification
              </h2>
            </div>
            <span className="text-xs font-mono text-[#6b6459]">
              Total: {totalClassified} flows
            </span>
          </div>

          {/* Visual Bar Breakdown */}
          <div className="h-4 w-full bg-[#f4f1ea] border border-[#1a1815] rounded overflow-hidden flex">
            <div 
              style={{ width: `${benignPct}%` }} 
              className="bg-[#2f7d4f] transition-all duration-500"
              title={`Benign: ${benignPct}%`}
            />
            <div 
              style={{ width: `${totalClassified > 0 ? ((ftpThreats / totalClassified) * 100).toFixed(1) : 0}%` }} 
              className="bg-[#b91c1c] transition-all duration-500"
              title={`FTP-BruteForce: ${ftpThreats}`}
            />
            <div 
              style={{ width: `${totalClassified > 0 ? ((sshThreats / totalClassified) * 100).toFixed(1) : 0}%` }} 
              className="bg-[#f7b955] transition-all duration-500"
              title={`SSH-Bruteforce: ${sshThreats}`}
            />
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 pt-1">
            <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2f7d4f] border border-[#1a1815]" />
                <span className="text-xs font-semibold text-[#1a1815]">Benign</span>
              </div>
              <div className="text-lg font-bold font-mono text-[#2f7d4f]">
                {benignCount} <span className="text-xs font-normal text-[#6b6459]">({benignPct}%)</span>
              </div>
            </div>

            <div className="p-3 rounded border border-[#1a1815] bg-[#fff1f2]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#b91c1c] border border-[#1a1815]" />
                <span className="text-xs font-semibold text-[#1a1815]">FTP-BruteForce</span>
              </div>
              <div className="text-lg font-bold font-mono text-[#b91c1c]">
                {ftpThreats}
              </div>
            </div>

            <div className="p-3 rounded border border-[#1a1815] bg-[#fefce8]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f7b955] border border-[#1a1815]" />
                <span className="text-xs font-semibold text-[#1a1815]">SSH-Bruteforce</span>
              </div>
              <div className="text-lg font-bold font-mono text-[#8a4b00]">
                {sshThreats}
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-[#6b6459] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-t border-[#d6cfc0] font-mono">
            <span>Algorithm: Scikit-learn DecisionTreeClassifier</span>
            <button 
              onClick={() => onNavigate("model")}
              className="text-[#1a1815] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Explore 25 Features</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quick Launchpad & Test Actions */}
        <div className="p-5 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-[#1a1815]" />
              <h2 className="text-sm font-bold text-[#1a1815] uppercase tracking-wider font-mono">
                Developer Actions
              </h2>
            </div>
            <p className="text-xs text-[#6b6459] mb-4">
              Trigger capture workflows or replay test files.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate("capture")}
                className="w-full text-left p-3 rounded border border-[#1a1815] bg-[#f4f1ea] hover:bg-[#ffffff] transition flex items-center justify-between group cursor-pointer press-shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815]">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1a1815]">
                      Replay PCAP File
                    </div>
                    <div className="text-[11px] text-[#6b6459]">
                      Offline test with Wireshark dump
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#1a1815]" />
              </button>

              <button
                onClick={() => onNavigate("model")}
                className="w-full text-left p-3 rounded border border-[#1a1815] bg-[#f4f1ea] hover:bg-[#ffffff] transition flex items-center justify-between group cursor-pointer press-shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded border border-[#1a1815] bg-[#2f7d4f] text-white">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1a1815]">
                      ML Diagnostic Studio
                    </div>
                    <div className="text-[11px] text-[#6b6459]">
                      Manual 25-feature simulator
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#1a1815]" />
              </button>
            </div>
          </div>

          <div className="p-3 rounded bg-[#f4f1ea] border border-[#d6cfc0] text-[11px] text-[#6b6459] font-mono">
            <span>BPF Default: </span>
            <span className="text-[#1a1815] font-bold">{status?.bpf_filter || "ip or ip6"}</span>
          </div>
        </div>
      </div>

      {/* Recent Alerts Feed Table */}
      {alertFlows.length > 0 && (
        <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#d6cfc0]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#b91c1c]" />
              <h2 className="text-sm font-bold text-[#1a1815] uppercase tracking-wider font-mono">
                Recent Threat Detections ({alertFlows.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate("flows")}
              className="text-xs text-[#1a1815] hover:underline font-mono font-semibold cursor-pointer"
            >
              View all in Flow Explorer →
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full min-w-[640px] text-xs font-mono text-left">
              <thead className="text-[#6b6459] border-b border-[#1a1815] bg-[#f4f1ea]">
                <tr>
                  <th className="py-2.5 px-3">Conversation</th>
                  <th className="py-2.5 px-3">Protocol</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Packets</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6cfc0]">
                {alertFlows.slice(0, 5).map((flow) => (
                  <tr key={flow.key} className="hover:bg-[#fff1f2] transition">
                    <td className="py-2.5 px-3 text-[#1a1815]">
                      <span className="font-bold text-[#b91c1c]">{flow.src_endpoint}</span>
                      <span className="text-[#6b6459] mx-2">→</span>
                      <span className="text-[#1a1815]">{flow.dst_endpoint}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#6b6459]">{flow.transport_protocol}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded border border-[#1a1815] bg-[#b91c1c] text-white text-[11px] font-bold">
                        {flow.prediction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#1a1815]">
                      {(flow.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-[#6b6459]">
                      {flow.total_packets} ({flow.fwd_packets} fwd / {flow.bwd_packets} bwd)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onInspectFlow(flow.key)}
                        className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#f4f1ea] hover:bg-[#ffffff] text-[#1a1815] text-[11px] font-mono cursor-pointer font-semibold press-shadow-sm transition"
                      >
                        Inspect 25F
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
