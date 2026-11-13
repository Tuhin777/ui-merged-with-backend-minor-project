"use client";

import React, { useState, useEffect } from "react";
import { FlowSummary, fetchFlowDetail } from "@/lib/api";
import { 
  Search, 
  X, 
  Copy, 
  Check, 
  Sliders,
  Globe,
  Brain,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Terminal,
  Activity
} from "lucide-react";

interface FlowsViewProps {
  flows: FlowSummary[];
  selectedFlowKey: string | null;
  onSelectFlow: (key: string | null) => void;
}

export function FlowsView({ flows, selectedFlowKey, onSelectFlow }: FlowsViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [labelFilter, setLabelFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [detailFlow, setDetailFlow] = useState<FlowSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Fetch deep inspection + XAI explanation when a flow is clicked
  useEffect(() => {
    if (!selectedFlowKey) {
      setDetailFlow(null);
      return;
    }
    const found = flows.find((f) => f.key === selectedFlowKey) || null;
    setDetailFlow(found);

    setLoadingDetail(true);
    fetchFlowDetail(selectedFlowKey)
      .then((data) => setDetailFlow(data))
      .catch((err) => console.error("Flow detail error:", err))
      .finally(() => setLoadingDetail(false));
  }, [selectedFlowKey, flows]);

  // Selected flow detail with deep XAI features
  const selectedFlow = detailFlow || flows.find((f) => f.key === selectedFlowKey) || null;

  // Filter flows
  const filteredFlows = flows.filter((flow) => {
    const matchesSearch = 
      searchTerm === "" ||
      flow.src_endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flow.dst_endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flow.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flow.transport_protocol.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLabel = 
      labelFilter === "ALL" || flow.prediction.toLowerCase() === labelFilter.toLowerCase();

    return matchesSearch && matchesLabel;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-4 relative">
      {/* Search & Filter Header Bar */}
      <div className="p-3 sm:p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6459]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by IP, port, protocol or key..."
            className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded pl-9 pr-3 py-2 text-xs font-mono text-[#1a1815] focus:outline-none focus:ring-2 focus:ring-[#f7b955]"
          />
        </div>

        {/* Classification Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-0.5 sm:pb-0">
          {["ALL", "Benign", "FTP-BruteForce", "SSH-Bruteforce"].map((label) => (
            <button
              key={label}
              onClick={() => setLabelFilter(label)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer shrink-0 border border-[#1a1815] whitespace-nowrap ${
                labelFilter === label
                  ? "bg-[#1a1815] text-[#ffffff] font-bold press-shadow-sm"
                  : "bg-[#f4f1ea] text-[#1a1815] hover:bg-[#ffffff]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Flow Table */}
      <div className="rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow overflow-hidden">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full min-w-[850px] text-xs font-mono text-left">
            <thead className="text-[#6b6459] border-b-2 border-[#1a1815] bg-[#f4f1ea]">
              <tr>
                <th className="py-3 px-4 font-bold">Endpoints (Bidirectional)</th>
                <th className="py-3 px-3 font-bold">Protocol</th>
                <th className="py-3 px-3 font-bold">Packets (Fwd/Bwd)</th>
                <th className="py-3 px-3 font-bold">Volume</th>
                <th className="py-3 px-3 font-bold">Duration</th>
                <th className="py-3 px-3 font-bold">ML Classification</th>
                <th className="py-3 px-3 font-bold">Confidence</th>
                <th className="py-3 px-4 text-right font-bold">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d6cfc0]">
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6b6459] font-mono">
                    {flows.length === 0
                      ? "No active flows recorded yet. Start live capture or upload a PCAP file."
                      : "No flows matching current filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredFlows.map((flow, idx) => {
                  const isThreat = flow.prediction !== "Benign" && flow.prediction !== "Unknown";
                  const isSelected = flow.key === selectedFlowKey;
                  // Combine flow key + forward_key + index to guard against
                  // re-opened flows with identical 5-tuples producing duplicate keys
                  const rowKey = `${flow.key}__${flow.forward_key ?? idx}__${idx}`;

                  return (
                    <tr
                      key={rowKey}
                      onClick={() => onSelectFlow(flow.key)}
                      className={`cursor-pointer transition ${
                        isSelected 
                          ? "bg-[#fefce8] border-l-4 border-l-[#1a1815]" 
                          : isThreat 
                            ? "hover:bg-[#fff1f2]" 
                            : "hover:bg-[#f4f1ea]"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isThreat ? "text-[#b91c1c]" : "text-[#1a1815]"}`}>
                            {flow.src_endpoint}
                          </span>
                          <span className="text-[#6b6459]">↔</span>
                          <span className="text-[#1a1815] font-semibold">{flow.dst_endpoint}</span>
                        </div>
                        {((flow.src_host && flow.src_host !== flow.src_ip) || (flow.dst_host && flow.dst_host !== flow.dst_ip)) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                            {flow.src_host && flow.src_host !== flow.src_ip && (
                              <span className="inline-flex items-center gap-1 text-[#6b6459] bg-[#f4f1ea] px-1.5 py-0.2 rounded border border-[#d6cfc0]">
                                <Globe className="w-2.5 h-2.5 text-[#2f7d4f]" />
                                <span className="truncate max-w-[150px]">{flow.src_host}</span>
                              </span>
                            )}
                            {flow.dst_host && flow.dst_host !== flow.dst_ip && (
                              <span className="inline-flex items-center gap-1 text-[#6b6459] bg-[#f4f1ea] px-1.5 py-0.2 rounded border border-[#d6cfc0]">
                                <span className="text-[#6b6459]">→</span>
                                <span className="truncate max-w-[150px]">{flow.dst_host}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] font-semibold">
                          {flow.transport_protocol}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#1a1815]">
                        {flow.total_packets} ({flow.fwd_packets}f / {flow.bwd_packets}b)
                      </td>
                      <td className="py-3 px-3 text-[#1a1815] font-bold">
                        {formatBytes(flow.total_bytes)}
                      </td>
                      <td className="py-3 px-3 text-[#6b6459]">
                        {flow.duration.toFixed(3)}s
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded border border-[#1a1815] text-[11px] font-bold ${
                          flow.prediction === "Benign"
                            ? "bg-[#2f7d4f] text-white"
                            : flow.prediction === "FTP-BruteForce"
                              ? "bg-[#b91c1c] text-white"
                              : "bg-[#f7b955] text-[#1a1815]"
                        }`}>
                          {flow.prediction}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-[#f4f1ea] border border-[#1a1815] rounded overflow-hidden">
                            <div
                              style={{ width: `${flow.confidence * 100}%` }}
                              className={`h-full ${isThreat ? "bg-[#b91c1c]" : "bg-[#2f7d4f]"}`}
                            />
                          </div>
                          <span className="text-[#1a1815] font-bold text-[11px]">
                            {(flow.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFlow(flow.key);
                          }}
                          className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-[11px] font-mono font-bold press-shadow-sm transition cursor-pointer"
                        >
                          25 Features
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Feature Inspector Drawer */}
      {selectedFlow && (
        <>
          {/* Backdrop for click-outside dismissal */}
          <div
            onClick={() => onSelectFlow(null)}
            className="fixed inset-0 bg-[#1a1815]/50 backdrop-blur-xs z-50 transition-opacity"
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[560px] lg:w-[600px] max-w-full bg-[#f4f1ea] border-l-2 border-[#1a1815] shadow-2xl z-50 p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1a1815]" />
                <h3 className="text-sm font-bold text-[#1a1815] uppercase font-mono tracking-wider">
                  Flow Deep Feature Inspector
                </h3>
              </div>
              <button
                onClick={() => onSelectFlow(null)}
                className="p-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] press-shadow-sm transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          {/* Flow Summary Badge */}
          <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-sm text-xs font-mono space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#6b6459] font-bold">Conversation:</span>
              <button
                onClick={() => copyToClipboard(selectedFlow.key)}
                className="text-[#1a1815] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3 h-3 text-[#2f7d4f]" /> : <Copy className="w-3 h-3" />}
                <span>Copy 5-Tuple</span>
              </button>
            </div>
            <div className="text-[#1a1815] font-bold break-all">
              {selectedFlow.src_endpoint} ↔ {selectedFlow.dst_endpoint}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#d6cfc0]">
              <div>
                <span className="text-[#6b6459]">Prediction: </span>
                <span className={`font-bold ${selectedFlow.prediction === "Benign" ? "text-[#2f7d4f]" : "text-[#b91c1c]"}`}>
                  {selectedFlow.prediction}
                </span>
              </div>
              <div>
                <span className="text-[#6b6459]">Confidence: </span>
                <span className="text-[#1a1815] font-bold">{(selectedFlow.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* DNS & Host Resolution */}
            {(selectedFlow.src_host || selectedFlow.dst_host || selectedFlow.dns_name) && (
              <div className="pt-2 border-t border-[#d6cfc0] space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-[#1a1815]">
                  <Globe className="w-3.5 h-3.5 text-[#2f7d4f]" />
                  <span>DNS & Host Identity</span>
                </div>
                {selectedFlow.src_host && (
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-[#6b6459] min-w-0">
                    <span className="shrink-0 font-medium">Originating Site / Host:</span>
                    <span className="font-bold text-[#1a1815] break-all sm:text-right font-mono min-w-0" title={selectedFlow.src_host}>
                      {selectedFlow.src_host}
                    </span>
                  </div>
                )}
                {selectedFlow.dst_host && (
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-[#6b6459] min-w-0">
                    <span className="shrink-0 font-medium">Target Site / Host:</span>
                    <span className="font-bold text-[#1a1815] break-all sm:text-right font-mono min-w-0" title={selectedFlow.dst_host}>
                      {selectedFlow.dst_host}
                    </span>
                  </div>
                )}
                {selectedFlow.dns_name && selectedFlow.dns_name !== selectedFlow.src_host && (
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-[#6b6459] min-w-0">
                    <span className="shrink-0 font-medium">DNS Query:</span>
                    <span className="font-bold text-[#2f7d4f] break-all sm:text-right font-mono min-w-0" title={selectedFlow.dns_name}>
                      {selectedFlow.dns_name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Decision Tree Class Probabilities */}
          {selectedFlow.probabilities && Object.keys(selectedFlow.probabilities).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#1a1815] uppercase font-mono tracking-wider">
                Class Probabilities
              </h4>
              <div className="space-y-2">
                {Object.entries(selectedFlow.probabilities).map(([cls, prob]) => (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono gap-2 min-w-0">
                      <span className="text-[#6b6459] font-semibold truncate min-w-0">{cls}</span>
                      <span className="text-[#1a1815] font-bold shrink-0">{(prob * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#ffffff] border border-[#1a1815] rounded overflow-hidden">
                      <div
                        style={{ width: `${prob * 100}%` }}
                        className={`h-full ${cls === "Benign" ? "bg-[#2f7d4f]" : "bg-[#b91c1c]"}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Explainability & Root Cause Reasoning (XAI) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#d6cfc0]">
              <div className="flex items-center gap-1.5 font-bold text-xs font-mono uppercase tracking-wider text-[#1a1815]">
                <Brain className="w-4 h-4 text-[#f7b955]" />
                <span>AI Root Cause & Reasoning</span>
              </div>
              {selectedFlow.xai_explanation && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#1a1815] ${
                  selectedFlow.xai_explanation.risk_level === "CRITICAL"
                    ? "bg-[#b91c1c] text-white animate-pulse"
                    : selectedFlow.xai_explanation.risk_level === "HIGH"
                    ? "bg-[#c2410c] text-white"
                    : "bg-[#2f7d4f] text-white"
                }`}>
                  {selectedFlow.xai_explanation.risk_level} RISK
                </span>
              )}
            </div>

            {loadingDetail && !selectedFlow.xai_explanation ? (
              <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] text-center text-xs font-mono text-[#6b6459] flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f7b955] animate-ping" />
                <span>Analyzing Decision Tree path & root cause...</span>
              </div>
            ) : selectedFlow.xai_explanation ? (
              <div className="space-y-3">
                {/* Plain-English Analyst Diagnostic Summary */}
                <div className={`p-3.5 rounded border-2 border-[#1a1815] press-shadow-sm space-y-1.5 ${
                  selectedFlow.xai_explanation.risk_level === "CRITICAL"
                    ? "bg-[#fff1f2]"
                    : selectedFlow.xai_explanation.risk_level === "HIGH"
                    ? "bg-[#fefce8]"
                    : "bg-[#f0fdf4]"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-[#1a1815]">
                    {selectedFlow.xai_explanation.risk_level === "CRITICAL" ? (
                      <ShieldAlert className="w-4 h-4 text-[#b91c1c] shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-[#2f7d4f] shrink-0" />
                    )}
                    <span>Diagnostic Summary</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#1a1815] font-sans">
                    {selectedFlow.xai_explanation.analyst_summary}
                  </p>
                </div>

                {/* Top Contributing Behavioral Drivers */}
                {selectedFlow.xai_explanation.top_factors && selectedFlow.xai_explanation.top_factors.length > 0 && (
                  <div className="p-3.5 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold font-mono text-[#1a1815] border-b border-[#d6cfc0] pb-1.5">
                      <span>Key Contributing Behaviors</span>
                      <span className="text-[10px] text-[#6b6459] font-normal">Impact Weight</span>
                    </div>

                    <div className="space-y-3">
                      {selectedFlow.xai_explanation.top_factors.map((factor, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-4 h-4 rounded-full bg-[#1a1815] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-[#1a1815] truncate min-w-0" title={factor.title}>{factor.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-mono text-[#6b6459]">{factor.value}</span>
                              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-[#1a1815] shrink-0 ${
                                selectedFlow.prediction === "Benign" ? "bg-[#2f7d4f] text-white" : "bg-[#f7b955] text-[#1a1815]"
                              }`}>
                                +{factor.impact_pct}%
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-[#f4f1ea] border border-[#1a1815] rounded overflow-hidden">
                            <div
                              style={{ width: `${factor.impact_pct}%` }}
                              className={`h-full ${selectedFlow.prediction === "Benign" ? "bg-[#2f7d4f]" : "bg-[#b91c1c]"}`}
                            />
                          </div>

                          {/* Plain English Reason */}
                          <p className="text-[11px] text-[#6b6459] pl-5 leading-normal">
                            {factor.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Tree Branch Trace */}
                {selectedFlow.xai_explanation.decision_tree_steps && selectedFlow.xai_explanation.decision_tree_steps.length > 0 && (
                  <div className="p-3 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-sm space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-[#1a1815]">
                      <Terminal className="w-3.5 h-3.5 text-[#1a1815]" />
                      <span>Decision Tree Path Trace</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-[#6b6459] overflow-hidden">
                      {selectedFlow.xai_explanation.decision_tree_steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 min-w-0">
                          <ChevronRight className="w-3 h-3 mt-0.5 text-[#f7b955] shrink-0" />
                          <span className={`break-all min-w-0 ${idx === selectedFlow.xai_explanation!.decision_tree_steps.length - 1 ? "font-bold text-[#1a1815]" : ""}`}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Defensive Action */}
                <div className="p-3 rounded border border-[#1a1815] bg-[#fdfbf7] flex items-start gap-2 text-xs">
                  <Activity className="w-4 h-4 text-[#c2410c] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#1a1815] font-mono text-[11px] uppercase tracking-wider block">
                      Recommended Defensive Action
                    </span>
                    <span className="text-[#6b6459] text-[11px] leading-relaxed">
                      {selectedFlow.xai_explanation.recommended_action}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 25 Statistical Features Extracted for Decision Tree */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#1a1815] uppercase font-mono tracking-wider flex items-center justify-between pb-1 border-b border-[#d6cfc0]">
              <span>Statistical Features (25)</span>
              <span className="text-[10px] text-[#6b6459] font-normal">CIC-IDS Standard</span>
            </h4>

            {selectedFlow.features_25 ? (
              <div className="rounded border border-[#1a1815] bg-[#ffffff] divide-y divide-[#d6cfc0] overflow-hidden text-xs font-mono">
                {Object.entries(selectedFlow.features_25).map(([feat, val]) => (
                  <div key={feat} className="flex items-center justify-between py-2 px-3 hover:bg-[#f4f1ea] transition gap-3 min-w-0">
                    <span className="text-[#6b6459] font-medium truncate min-w-0" title={feat}>
                      {feat}
                    </span>
                    <span className="text-[#1a1815] font-bold tabular-nums text-right shrink-0">
                      {typeof val === "number" ? (Number.isInteger(val) ? val.toLocaleString() : val.toFixed(4)) : val}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded border border-[#1a1815] bg-[#ffffff] text-center text-[#6b6459] text-xs font-mono">
                No features cached for this flow.
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);
}
