"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Sidebar, TabType } from "@/components/Sidebar";
import { OverviewView } from "@/components/views/OverviewView";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import { CaptureView } from "@/components/views/CaptureView";
import { FlowsView } from "@/components/views/FlowsView";
import { PacketsView } from "@/components/views/PacketsView";
import { MLStudioView } from "@/components/views/MLStudioView";
import { LabView } from "@/components/views/LabView";
import { 
  SystemStatus, 
  FlowSummary, 
  PacketRecord, 
  fetchStatus, 
  fetchFlows, 
  fetchPackets, 
  WS_BASE_URL 
} from "@/lib/api";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<TabType>("overview");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [packets, setPackets] = useState<PacketRecord[]>([]);
  const [selectedFlowKey, setSelectedFlowKey] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [packetRate, setPacketRate] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Deep link sync on page load (?tab=lab or #lab)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as TabType | null;
      const hashParam = window.location.hash.replace("#", "") as TabType | null;
      const validTabs: TabType[] = ["overview", "analytics", "capture", "flows", "packets", "model", "lab"];
      if (tabParam && validTabs.includes(tabParam)) {
        setCurrentTab(tabParam);
      } else if (hashParam && validTabs.includes(hashParam)) {
        setCurrentTab(hashParam);
      }
    }
  }, []);

  // Initial and periodic polling to keep status & tables fresh
  const refreshData = async () => {
    try {
      const [statusRes, flowsRes, packetsRes] = await Promise.all([
        fetchStatus(),
        fetchFlows(),
        fetchPackets(150),
      ]);
      setStatus(statusRes);
      setFlows(flowsRes.flows);
      setPackets(packetsRes.packets);
      setIsCapturing(statusRes.status === "capturing");
      setBackendOnline(true);
    } catch (err) {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for instantaneous telemetry events
  useEffect(() => {
    let ws: WebSocket;
    const connectWS = () => {
      try {
        ws = new WebSocket(WS_BASE_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setBackendOnline(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "packet") {
              setPackets((prev) => {
                // Deduplicate: a packet is unique by id+timestamp combo.
                // This prevents duplicate React keys when id counters reset
                // between capture sessions or the WS re-delivers a packet.
                const incoming = msg.data;
                const dedupeKey = `${incoming.id}-${incoming.timestamp}`;
                if (prev.some((p) => `${p.id}-${p.timestamp}` === dedupeKey)) {
                  return prev; // already in list — skip
                }
                return [incoming, ...prev.slice(0, 199)];
              });
              if (msg.stats) {
                setStatus((prev) => prev ? {
                  ...prev,
                  total_packets: msg.stats.total_packets,
                  total_bytes: msg.stats.total_bytes,
                  active_flows: msg.stats.active_flows,
                  threat_counts: msg.stats.threat_counts,
                  packet_rate: msg.stats.packet_rate ?? 0,
                  duration_seconds: msg.stats.duration_seconds !== undefined ? msg.stats.duration_seconds : prev.duration_seconds,
                  remaining_seconds: msg.stats.remaining_seconds !== undefined ? msg.stats.remaining_seconds : prev.remaining_seconds,
                } : null);
                // Update live packet rate
                if (msg.stats.packet_rate !== undefined) {
                  setPacketRate(msg.stats.packet_rate);
                }
              }
            } else if (msg.type === "timer_tick") {
              setStatus((prev) => prev ? {
                ...prev,
                duration_seconds: msg.duration_seconds,
                remaining_seconds: msg.remaining_seconds,
              } : null);
            } else if (msg.type === "capture_stopped") {
              setIsCapturing(false);
              setStatus((prev) => prev ? {
                ...prev,
                status: "idle",
                remaining_seconds: null,
                duration_seconds: null,
              } : null);
              refreshData();
            }
          } catch (e) {
            console.error("WS Parse error:", e);
          }
        };

        ws.onclose = () => {
          setTimeout(connectWS, 4000);
        };
      } catch (err) {
        setTimeout(connectWS, 5000);
      }
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleInspectFlow = (flowKey: string) => {
    setSelectedFlowKey(flowKey);
    setCurrentTab("flows");
  };

  return (
    <div className="flex h-screen bg-[#f4f1ea] text-[#1a1815] overflow-hidden font-sans">
      {/* Sidebar Navigation (Responsive Drawer on mobile, collapsible on desktop) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSidebarOpen(false);
        }}
        status={status}
        backendOnline={backendOnline}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          status={status}
          onRefresh={refreshData}
          isCapturing={isCapturing}
          setIsCapturing={setIsCapturing}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* View Container with fluid responsive padding and max-width scaling */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 bg-dotted">
          <div className="max-w-full 2xl:max-w-[1700px] mx-auto w-full">
            {currentTab === "overview" && (
              <OverviewView
                status={status}
                recentFlows={flows}
                onNavigate={setCurrentTab}
                onInspectFlow={handleInspectFlow}
                onStartCapture={() => setCurrentTab("capture")}
                isCapturing={isCapturing}
                packetRate={packetRate}
              />
            )}

            {currentTab === "analytics" && (
              <AnalyticsView
                onInspectFlow={handleInspectFlow}
                onNavigate={setCurrentTab}
              />
            )}

            {currentTab === "capture" && (
              <CaptureView
                status={status}
                onRefresh={refreshData}
                isCapturing={isCapturing}
                setIsCapturing={setIsCapturing}
                packetRate={packetRate}
              />
            )}

            {currentTab === "flows" && (
              <FlowsView
                flows={flows}
                selectedFlowKey={selectedFlowKey}
                onSelectFlow={setSelectedFlowKey}
              />
            )}

            {currentTab === "packets" && (
              <PacketsView packets={packets} />
            )}

            {currentTab === "model" && (
              <MLStudioView />
            )}

            {currentTab === "lab" && (
              <LabView
                onNavigate={setCurrentTab}
                isCapturing={isCapturing}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
