"use client";

/**
 * DPIPipelineAnimation
 * -------------------------------------------------
 * A fluid 4-stage DPI pipeline visualizer.
 *   SVG  → stage boxes + bus lines (ink borders, Pressworks theme)
 *   Canvas overlay → animated particle dots flowing left-to-right
 *   CSS @keyframes  → stage pulse glow / idle breathing / threat flash
 *
 * Props bind directly to live WebSocket data from the parent.
 */

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Radio, Filter, Layers, Cpu, ShieldAlert } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThreatCounts {
  Benign: number;
  "FTP-BruteForce": number;
  "SSH-Bruteforce": number;
  Other?: number;
}

export interface DPIPipelineAnimationProps {
  isCapturing: boolean;
  packetRate: number;
  totalPackets: number;
  threatCounts: ThreatCounts;
  activeInterface: string | null;
}

// ─── Particle Engine ─────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  targetX: number;
  speed: number;
  color: string;
  size: number;
  opacity: number;
  trail: number; // length of trailing glow
}

// Bus Y positions (percent of canvas height) — one per inter-stage gap
const BUS_Y_RATIO = 0.5; // vertical center

// Stage X centers as fractions of total width
const STAGE_X_FRACS = [0.1, 0.35, 0.615, 0.875];
const STAGE_COUNT = 4;

const BENIGN_COLOR = "#f7b955";
const THREAT_COLOR = "#b91c1c";
const SAFE_COLOR   = "#2f7d4f";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DPIPipelineAnimation({
  isCapturing,
  packetRate,
  totalPackets,
  threatCounts,
  activeInterface,
}: DPIPipelineAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const stateRef     = useRef({ isCapturing, packetRate, threatCounts });

  // Keep stateRef in sync without triggering re-renders
  useEffect(() => {
    stateRef.current = { isCapturing, packetRate, threatCounts };
  }, [isCapturing, packetRate, threatCounts]);

  // Threat ratio (0–1) — drives particle color split
  const totalThreats = (threatCounts["FTP-BruteForce"] ?? 0) + (threatCounts["SSH-Bruteforce"] ?? 0);
  const totalClassified = (threatCounts.Benign ?? 0) + totalThreats;
  const threatRatio = totalClassified > 0 ? totalThreats / totalClassified : 0;

  // Stage states for SVG classes
  const hasThreat = totalThreats > 0;

  // ── Canvas animation loop ──────────────────────────────────────────────────

  const spawnParticle = useCallback((canvasWidth: number, canvasHeight: number) => {
    const { packetRate: rate, threatCounts: tc } = stateRef.current;

    const totT = (tc["FTP-BruteForce"] ?? 0) + (tc["SSH-Bruteforce"] ?? 0);
    const totB = tc.Benign ?? 0;
    const totAll = totT + totB;
    const tRatio = totAll > 0 ? totT / totAll : 0;
    const isThisAThreat = Math.random() < tRatio;

    const color = isThisAThreat ? THREAT_COLOR : BENIGN_COLOR;
    const speed = lerp(1.2, 3.8, clamp(rate / 300, 0, 1));

    particlesRef.current.push({
      x: STAGE_X_FRACS[0] * canvasWidth + 28, // start just past Stage 1
      y: BUS_Y_RATIO * canvasHeight + (Math.random() - 0.5) * 10,
      targetX: canvasWidth * (STAGE_X_FRACS[STAGE_COUNT - 1] + 0.07),
      speed: speed + Math.random() * 0.6,
      color,
      size: isThisAThreat ? 4.5 : 3.5,
      opacity: 0.95,
      trail: isThisAThreat ? 18 : 12,
    });
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { isCapturing: live, packetRate: rate } = stateRef.current;
    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Draw bus line glow (subtle horizontal track)
    const busY = BUS_Y_RATIO * H;
    const x0 = STAGE_X_FRACS[0] * W + 28;
    const x1 = STAGE_X_FRACS[STAGE_COUNT - 1] * W - 28;

    if (live) {
      const grd = ctx.createLinearGradient(x0, busY, x1, busY);
      grd.addColorStop(0,   "rgba(247, 185, 85, 0.08)");
      grd.addColorStop(0.5, "rgba(247, 185, 85, 0.18)");
      grd.addColorStop(1,   "rgba(247, 185, 85, 0.06)");
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(x0, busY);
      ctx.lineTo(x1, busY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Update & draw particles
    const alive: Particle[] = [];
    for (const p of particlesRef.current) {
      p.x += p.speed;
      // Fade out near the end
      if (p.x > p.targetX - 50) {
        p.opacity -= 0.03;
      }
      if (p.opacity <= 0 || p.x > p.targetX + 10) continue;

      // Draw trail
      const grad = ctx.createLinearGradient(p.x - p.trail, p.y, p.x, p.y);
      grad.addColorStop(0, p.color + "00");
      grad.addColorStop(1, p.color + Math.round(p.opacity * 255).toString(16).padStart(2, "0"));
      ctx.beginPath();
      ctx.moveTo(p.x - p.trail, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.size * 0.6;
      ctx.stroke();

      // Draw dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, "0");
      ctx.shadowColor  = p.color;
      ctx.shadowBlur   = 8;
      ctx.fill();
      ctx.shadowBlur   = 0;

      alive.push(p);
    }
    particlesRef.current = alive;

    // Spawn new particles when capturing
    if (live) {
      // Max ~1 particle per frame at 60fps at high rate; scale down at low rate
      const spawnProb = clamp(rate / 60, 0.05, 1.5);
      if (Math.random() < spawnProb) {
        spawnParticle(W, H);
      }
      // Extra burst at very high rates
      if (rate > 200 && Math.random() < 0.4) {
        spawnParticle(W, H);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [spawnParticle]);

  // Start / stop animation loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // Resize canvas to match container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    const obs = new ResizeObserver(resize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────

  const fmtRate = packetRate > 0
    ? `${packetRate >= 1000 ? (packetRate / 1000).toFixed(1) + "k" : packetRate} pkt/s`
    : "0 pkt/s";

  const fmtTotal = totalPackets >= 1_000_000
    ? `${(totalPackets / 1_000_000).toFixed(2)}M`
    : totalPackets >= 1000
    ? `${(totalPackets / 1000).toFixed(1)}k`
    : String(totalPackets);

  // ── Stage definitions ──────────────────────────────────────────────────────

  const stages = useMemo(() => [
    {
      id: "adapter",
      label: "Network Adapter",
      sub: activeInterface || "Wi-Fi",
      icon: Radio,
      active: isCapturing,
      threat: false,
    },
    {
      id: "parser",
      label: "Packet Parser",
      sub: "PyShark / tshark",
      icon: Filter,
      active: isCapturing,
      threat: false,
    },
    {
      id: "extractor",
      label: "Feature Extractor",
      sub: "26 DPI features",
      icon: Layers,
      active: isCapturing,
      threat: false,
    },
    {
      id: "dt",
      label: "Decision Tree",
      sub: hasThreat ? `${totalThreats} threat${totalThreats !== 1 ? "s" : ""}` : "Benign traffic",
      icon: Cpu,
      active: isCapturing,
      threat: hasThreat,
    },
  ], [isCapturing, hasThreat, totalThreats, activeInterface]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full rounded border-2 border-[#1a1815] press-shadow overflow-hidden bg-[#f4f1ea]">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b-2 border-[#1a1815] bg-[#1a1815]">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {isCapturing ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f7b955] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f7b955]" />
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-[#6b6459]" />
          )}
          <span className="font-mono font-black text-xs text-[#f4f1ea] tracking-widest uppercase">
            DPI Pipeline
          </span>
          {isCapturing && (
            <span className="font-mono text-[10px] text-[#f7b955] font-bold animate-pulse">
              ● LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px] flex-wrap">
          <span className="text-[#d6cfc0]">
            <span className="text-[#f7b955] font-black">{fmtRate}</span>
          </span>
          <span className="text-[#d6cfc0]">
            <span className="text-[#f4f1ea] font-black">{fmtTotal}</span>{" "}
            <span className="text-[#6b6459] hidden xs:inline">packets</span>
          </span>
          {hasThreat && (
            <span className="flex items-center gap-1 text-[#ff7b7b] font-black animate-[threatPulse_0.9s_ease-in-out_infinite]">
              <ShieldAlert className="w-3 h-3" />
              {totalThreats} threat{totalThreats !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Pipeline canvas area with mobile scroll preservation */}
      <div className="w-full overflow-x-auto scrollbar-none">
        <div
          ref={containerRef}
          className="relative bg-dotted min-w-[700px] lg:min-w-0 w-full"
          style={{ height: 180 }}
        >
        {/* SVG stage nodes */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 180"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {/* Bus connector lines */}
          {[0, 1, 2].map((i) => {
            const x0 = STAGE_X_FRACS[i]     * 1000 + 68;
            const x1 = STAGE_X_FRACS[i + 1] * 1000 - 68;
            const y  = BUS_Y_RATIO * 180;
            return (
              <g key={i}>
                {/* Background track */}
                <line
                  x1={x0} y1={y} x2={x1} y2={y}
                  stroke="#d6cfc0"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                {/* Arrow head */}
                <polygon
                  points={`${x1 - 1},${y - 6} ${x1 + 9},${y} ${x1 - 1},${y + 6}`}
                  fill={isCapturing ? "#f7b955" : "#d6cfc0"}
                  style={{ transition: "fill 0.4s" }}
                />
              </g>
            );
          })}

          {/* Stage boxes */}
          {stages.map((stage, i) => {
            const cx = STAGE_X_FRACS[i] * 1000;
            const cy = BUS_Y_RATIO * 180;
            const bw = 136, bh = 90;
            const bx = cx - bw / 2;
            const by = cy - bh / 2;
            const Icon = stage.icon;

            const bgColor = !stage.active
              ? "#f4f1ea"
              : stage.threat
              ? "#fff1f2"
              : "#fffef5";

            const borderColor = stage.threat
              ? "#b91c1c"
              : stage.active
              ? "#f7b955"
              : "#1a1815";

            const animClass = stage.threat
              ? "stage-threat"
              : stage.active
              ? "stage-active"
              : "";

            return (
              <g key={stage.id} className={animClass}>
                {/* Stage box */}
                <rect
                  x={bx} y={by}
                  width={bw} height={bh}
                  rx="4" ry="4"
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth="2"
                  style={{ transition: "fill 0.5s, stroke 0.3s" }}
                />
                {/* Press shadow effect */}
                <rect
                  x={bx + 3} y={by + 3}
                  width={bw} height={bh}
                  rx="4" ry="4"
                  fill="none"
                  stroke="#1a1815"
                  strokeWidth="1.5"
                  opacity="0.15"
                />

                {/* Icon badge */}
                <rect
                  x={cx - 14} y={cy - 36}
                  width={28} height={22}
                  rx="3"
                  fill={stage.threat ? "#b91c1c" : stage.active ? "#f7b955" : "#1a1815"}
                  style={{ transition: "fill 0.4s" }}
                />

                {/* Stage number badge */}
                <text
                  x={bx + 7} y={by + 13}
                  fontFamily="monospace"
                  fontSize="8"
                  fontWeight="bold"
                  fill={borderColor}
                  opacity="0.7"
                >
                  {String(i + 1).padStart(2, "0")}
                </text>

                {/* Stage label */}
                <text
                  x={cx} y={cy + 10}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#1a1815"
                >
                  {stage.label}
                </text>

                {/* Sub label */}
                <text
                  x={cx} y={cy + 25}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="8.5"
                  fill={stage.threat ? "#b91c1c" : "#6b6459"}
                  style={{ transition: "fill 0.4s" }}
                >
                  {stage.sub}
                </text>

                {/* Activity dot */}
                {stage.active && (
                  <circle
                    cx={bx + bw - 10}
                    cy={by + 10}
                    r={4}
                    fill={stage.threat ? "#b91c1c" : "#2f7d4f"}
                  >
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur={stage.threat ? "0.6s" : "1.4s"}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="r"
                      values="4;5.5;4"
                      dur={stage.threat ? "0.6s" : "1.4s"}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Canvas overlay — particle engine */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Idle overlay */}
        {!isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded border border-[#d6cfc0] bg-[#f4f1ea]/80 backdrop-blur-[1px]">
              <p className="font-mono text-xs text-[#6b6459] text-center">
                Start a capture session to activate the pipeline
              </p>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Bottom stats ticker */}
      <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 border-t-2 border-[#1a1815] bg-[#ffffff] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-3 sm:gap-4 font-mono text-[10px] sm:text-[11px] text-[#6b6459] shrink-0">
          {/* Scrolling stats */}
          <span className="shrink-0">
            <span className="font-black text-[#1a1815]">{fmtTotal}</span> pkts
          </span>
          <span className="text-[#d6cfc0] shrink-0">|</span>
          <span className="shrink-0">
            Iface:{" "}
            <span className="font-black text-[#1a1815]">{activeInterface || "—"}</span>
          </span>
          <span className="text-[#d6cfc0] shrink-0">|</span>
          <span className="shrink-0">
            Benign:{" "}
            <span className="font-black text-[#2f7d4f]">{threatCounts.Benign ?? 0}</span>
          </span>
          <span className="text-[#d6cfc0] shrink-0">|</span>
          <span className="shrink-0">
            FTP:{" "}
            <span className="font-black text-[#b91c1c]">{threatCounts["FTP-BruteForce"] ?? 0}</span>
          </span>
          <span className="text-[#d6cfc0] shrink-0">|</span>
          <span className="shrink-0">
            SSH:{" "}
            <span className="font-black" style={{ color: "#8a4b00" }}>{threatCounts["SSH-Bruteforce"] ?? 0}</span>
          </span>
        </div>

        {/* Threat ratio pill */}
        <div className="shrink-0 flex items-center gap-1.5 ml-auto">
          <div className="flex h-2 w-16 sm:w-24 rounded-full border border-[#1a1815] overflow-hidden bg-[#f4f1ea]">
            <div
              className="h-full bg-[#2f7d4f] transition-all duration-700"
              style={{ width: `${(1 - threatRatio) * 100}%` }}
            />
            <div
              className="h-full bg-[#b91c1c] transition-all duration-700"
              style={{ width: `${threatRatio * 100}%` }}
            />
          </div>
          <span className="font-mono text-[9px] sm:text-[10px] text-[#6b6459] whitespace-nowrap">
            {totalClassified > 0
              ? `${((1 - threatRatio) * 100).toFixed(0)}% safe`
              : "awaiting"}
          </span>
        </div>
      </div>
    </div>
  );
}
