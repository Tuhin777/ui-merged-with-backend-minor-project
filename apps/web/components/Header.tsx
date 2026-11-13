"use client";

import React, { useState } from "react";
import { SystemStatus, startCapture, stopCapture, resetSession } from "@/lib/api";
import { 
  Activity, 
  Play, 
  Square, 
  RotateCcw, 
  ShieldAlert, 
  Timer,
  Menu,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

interface HeaderProps {
  status: SystemStatus | null;
  onRefresh: () => void;
  isCapturing: boolean;
  setIsCapturing: (val: boolean) => void;
  onToggleSidebar?: () => void;
}

export function Header({ 
  status, 
  onRefresh, 
  isCapturing, 
  setIsCapturing,
  onToggleSidebar 
}: HeaderProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [quickDuration, setQuickDuration] = useState<string>("30");
  const { theme, toggleTheme } = useTheme();

  const handleStart = async () => {
    try {
      setLoadingAction("start");
      const iface = (status?.active_interface && !status.active_interface.startsWith("File:")) ? status.active_interface : "Wi-Fi";
      const dur = quickDuration === "continuous" ? undefined : parseInt(quickDuration, 10);
      await startCapture(iface, status?.bpf_filter || "ip or ip6", undefined, dur);
      setIsCapturing(true);
      onRefresh();
    } catch (err: any) {
      alert(`Start capture failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStop = async () => {
    try {
      setLoadingAction("stop");
      await stopCapture();
      setIsCapturing(false);
      onRefresh();
    } catch (err: any) {
      alert(`Stop capture failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all session packets and flows?")) return;
    try {
      setLoadingAction("reset");
      await resetSession();
      setIsCapturing(false);
      onRefresh();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const isLive = isCapturing || status?.status === "capturing";
  const totalThreats = (status?.threat_counts["FTP-BruteForce"] || 0) + (status?.threat_counts["SSH-Bruteforce"] || 0);

  return (
    <header className="h-16 border-b-2 border-[#1a1815] bg-[#f4f1ea] px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Brand & Identity + Mobile Menu Button */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#eae5d9] text-[#1a1815] press-shadow-sm transition cursor-pointer lg:hidden shrink-0"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded border border-[#1a1815] bg-[#f7b955] flex items-center justify-center press-shadow-sm text-[#1a1815] shrink-0">
          <Activity className="w-4 h-4 stroke-[2.5]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#1a1815] flex items-center gap-1.5 truncate">
              <span className="hidden sm:inline">KGEC DPI Intelligence</span>
              <span className="sm:hidden font-mono">DPI Intelligence</span>
              <span className="text-[9px] sm:text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#ffffff] text-[#1a1815] font-semibold shrink-0">
                v1.0
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-[#6b6459] truncate hidden md:block">Deep Packet Inspection & ML Flow Diagnostics</p>
        </div>
      </div>

      {/* Middle Status Tickers (Desktop / Tablet) */}
      <div className="hidden md:flex items-center gap-2.5 lg:gap-4 text-xs font-mono">
        <div className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1 rounded border border-[#1a1815] ${
          isLive 
            ? "bg-[#2f7d4f] text-white" 
            : "bg-[#ffffff] text-[#1a1815]"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? "bg-white animate-pulse" : "bg-[#6b6459]"}`} />
          <span className="uppercase tracking-wider font-semibold text-[11px]">
            {isLive ? "Capturing" : "Engine Idle"}
          </span>
          {status?.active_interface && (
            <span className="border-l border-current pl-2 opacity-80 hidden xl:inline">
              {status.active_interface}
            </span>
          )}
        </div>

        {/* Live Timer Countdown Pill */}
        {isLive && status?.remaining_seconds !== null && status?.remaining_seconds !== undefined && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border-2 border-[#1a1815] bg-[#f7b955] text-[#1a1815] font-bold font-mono press-shadow-sm animate-pulse text-[11px]">
            <Timer className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>⏱ {status.remaining_seconds}s</span>
          </div>
        )}

        {totalThreats > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#b91c1c] text-white border border-[#1a1815] font-semibold text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{totalThreats} Threat{totalThreats !== 1 ? "s" : ""}</span>
          </div>
        )}

        {status && (
          <div className="text-[#6b6459] px-1 hidden lg:block text-[11px]">
            Packets: <span className="text-[#1a1815] font-bold">{status.total_packets.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Mobile Live Indicator (when capturing on small screens) */}
      {isLive && (
        <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded border border-[#1a1815] bg-[#2f7d4f] text-white font-mono text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>
            {status?.remaining_seconds ? `${status.remaining_seconds}s` : "LIVE"}
          </span>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {isLive ? (
          <button
            onClick={handleStop}
            disabled={loadingAction === "stop"}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded border border-[#1a1815] bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-bold press-shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden xs:inline">Stop Capture</span>
            <span className="xs:hidden">Stop</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <select
              value={quickDuration}
              onChange={(e) => setQuickDuration(e.target.value)}
              disabled={loadingAction === "start"}
              className="bg-[#ffffff] text-[#1a1815] border border-[#1a1815] rounded px-1.5 sm:px-2 py-1.5 text-xs font-mono font-bold press-shadow-sm cursor-pointer focus:outline-none"
              title="Session duration limit"
            >
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="300">5m</option>
              <option value="continuous">Cont.</option>
            </select>
            <button
              onClick={handleStart}
              disabled={loadingAction === "start"}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] text-xs font-bold press-shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden xs:inline">Start Live</span>
              <span className="xs:hidden">Live</span>
            </button>
          </div>
        )}

        <button
          onClick={handleReset}
          disabled={loadingAction === "reset"}
          title="Reset session packets and flows"
          className="p-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] press-shadow-sm transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Cyber Dark Mode"}
          aria-label="Toggle theme mode"
          className="p-1.5 rounded border border-[#1a1815] bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815] press-shadow-sm transition cursor-pointer shrink-0"
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f7b955]" />
          ) : (
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1a1815]" />
          )}
        </button>
      </div>
    </header>
  );
}
