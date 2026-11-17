"use client";

import React, { useState, useEffect } from "react";
import { 
  SessionReport, 
  DatasetEvaluationResult, 
  fetchSessionReport, 
  evaluateCsvDataset, 
  fetchSampleBenchmark,
  fetchFlows,
  FlowSummary
} from "@/lib/api";
import { SankeyTrafficDiagram } from "@/components/SankeyTrafficDiagram";
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  FileSearch, 
  Upload, 
  Play, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  Clock, 
  Zap, 
  Layers, 
  Activity, 
  PieChart, 
  FileSpreadsheet,
  Info,
  Globe
} from "lucide-react";

interface AnalyticsViewProps {
  onInspectFlow: (flowKey: string) => void;
  onNavigate: (tab: any) => void;
}

export function AnalyticsView({ onInspectFlow, onNavigate }: AnalyticsViewProps) {
  const [subTab, setSubTab] = useState<"conduits" | "forensics" | "benchmark">("conduits");

  // Forensics report state
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(true);
  const [flows, setFlows] = useState<FlowSummary[]>([]);

  // Benchmark state
  const [benchmarkResult, setBenchmarkResult] = useState<DatasetEvaluationResult | null>(null);
  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [sampleFilter, setSampleFilter] = useState<string>("ALL");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadReport = () => {
    setLoadingReport(true);
    fetchSessionReport()
      .then((data) => setReport(data))
      .catch((err) => console.error("Could not load session report:", err))
      .finally(() => setLoadingReport(false));

    fetchFlows()
      .then((res) => setFlows(res.flows || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleRunSampleBenchmark = async () => {
    setBenchmarkError(null);
    setBenchmarking(true);
    try {
      const res = await fetchSampleBenchmark();
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchmarkError(err.message || "Failed to run sample benchmark");
    } finally {
      setBenchmarking(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setBenchmarkError(null);
    setBenchmarking(true);
    try {
      const res = await evaluateCsvDataset(uploadFile);
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchmarkError(err.message || "Failed to process external dataset");
    } finally {
      setBenchmarking(false);
    }
  };

  const exportReportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dpi_session_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const filteredSamples = benchmarkResult?.samples.filter((s) => {
    if (sampleFilter === "ALL") return true;
    if (sampleFilter === "MISMATCH") return s.is_correct === false;
    return s.prediction === sampleFilter || s.actual === sampleFilter;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar: Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b-2 border-[#1a1815]">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1a1815] flex items-center gap-2">
            <span>Security Forensics & ML Evaluation</span>
            <span className="text-[10px] sm:text-xs font-mono uppercase px-2 py-0.5 rounded border border-[#1a1815] bg-[#ffffff] text-[#1a1815] font-bold">
              Platen v1.0
            </span>
          </h2>
          <p className="text-xs text-[#6b6459] mt-0.5">
            Post-capture session forensics, intrusion analysis, and external dataset benchmark evaluation.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow-sm w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSubTab("conduits")}
            className={`flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded text-xs font-bold font-mono transition cursor-pointer whitespace-nowrap ${
              subTab === "conduits"
                ? "bg-[#1a1815] text-[#ffffff] press-shadow-sm"
                : "text-[#6b6459] hover:text-[#1a1815]"
            }`}
          >
            Sankey Conduits
          </button>
          <button
            onClick={() => setSubTab("forensics")}
            className={`flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded text-xs font-bold font-mono transition cursor-pointer whitespace-nowrap ${
              subTab === "forensics"
                ? "bg-[#1a1815] text-[#ffffff] press-shadow-sm"
                : "text-[#6b6459] hover:text-[#1a1815]"
            }`}
          >
            Finished Session Forensics
          </button>
          <button
            onClick={() => setSubTab("benchmark")}
            className={`flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded text-xs font-bold font-mono transition cursor-pointer whitespace-nowrap ${
              subTab === "benchmark"
                ? "bg-[#1a1815] text-[#ffffff] press-shadow-sm"
                : "text-[#6b6459] hover:text-[#1a1815]"
            }`}
          >
            External Dataset Benchmark
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 0: SANKEY TRAFFIC FLOW CONDUITS                                 */}
      {/* ==================================================================== */}
      {subTab === "conduits" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <SankeyTrafficDiagram flows={flows} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: FINISHED SESSION FORENSICS                                   */}
      {/* ==================================================================== */}
      {subTab === "forensics" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Executive Security Verdict Card */}
          {report && (
            <div className={`p-5 rounded border-2 border-[#1a1815] press-shadow transition ${
              report.threat_verdict.level === "CRITICAL"
                ? "bg-[#fff1f2]"
                : report.threat_verdict.level === "WARNING"
                ? "bg-[#fefce8]"
                : "bg-[#ffffff]"
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#1a1815]">
                <div className="flex items-start md:items-center gap-3.5">
                  <div className={`p-3 rounded border-2 border-[#1a1815] text-white shrink-0 ${
                    report.threat_verdict.level === "CRITICAL"
                      ? "bg-[#b91c1c] animate-pulse"
                      : report.threat_verdict.level === "WARNING"
                      ? "bg-[#f7b955] text-[#1a1815]"
                      : "bg-[#2f7d4f]"
                  }`}>
                    {report.threat_verdict.level === "CRITICAL" ? (
                      <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
                    ) : report.threat_verdict.level === "WARNING" ? (
                      <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                    ) : (
                      <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-[#1a1815] ${
                        report.threat_verdict.level === "CRITICAL"
                          ? "bg-[#b91c1c] text-white"
                          : report.threat_verdict.level === "WARNING"
                          ? "bg-[#f7b955] text-[#1a1815]"
                          : "bg-[#2f7d4f] text-white"
                      }`}>
                        VERDICT: {report.threat_verdict.level}
                      </span>
                      <span className="text-xs font-mono text-[#6b6459]">
                        Interface: <span className="text-[#1a1815] font-bold">{report.interface}</span>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#1a1815]">
                      {report.threat_verdict.headline}
                    </h3>
                    <p className="text-xs text-[#6b6459] mt-0.5">
                      {report.threat_verdict.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                  <button
                    onClick={loadReport}
                    disabled={loadingReport}
                    className="p-2 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] press-shadow-sm cursor-pointer transition disabled:opacity-50"
                    title="Refresh Session Data"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingReport ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={exportReportJson}
                    className="flex items-center gap-1.5 px-3 py-2 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-xs font-bold font-mono press-shadow-sm cursor-pointer transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* 4 Metric Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 pt-4">
                <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                  <div className="text-[11px] font-mono text-[#6b6459] uppercase">Total Packets</div>
                  <div className="text-lg font-mono font-bold text-[#1a1815] mt-1">
                    {report.total_packets.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-[#6b6459] mt-0.5">
                    {report.packet_rate} pkts/sec
                  </div>
                </div>

                <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                  <div className="text-[11px] font-mono text-[#6b6459] uppercase">Data Volume</div>
                  <div className="text-lg font-mono font-bold text-[#1a1815] mt-1">
                    {formatBytes(report.total_bytes)}
                  </div>
                  <div className="text-[10px] font-mono text-[#6b6459] mt-0.5">
                    {formatBytes(report.byte_rate)}/sec
                  </div>
                </div>

                <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                  <div className="text-[11px] font-mono text-[#6b6459] uppercase">Tracked Flows</div>
                  <div className="text-lg font-mono font-bold text-[#1a1815] mt-1">
                    {report.total_flows}
                  </div>
                  <div className="text-[10px] font-mono text-[#6b6459] mt-0.5">
                    {report.total_flows > 0 ? (report.total_packets / report.total_flows).toFixed(1) : 0} pkts/flow
                  </div>
                </div>

                <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                  <div className="text-[11px] font-mono text-[#6b6459] uppercase">Threat Ratio</div>
                  <div className="text-lg font-mono font-bold mt-1 text-[#1a1815]">
                    {report.total_threats} <span className="text-xs font-normal text-[#6b6459]">/ {report.total_flows}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#2f7d4f] font-bold mt-0.5">
                    {report.benign_percentage}% Benign
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Composition & Top Talkers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Protocol Distribution & Threat Classification */}
            <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#1a1815]" />
                  <h4 className="text-sm font-bold text-[#1a1815]">Session Classification Breakdown</h4>
                </div>
                <span className="text-[10px] font-mono text-[#6b6459]">Decision Tree</span>
              </div>

              {report && (
                <div className="space-y-3 text-xs">
                  {/* Benign */}
                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="font-bold text-[#2f7d4f]">Benign (Safe)</span>
                      <span className="font-bold text-[#1a1815]">
                        {report.threat_counts.Benign} flows ({report.benign_percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded bg-[#f4f1ea] border border-[#1a1815] overflow-hidden">
                      <div
                        className="h-full bg-[#2f7d4f] transition-all duration-500"
                        style={{ width: `${report.benign_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* FTP-BruteForce */}
                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="font-bold text-[#b91c1c]">FTP-BruteForce (Port 21)</span>
                      <span className="font-bold text-[#1a1815]">
                        {report.threat_counts["FTP-BruteForce"]} flows
                      </span>
                    </div>
                    <div className="w-full h-3 rounded bg-[#f4f1ea] border border-[#1a1815] overflow-hidden">
                      <div
                        className="h-full bg-[#b91c1c] transition-all duration-500"
                        style={{
                          width: `${report.total_flows > 0 ? (report.threat_counts["FTP-BruteForce"] / report.total_flows) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* SSH-Bruteforce */}
                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="font-bold text-[#8a4b00]">SSH-Bruteforce (Port 22)</span>
                      <span className="font-bold text-[#1a1815]">
                        {report.threat_counts["SSH-Bruteforce"]} flows
                      </span>
                    </div>
                    <div className="w-full h-3 rounded bg-[#f4f1ea] border border-[#1a1815] overflow-hidden">
                      <div
                        className="h-full bg-[#f7b955] transition-all duration-500"
                        style={{
                          width: `${report.total_flows > 0 ? (report.threat_counts["SSH-Bruteforce"] / report.total_flows) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Protocols meter */}
                  <div className="pt-2 border-t border-[#d6cfc0] mt-3">
                    <div className="text-[11px] font-mono font-bold text-[#1a1815] mb-1.5">
                      Transport Layer Protocols:
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                      <div className="p-1.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                        <div className="text-[#6b6459]">TCP</div>
                        <div className="font-bold text-[#1a1815]">{report.protocol_distribution.TCP}</div>
                      </div>
                      <div className="p-1.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                        <div className="text-[#6b6459]">UDP</div>
                        <div className="font-bold text-[#1a1815]">{report.protocol_distribution.UDP}</div>
                      </div>
                      <div className="p-1.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                        <div className="text-[#6b6459]">ICMP</div>
                        <div className="font-bold text-[#1a1815]">{report.protocol_distribution.ICMP}</div>
                      </div>
                      <div className="p-1.5 rounded border border-[#1a1815] bg-[#f4f1ea]">
                        <div className="text-[#6b6459]">Other</div>
                        <div className="font-bold text-[#1a1815]">{report.protocol_distribution.Other}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Top Talkers & Targeted Destination Ports */}
            <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#1a1815]" />
                  <h4 className="text-sm font-bold text-[#1a1815]">Top Source IPs & Targeted Ports</h4>
                </div>
                <span className="text-[10px] font-mono text-[#6b6459]">Perimeter Flow Activity</span>
              </div>

              {report && (
                <div className="space-y-4 text-xs font-mono">
                  {/* Top Sources */}
                  <div>
                    <div className="text-[11px] font-bold text-[#1a1815] mb-1.5">Top Active Source IPs:</div>
                    <div className="space-y-1">
                      {report.top_sources.length > 0 ? (
                        report.top_sources.map((src, i) => (
                          <div key={`${src.ip}-${i}`} className="flex items-center justify-between p-1.5 rounded border border-[#d6cfc0] bg-[#f4f1ea]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#1a1815] shrink-0">
                                {i + 1}. {src.ip}
                              </span>
                              {src.host && src.host !== src.ip && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#ffffff] border border-[#d6cfc0] text-[#1a1815] font-semibold flex items-center gap-1 truncate">
                                  <Globe className="w-2.5 h-2.5 text-[#2f7d4f] shrink-0" />
                                  <span className="truncate max-w-[140px]">{src.host}</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[#6b6459] shrink-0 text-right">
                              {src.packets.toLocaleString()} pkts ({formatBytes(src.bytes)})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[#6b6459] italic">No packets recorded yet.</div>
                      )}
                    </div>
                  </div>

                  {/* Top Targeted Destination Ports */}
                  <div>
                    <div className="text-[11px] font-bold text-[#1a1815] mb-1.5">Target Destination Ports:</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {report.top_destinations.length > 0 ? (
                        report.top_destinations.map((p, pIdx) => (
                          <div
                            key={`${p.port}-${p.service}-${pIdx}`}
                            className={`p-1.5 rounded border text-center ${
                              p.threat
                                ? "bg-[#fff1f2] border-[#b91c1c] text-[#b91c1c] font-bold"
                                : "bg-[#f4f1ea] border-[#1a1815] text-[#1a1815]"
                            }`}
                          >
                            <div className="text-[10px] text-[#6b6459]">{p.service}</div>
                            <div className="font-bold text-xs">Port {p.port}</div>
                            <div className="text-[10px]">{p.packets} pkts</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[#6b6459] italic col-span-3">No port data.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Flagged Threat Flows Forensics Table */}
          <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-3">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[#1a1815]" />
                <h4 className="text-sm font-bold text-[#1a1815]">Flagged Threat Flows & Security Evidence</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a1815] bg-[#f4f1ea] font-bold">
                {report?.flagged_flows.length || 0} Flagged
              </span>
            </div>

            {report && report.flagged_flows.length > 0 ? (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full min-w-[700px] text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b-2 border-[#1a1815] bg-[#f4f1ea]">
                      <th className="py-2 px-3 font-bold text-[#1a1815]">Source Endpoint</th>
                      <th className="py-2 px-3 font-bold text-[#1a1815]">Destination Endpoint</th>
                      <th className="py-2 px-3 font-bold text-[#1a1815]">ML Verdict</th>
                      <th className="py-2 px-3 font-bold text-[#1a1815]">Confidence</th>
                      <th className="py-2 px-3 font-bold text-[#1a1815]">Intrusion Indicators</th>
                      <th className="py-2 px-3 font-bold text-[#1a1815] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.flagged_flows.map((flow) => (
                      <tr key={flow.key} className="border-b border-[#d6cfc0] hover:bg-[#f4f1ea]/60 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#1a1815]">{flow.src_endpoint}</div>
                          {flow.src_host && flow.src_host !== flow.src_ip && (
                            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#fff1f2] border border-[#b91c1c]/40 text-[#b91c1c] text-[10px] font-mono font-bold">
                              <Globe className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[150px]">{flow.src_host}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-[#1a1815]">{flow.dst_endpoint}</div>
                          {flow.dst_host && flow.dst_host !== flow.dst_ip && (
                            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f4f1ea] border border-[#1a1815]/30 text-[#1a1815] text-[10px] font-mono">
                              <Globe className="w-2.5 h-2.5 text-[#6b6459] shrink-0" />
                              <span className="truncate max-w-[150px]">{flow.dst_host}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                            flow.prediction.includes("FTP")
                              ? "bg-[#b91c1c] text-white border-[#1a1815]"
                              : "bg-[#f7b955] text-[#1a1815] border-[#1a1815]"
                          }`}>
                            {flow.prediction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#1a1815]">
                          {(flow.confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-[#6b6459]">
                          <div className="flex flex-wrap gap-1">
                            {flow.reasons.map((r, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded bg-[#f4f1ea] border border-[#d6cfc0] text-[10px]">
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              onInspectFlow(flow.key);
                              onNavigate("flows");
                            }}
                            className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-[11px] font-bold press-shadow-sm transition cursor-pointer flex items-center gap-1 inline-flex"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-mono text-[#6b6459] bg-[#f4f1ea]/50 rounded border border-dashed border-[#1a1815]">
                <CheckCircle2 className="w-8 h-8 text-[#2f7d4f] mx-auto mb-2" />
                <div className="font-bold text-[#1a1815]">Zero Malicious Flows Flagged</div>
                <div className="text-[11px] mt-0.5">
                  All active session network conversations conform to standard benign operation.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: EXTERNAL DATASET BENCHMARK STUDIO                            */}
      {/* ==================================================================== */}
      {subTab === "benchmark" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Ingestion Zone */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box A: 1-Click Built-In Calibrated Benchmark */}
            <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#1a1815]" />
                    <h3 className="text-sm font-bold text-[#1a1815]">Built-In Benchmark Dataset</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a1815] bg-[#f7b955] text-[#1a1815] font-bold">
                    Pre-Calibrated
                  </span>
                </div>
                <p className="text-xs text-[#6b6459] mt-3">
                  Instantly benchmark the Decision Tree model using our bundled 200-flow CIC-IDS dataset (130 Benign, 40 FTP-BruteForce, 30 SSH-Bruteforce) to evaluate accuracy, precision, recall, and confusion matrix.
                </p>
              </div>

              <button
                onClick={handleRunSampleBenchmark}
                disabled={benchmarking}
                className="w-full py-2.5 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-xs font-bold font-mono press-shadow-sm flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                {benchmarking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating 200 Benchmark Flows...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run Built-In CIC-IDS Benchmark (200 Flows)</span>
                  </>
                )}
              </button>
            </div>

            {/* Box B: External Custom CSV Uploader */}
            <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#1a1815]" />
                    <h3 className="text-sm font-bold text-[#1a1815]">Upload External CSV Dataset</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] font-bold">
                    Custom Testing
                  </span>
                </div>
                <p className="text-xs text-[#6b6459] mt-3">
                  Provide your own external CSV dataset (with or without a <code>Label</code> column). The engine automatically extracts and aligns the 26 flow features for evaluation.
                </p>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label className="flex-1 px-3 py-2 rounded border border-[#1a1815] bg-[#f4f1ea] hover:bg-[#eae5d9] text-xs font-mono text-[#1a1815] cursor-pointer truncate">
                    {uploadFile ? uploadFile.name : "Select external .csv dataset..."}
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!uploadFile || benchmarking}
                    className="px-4 py-2 rounded border border-[#1a1815] bg-[#1a1815] text-white hover:bg-[#2f2b26] text-xs font-mono font-bold press-shadow-sm cursor-pointer transition disabled:opacity-50 shrink-0"
                  >
                    Analyze
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Error Notice */}
          {benchmarkError && (
            <div className="p-3.5 rounded border border-[#1a1815] bg-[#fff1f2] text-[#b91c1c] text-xs font-semibold flex items-center gap-2 press-shadow-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{benchmarkError}</span>
            </div>
          )}

          {/* Benchmark Results Display */}
          {benchmarkResult && (
            <div className="space-y-6">
              {/* Executive Evaluation Scorecard */}
              <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[#1a1815] gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#1a1815] flex items-center gap-2">
                      <span>Dataset Benchmark Evaluation:</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded border border-[#1a1815] bg-[#f7b955]">
                        {benchmarkResult.source}
                      </span>
                    </h3>
                    <p className="text-xs text-[#6b6459]">
                      Evaluated {benchmarkResult.total_samples.toLocaleString()} samples across Decision Tree 25-feature vector
                    </p>
                  </div>

                  {benchmarkResult.has_ground_truth && (
                    <div className="px-3 py-1 rounded border-2 border-[#1a1815] bg-[#2f7d4f] text-white font-mono font-bold text-sm press-shadow-sm">
                      {benchmarkResult.accuracy}% Accuracy
                    </div>
                  )}
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                    <div className="text-[11px] font-mono text-[#6b6459]">Total Samples</div>
                    <div className="text-xl font-mono font-bold text-[#1a1815] mt-1">
                      {benchmarkResult.total_samples}
                    </div>
                  </div>

                  <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                    <div className="text-[11px] font-mono text-[#6b6459]">Precision (Macro)</div>
                    <div className="text-xl font-mono font-bold text-[#1a1815] mt-1">
                      {benchmarkResult.has_ground_truth ? `${benchmarkResult.precision}%` : "N/A"}
                    </div>
                  </div>

                  <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                    <div className="text-[11px] font-mono text-[#6b6459]">Recall (Macro)</div>
                    <div className="text-xl font-mono font-bold text-[#1a1815] mt-1">
                      {benchmarkResult.has_ground_truth ? `${benchmarkResult.recall}%` : "N/A"}
                    </div>
                  </div>

                  <div className="p-3 rounded border border-[#1a1815] bg-[#f4f1ea]">
                    <div className="text-[11px] font-mono text-[#6b6459]">F1-Score</div>
                    <div className="text-xl font-mono font-bold text-[#1a1815] mt-1">
                      {benchmarkResult.has_ground_truth ? `${benchmarkResult.f1_score}%` : "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Confusion Matrix & Class Distribution Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 2D Confusion Matrix */}
                {benchmarkResult.confusion_matrix && (
                  <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-[#1a1815]">
                      <h4 className="text-sm font-bold text-[#1a1815]">Confusion Matrix (Actual vs Predicted)</h4>
                      <span className="text-[10px] font-mono text-[#6b6459]">Classification Heatmap</span>
                    </div>

                    <div className="overflow-x-auto scrollbar-none pt-2">
                      <table className="w-full min-w-[420px] text-center text-xs font-mono">
                        <thead>
                          <tr>
                            <th className="p-2 text-left text-[11px] text-[#6b6459]">Actual \ Pred</th>
                            {benchmarkResult.confusion_matrix.classes.map((c) => (
                              <th key={c} className="p-2 font-bold text-[#1a1815] border-b-2 border-[#1a1815]">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {benchmarkResult.confusion_matrix.matrix.map((row, rowIdx) => {
                            const actualLabel = benchmarkResult.confusion_matrix!.classes[rowIdx];
                            return (
                              <tr key={actualLabel} className="border-b border-[#d6cfc0]">
                                <td className="p-2 text-left font-bold text-[#1a1815] bg-[#f4f1ea]">
                                  {actualLabel}
                                </td>
                                {row.map((cell, colIdx) => {
                                  const isDiagonal = rowIdx === colIdx;
                                  return (
                                    <td
                                      key={colIdx}
                                      className={`p-2 font-bold ${
                                        isDiagonal
                                          ? cell > 0 ? "bg-[#f0fdf4] text-[#2f7d4f]" : "text-[#1a1815]"
                                          : cell > 0 ? "bg-[#fff1f2] text-[#b91c1c]" : "text-[#6b6459]"
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6b6459] pt-2 border-t border-[#d6cfc0]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#2f7d4f]" /> Correct Classifications (Diagonal)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#b91c1c]" /> Misclassifications (Off-diagonal)
                      </span>
                    </div>
                  </div>
                )}

                {/* Class Counts Breakdown */}
                <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-[#1a1815]">
                    <h4 className="text-sm font-bold text-[#1a1815]">Predicted Class Breakdown</h4>
                    <span className="text-[10px] font-mono text-[#6b6459]">Frequency & Share</span>
                  </div>

                  <div className="space-y-3 text-xs font-mono pt-2">
                    {Object.entries(benchmarkResult.class_distribution).map(([clsName, count]) => {
                      const pct = ((count / benchmarkResult.total_samples) * 100).toFixed(1);
                      return (
                        <div key={clsName}>
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-[#1a1815]">{clsName}</span>
                            <span className="text-[#6b6459]">{count} flows ({pct}%)</span>
                          </div>
                          <div className="w-full h-3 rounded bg-[#f4f1ea] border border-[#1a1815] overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                clsName === "Benign"
                                  ? "bg-[#2f7d4f]"
                                  : clsName.includes("FTP")
                                  ? "bg-[#b91c1c]"
                                  : "bg-[#f7b955]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sample Predictions Table */}
              <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[#1a1815] gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#1a1815]" />
                    <h4 className="text-sm font-bold text-[#1a1815]">Sample Row Predictions & Feature Values</h4>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                    {["ALL", "Benign", "FTP-BruteForce", "SSH-Bruteforce", "MISMATCH"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setSampleFilter(f)}
                        className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                          sampleFilter === f
                            ? "bg-[#1a1815] text-[#ffffff] border-[#1a1815] font-bold"
                            : "bg-[#f4f1ea] border-[#d6cfc0] text-[#6b6459] hover:text-[#1a1815]"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-none">
                  <table className="w-full min-w-[700px] text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b-2 border-[#1a1815] bg-[#f4f1ea]">
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Row</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Actual</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Predicted</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Match</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Duration (μs)</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Fwd / Bwd Pkts</th>
                        <th className="py-2 px-3 font-bold text-[#1a1815]">Init Bwd Win</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSamples.map((s) => (
                        <tr key={s.id} className="border-b border-[#d6cfc0] hover:bg-[#f4f1ea]/60 transition">
                          <td className="py-2 px-3 text-[#6b6459]">#{s.id}</td>
                          <td className="py-2 px-3 font-semibold text-[#1a1815]">
                            {s.actual || "N/A"}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                              s.prediction === "Benign"
                                ? "bg-[#f0fdf4] text-[#2f7d4f] border-[#2f7d4f]"
                                : s.prediction.includes("FTP")
                                ? "bg-[#fff1f2] text-[#b91c1c] border-[#b91c1c]"
                                : "bg-[#fefce8] text-[#8a4b00] border-[#f7b955]"
                            }`}>
                              {s.prediction}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {s.is_correct === true ? (
                              <CheckCircle2 className="w-4 h-4 text-[#2f7d4f]" />
                            ) : s.is_correct === false ? (
                              <XCircle className="w-4 h-4 text-[#b91c1c]" />
                            ) : (
                              <span className="text-[#6b6459]">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#1a1815]">{s.duration.toLocaleString()}</td>
                          <td className="py-2 px-3 text-[#1a1815]">{s.fwd_packets} / {s.bwd_packets}</td>
                          <td className="py-2 px-3 text-[#1a1815]">{s.init_bwd_win}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
