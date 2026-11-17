"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as echarts from "echarts";
import { FlowSummary } from "@/lib/api";
import { Activity, ArrowRight, Layers, RefreshCw, BarChart2, ShieldAlert } from "lucide-react";

interface SankeyTrafficDiagramProps {
  flows?: FlowSummary[];
}

export function SankeyTrafficDiagram({ flows = [] }: SankeyTrafficDiagramProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [metricMode, setMetricMode] = useState<"bytes" | "packets">("bytes");

  // Transform live flows or realistic fallback into Sankey nodes and links
  const { nodes, links, totalVolume } = useMemo(() => {
    // If fewer than 2 active flows, provide realistic DPI inspection sample flows
    const activeFlows: FlowSummary[] =
      flows.length >= 2
        ? flows
        : [
            {
              key: "demo-1",
              forward_key: "demo-1-fwd",
              src_endpoint: "192.168.1.105:54210",
              dst_endpoint: "10.0.0.1:443",
              src_ip: "192.168.1.105",
              dst_ip: "10.0.0.1",
              transport_protocol: "TCP",
              protocol: 6,
              prediction: "Benign",
              confidence: 0.998,
              total_packets: 110,
              fwd_packets: 48,
              bwd_packets: 62,
              total_bytes: 84200,
              fwd_bytes: 32000,
              bwd_bytes: 52200,
              duration: 4.2,
              last_seen: Date.now(),
              probabilities: { Benign: 0.998, "FTP-BruteForce": 0.001, "SSH-Bruteforce": 0.001 }
            },
            {
              key: "demo-2",
              forward_key: "demo-2-fwd",
              src_endpoint: "192.168.1.105:54212",
              dst_endpoint: "10.0.0.1:80",
              src_ip: "192.168.1.105",
              dst_ip: "10.0.0.1",
              transport_protocol: "TCP",
              protocol: 6,
              prediction: "Benign",
              confidence: 0.994,
              total_packets: 42,
              fwd_packets: 18,
              bwd_packets: 24,
              total_bytes: 28400,
              fwd_bytes: 8400,
              bwd_bytes: 20000,
              duration: 2.1,
              last_seen: Date.now(),
              probabilities: { Benign: 0.994, "FTP-BruteForce": 0.003, "SSH-Bruteforce": 0.003 }
            },
            {
              key: "demo-3",
              forward_key: "demo-3-fwd",
              src_endpoint: "172.20.96.70:49210",
              dst_endpoint: "127.0.0.1:2222",
              src_ip: "172.20.96.70 (Drill Ingress)",
              dst_ip: "127.0.0.1",
              transport_protocol: "TCP",
              protocol: 6,
              prediction: "SSH-Bruteforce",
              confidence: 0.987,
              total_packets: 168,
              fwd_packets: 84,
              bwd_packets: 84,
              total_bytes: 42100,
              fwd_bytes: 21000,
              bwd_bytes: 21100,
              duration: 6.8,
              last_seen: Date.now(),
              probabilities: { Benign: 0.01, "FTP-BruteForce": 0.003, "SSH-Bruteforce": 0.987 }
            },
            {
              key: "demo-4",
              forward_key: "demo-4-fwd",
              src_endpoint: "172.20.96.70:49214",
              dst_endpoint: "127.0.0.1:2121",
              src_ip: "172.20.96.70 (Drill Ingress)",
              dst_ip: "127.0.0.1",
              transport_protocol: "TCP",
              protocol: 6,
              prediction: "FTP-BruteForce",
              confidence: 0.991,
              total_packets: 120,
              fwd_packets: 62,
              bwd_packets: 58,
              total_bytes: 31800,
              fwd_bytes: 16000,
              bwd_bytes: 15800,
              duration: 5.4,
              last_seen: Date.now(),
              probabilities: { Benign: 0.005, "FTP-BruteForce": 0.991, "SSH-Bruteforce": 0.004 }
            },
            {
              key: "demo-5",
              forward_key: "demo-5-fwd",
              src_endpoint: "127.0.0.1:58402",
              dst_endpoint: "127.0.0.1:8080",
              src_ip: "127.0.0.1 (Loopback)",
              dst_ip: "127.0.0.1",
              transport_protocol: "TCP",
              protocol: 6,
              prediction: "Benign",
              confidence: 0.999,
              total_packets: 26,
              fwd_packets: 12,
              bwd_packets: 14,
              total_bytes: 14500,
              fwd_bytes: 4500,
              bwd_bytes: 10000,
              duration: 1.2,
              last_seen: Date.now(),
              probabilities: { Benign: 0.999, "FTP-BruteForce": 0.0005, "SSH-Bruteforce": 0.0005 }
            },
            {
              key: "demo-6",
              forward_key: "demo-6-fwd",
              src_endpoint: "192.168.1.18:53210",
              dst_endpoint: "1.1.1.1:53",
              src_ip: "192.168.1.18",
              dst_ip: "1.1.1.1",
              transport_protocol: "UDP",
              protocol: 17,
              prediction: "Benign",
              confidence: 0.999,
              total_packets: 16,
              fwd_packets: 8,
              bwd_packets: 8,
              total_bytes: 1840,
              fwd_bytes: 920,
              bwd_bytes: 920,
              duration: 0.3,
              last_seen: Date.now(),
              probabilities: { Benign: 0.999, "FTP-BruteForce": 0.0005, "SSH-Bruteforce": 0.0005 }
            },
          ];

    const linkMap: Record<string, number> = {};
    const nodeSet = new Set<string>();

    let totalVal = 0;

    activeFlows.forEach((f) => {
      const src = f.src_ip || f.src_endpoint.split(":")[0] || "Unknown Client";
      const proto = f.transport_protocol ? `${f.transport_protocol} Protocol` : "TCP Protocol";

      // Port / Service mapping
      const port = f.dst_endpoint ? parseInt(f.dst_endpoint.split(":")[1]) || 80 : 80;
      let service = `Port ${port}`;
      if (port === 22 || port === 2222) service = `SSH (:${port})`;
      else if (port === 21 || port === 2121) service = `FTP (:${port})`;
      else if (port === 80 || port === 8080) service = `HTTP (:${port})`;
      else if (port === 443) service = `HTTPS (:443)`;
      else if (port === 53) service = `DNS (:53)`;

      const verdict = f.prediction ? `Verdict: ${f.prediction}` : "Verdict: Benign";

      const weight =
        metricMode === "bytes"
          ? (f.total_bytes || 500)
          : (f.total_packets || 1);

      totalVal += weight;

      // 3 Connected Conduits: Source -> Protocol -> Service -> Verdict
      const k1 = `${src}:::${proto}`;
      const k2 = `${proto}:::${service}`;
      const k3 = `${service}:::${verdict}`;

      linkMap[k1] = (linkMap[k1] || 0) + weight;
      linkMap[k2] = (linkMap[k2] || 0) + weight;
      linkMap[k3] = (linkMap[k3] || 0) + weight;

      nodeSet.add(src);
      nodeSet.add(proto);
      nodeSet.add(service);
      nodeSet.add(verdict);
    });

    const sankeyNodes = Array.from(nodeSet).map((name) => {
      let color = "#38bdf8"; // default cyan
      if (name.includes("Verdict: Benign")) color = "#10b981"; // green
      else if (name.includes("Verdict: SSH") || name.includes("Verdict: FTP") || name.includes("Brute")) color = "#ef4444"; // red
      else if (name.includes("Protocol")) color = "#a855f7"; // purple
      else if (name.includes("SSH") || name.includes("FTP") || name.includes("HTTP") || name.includes("Port")) color = "#f59e0b"; // amber

      return {
        name,
        itemStyle: {
          color,
          borderColor: color,
        },
      };
    });

    const sankeyLinks = Object.entries(linkMap).map(([key, value]) => {
      const [source, target] = key.split(":::");
      return {
        source,
        target,
        value,
      };
    });

    return { nodes: sankeyNodes, links: sankeyLinks, totalVolume: totalVal };
  }, [flows, metricMode]);

  // Initialize and Render ECharts
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark");
    }

    const chart = chartInstance.current;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(56, 189, 248, 0.3)",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: 12,
        },
        formatter: (params: any) => {
          if (params.dataType === "edge") {
            const val = params.value;
            const formatted =
              metricMode === "bytes"
                ? `${(val / 1024).toFixed(1)} KB`
                : `${val.toLocaleString()} packets`;
            return `
              <div style="font-weight: 700; margin-bottom: 4px; color: #38bdf8;">Conduit Traffic Flow</div>
              <div><b>From:</b> ${params.data.source}</div>
              <div><b>To:</b> ${params.data.target}</div>
              <div style="margin-top: 4px; color: #fbbf24;"><b>Volume:</b> ${formatted}</div>
            `;
          }
          return `<b>Node:</b> ${params.name}`;
        },
      },
      series: [
        {
          type: "sankey",
          orient: "horizontal",
          left: "4%",
          right: "12%",
          top: "8%",
          bottom: "8%",
          nodeWidth: 18,
          nodeGap: 18,
          draggable: true,
          data: nodes,
          links: links,
          emphasis: {
            focus: "adjacency",
          },
          lineStyle: {
            color: "gradient",
            curveness: 0.55,
            opacity: 0.38,
          },
          label: {
            color: "#e2e8f0",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 600,
            padding: [0, 8],
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [nodes, links, metricMode]);

  return (
    <div className="flex flex-col w-full rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl p-5 shadow-2xl">
      {/* Top Header & Metric Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Sankey Traffic Flow Conduits
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Apache ECharts
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive flow diagram: Source IPs ➔ Transport Protocols ➔ Target Ports ➔ ML Verdict
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/70 rounded-lg p-0.5 border border-slate-700/60">
            <button
              onClick={() => setMetricMode("bytes")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                metricMode === "bytes"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              By Bytes (KB)
            </button>
            <button
              onClick={() => setMetricMode("packets")}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                metricMode === "packets"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              By Packet Count
            </button>
          </div>
        </div>
      </div>

      {/* Sankey Canvas Container */}
      <div className="relative w-full h-[480px]">
        <div ref={chartRef} className="w-full h-full" />
      </div>

      {/* Diagram Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
            Source Endpoint
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
            Transport Protocol
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            Destination Service
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            Benign Verdict
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
            Brute-Force Threat
          </span>
        </div>

        <div className="text-slate-500">
          Tip: Drag any node vertically to re-order flow paths. Hover on links to inspect volume.
        </div>
      </div>
    </div>
  );
}
