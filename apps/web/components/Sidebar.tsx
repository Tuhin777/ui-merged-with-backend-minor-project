"use client";

import React from "react";
import { 
  LayoutDashboard, 
  Radio, 
  Workflow, 
  Binary, 
  Cpu, 
  BarChart3,
  FlaskConical,
  X,
  ChevronLeft,
  ChevronRight,
  Activity
} from "lucide-react";
import { SystemStatus } from "@/lib/api";

export type TabType = "overview" | "analytics" | "capture" | "flows" | "packets" | "model" | "lab";

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  status: SystemStatus | null;
  backendOnline: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ 
  currentTab, 
  onTabChange, 
  status, 
  backendOnline,
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const totalThreats = (status?.threat_counts["FTP-BruteForce"] || 0) + (status?.threat_counts["SSH-Bruteforce"] || 0);

  const navItems = [
    {
      id: "overview" as TabType,
      label: "Overview",
      shortLabel: "Overview",
      description: "Telemetry & health",
      icon: LayoutDashboard,
    },
    {
      id: "analytics" as TabType,
      label: "Session Analytics",
      shortLabel: "Analytics",
      description: "Forensics & Benchmark",
      icon: BarChart3,
      badge: totalThreats > 0 ? `${totalThreats} Alert` : undefined,
      isThreatBadge: totalThreats > 0,
    },
    {
      id: "capture" as TabType,
      label: "Capture & PCAP",
      shortLabel: "Capture",
      description: "Interface & file replay",
      icon: Radio,
    },
    {
      id: "flows" as TabType,
      label: "Flow Explorer",
      shortLabel: "Flows",
      description: "5-tuple conversations",
      icon: Workflow,
      badge: status?.active_flows ? status.active_flows.toString() : undefined,
    },
    {
      id: "packets" as TabType,
      label: "Packet Inspector",
      shortLabel: "Packets",
      description: "Raw packets & entropy",
      icon: Binary,
      badge: status?.total_packets ? status.total_packets.toString() : undefined,
    },
    {
      id: "model" as TabType,
      label: "ML Studio",
      shortLabel: "ML Studio",
      description: "Decision Tree testing",
      icon: Cpu,
    },
    {
      id: "lab" as TabType,
      label: "Cyber Lab",
      shortLabel: "Lab",
      description: "Attack simulator & drill",
      icon: FlaskConical,
    },
  ];

  const handleNavClick = (tab: TabType) => {
    onTabChange(tab);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-[#1a1815]/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          w-72 max-w-[85vw]
          border-r-2 border-[#1a1815] bg-[#f4f1ea] 
          flex flex-col justify-between shrink-0
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Top Header on Mobile / Drawer */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="p-3 sm:p-4 border-b border-[#d6cfc0] lg:hidden flex items-center justify-between bg-[#ffffff]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded border border-[#1a1815] bg-[#f7b955] flex items-center justify-center press-shadow-sm text-[#1a1815]">
                <Activity className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="font-bold text-xs font-mono text-[#1a1815] tracking-tight">
                DPI Studio Menu
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded border border-[#1a1815] bg-[#f4f1ea] hover:bg-[#eae5d9] text-[#1a1815] press-shadow-sm transition cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Section */}
          <div className="p-3 sm:p-4 space-y-1.5 overflow-y-auto flex-1">
            <div className={`px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-[#6b6459] font-bold flex items-center justify-between ${isCollapsed ? "lg:hidden" : ""}`}>
              <span>Navigation</span>
              <span className="text-[10px] text-[#6b6459] font-normal hidden lg:inline">6 views</span>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={`w-full text-left rounded transition flex items-center group cursor-pointer ${
                    isCollapsed ? "lg:justify-center lg:px-2 lg:py-3" : "justify-between px-3.5 py-2.5"
                  } ${
                    isActive
                      ? "bg-[#ffffff] text-[#1a1815] border border-[#1a1815] press-shadow-sm font-semibold"
                      : "text-[#6b6459] hover:text-[#1a1815] hover:bg-[#ffffff]/70 border border-transparent"
                  }`}
                >
                  <div className={`flex items-center gap-3 ${isCollapsed ? "lg:gap-0" : ""}`}>
                    <Icon className={`w-4 h-4 shrink-0 transition ${isActive ? "text-[#1a1815]" : "text-[#6b6459] group-hover:text-[#1a1815]"}`} />
                    <div className={isCollapsed ? "lg:hidden" : ""}>
                      <div className="text-sm font-medium tracking-tight leading-none mb-1">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#6b6459]">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#1a1815] shrink-0 ${
                      isCollapsed ? "lg:hidden" : ""
                    } ${
                      item.isThreatBadge
                        ? "bg-[#b91c1c] text-white font-bold animate-pulse"
                        : isActive 
                          ? "bg-[#f7b955] text-[#1a1815] font-bold" 
                          : "bg-[#ffffff] text-[#1a1815]"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {/* Collapsed view indicator dot for badges */}
                  {item.badge && isCollapsed && (
                    <span className={`hidden lg:block absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                      item.isThreatBadge ? "bg-[#b91c1c] animate-pulse" : "bg-[#f7b955]"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <div className="hidden lg:block px-3 py-2 border-t border-[#d6cfc0]">
              <button
                onClick={onToggleCollapse}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="w-full py-1.5 px-2 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] text-xs font-mono font-bold flex items-center justify-center gap-2 press-shadow-sm transition cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <>
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Collapse Bar</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Backend & Model Health Footer */}
        <div className={`p-3 sm:p-4 border-t-2 border-[#1a1815] bg-[#ffffff]/70 space-y-2 text-xs shrink-0 ${isCollapsed ? "lg:p-2 lg:text-center" : ""}`}>
          <div className={`flex items-center justify-between ${isCollapsed ? "lg:flex-col lg:gap-1" : ""}`}>
            <span className={`text-[#6b6459] font-mono text-[11px] ${isCollapsed ? "lg:hidden" : ""}`}>API Engine</span>
            <span className="flex items-center gap-1.5 font-medium">
              {backendOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#2f7d4f] shrink-0"></span>
                  <span className={`text-[#2f7d4f] font-mono text-[11px] font-bold ${isCollapsed ? "lg:hidden" : ""}`}>Online (8000)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#b91c1c] shrink-0"></span>
                  <span className={`text-[#b91c1c] font-mono text-[11px] font-bold ${isCollapsed ? "lg:hidden" : ""}`}>Offline</span>
                </>
              )}
            </span>
          </div>

          <div className={`flex items-center justify-between ${isCollapsed ? "lg:hidden" : ""}`}>
            <span className="text-[#6b6459] font-mono text-[11px]">ML Model</span>
            <span className="font-mono text-[11px] text-[#1a1815] font-semibold truncate max-w-[120px]">
              {status?.model_loaded ? "DecisionTree (25F)" : "Not Loaded"}
            </span>
          </div>

          <div className={`pt-2 border-t border-[#d6cfc0] text-[10px] text-[#6b6459] font-mono flex items-center justify-between ${isCollapsed ? "lg:hidden" : ""}`}>
            <span>KGEC 25-27</span>
            <span>Pressworks</span>
          </div>
        </div>
      </aside>
    </>
  );
}
