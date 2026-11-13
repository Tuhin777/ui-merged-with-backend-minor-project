"use client";

import React, { useState } from "react";
import { PacketRecord } from "@/lib/api";
import { 
  Pause, 
  Play, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Globe
} from "lucide-react";

interface PacketsViewProps {
  packets: PacketRecord[];
}

export function PacketsView({ packets }: PacketsViewProps) {
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [expandedPacketId, setExpandedPacketId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [protocolFilter, setProtocolFilter] = useState<string>("ALL");

  const filteredPackets = packets.filter((pkt) => {
    const matchesSearch =
      searchTerm === "" ||
      pkt.src_ip.includes(searchTerm) ||
      pkt.dst_ip.includes(searchTerm) ||
      pkt.src_port.toString().includes(searchTerm) ||
      pkt.dst_port.toString().includes(searchTerm);

    const matchesProtocol =
      protocolFilter === "ALL" || pkt.transport_protocol.toUpperCase() === protocolFilter;

    return matchesSearch && matchesProtocol;
  });

  const getEntropyColor = (entropy: number) => {
    if (entropy < 3.0) return "text-[#2f7d4f] bg-[#f0fdf4] border-[#2f7d4f]";
    if (entropy < 6.5) return "text-[#8a4b00] bg-[#fefce8] border-[#f7b955]";
    return "text-[#1a1815] bg-[#f4f1ea] border-[#1a1815] font-bold";
  };

  return (
    <div className="space-y-4">
      {/* Control & Filter Bar */}
      <div className="p-3 sm:p-4 rounded border border-[#1a1815] bg-[#ffffff] press-shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72 md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6459]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by IP address or port..."
            className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded pl-9 pr-3 py-2 text-xs font-mono text-[#1a1815] focus:outline-none focus:ring-2 focus:ring-[#f7b955]"
          />
        </div>

        {/* Protocol Filter & Pause Stream Button */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {["ALL", "TCP", "UDP"].map((proto) => (
              <button
                key={proto}
                onClick={() => setProtocolFilter(proto)}
                className={`px-2.5 py-1.5 rounded border transition cursor-pointer font-bold ${
                  protocolFilter === proto
                    ? "bg-[#1a1815] text-[#ffffff] border-[#1a1815] press-shadow-sm"
                    : "bg-[#f4f1ea] border-[#d6cfc0] text-[#6b6459] hover:text-[#1a1815]"
                }`}
              >
                {proto}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer border border-[#1a1815] press-shadow-sm ${
              isPaused
                ? "bg-[#f7b955] text-[#1a1815]"
                : "bg-[#ffffff] hover:bg-[#f4f1ea] text-[#1a1815]"
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            <span className="whitespace-nowrap">{isPaused ? "Resume Stream" : "Pause Stream"}</span>
          </button>
        </div>
      </div>

      {/* Raw Packet Stream Table */}
      <div className="rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow overflow-hidden">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full min-w-[880px] text-xs font-mono text-left">
            <thead className="text-[#6b6459] border-b-2 border-[#1a1815] bg-[#f4f1ea]">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center font-bold">#</th>
                <th className="py-2.5 px-3 font-bold">Timestamp</th>
                <th className="py-2.5 px-3 font-bold">Source Endpoint</th>
                <th className="py-2.5 px-3 font-bold">Destination Endpoint</th>
                <th className="py-2.5 px-3 font-bold">Proto</th>
                <th className="py-2.5 px-3 font-bold">Length</th>
                <th className="py-2.5 px-3 font-bold">Entropy (0-8)</th>
                <th className="py-2.5 px-3 font-bold">TCP Flags</th>
                <th className="py-2.5 px-3 text-right font-bold">IAT (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d6cfc0]">
              {filteredPackets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#6b6459] font-mono">
                    {packets.length === 0
                      ? "No packets captured yet. Start live sniffing or replay a PCAP."
                      : "No packets matching current search criteria."}
                  </td>
                </tr>
              ) : (
                filteredPackets.map((pkt, idx) => {
                  const isExpanded = expandedPacketId === pkt.id;
                  const flags = pkt.tcp_flags;
                  // Combine id + timestamp + array index so keys stay unique
                  // even when pkt.id resets between capture sessions
                  const rowKey = `${pkt.id}-${pkt.timestamp}-${idx}`;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={() => setExpandedPacketId(isExpanded ? null : pkt.id)}
                        className={`hover:bg-[#f4f1ea] cursor-pointer transition ${
                          isExpanded ? "bg-[#fefce8]" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-[#6b6459] flex items-center justify-center gap-1">
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-[#1a1815]" /> : <ChevronRight className="w-3 h-3 text-[#6b6459]" />}
                          <span>{pkt.id}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#6b6459]">
                          {new Date(pkt.timestamp * 1000).toISOString().split("T")[1]?.slice(0, 12) || pkt.timestamp.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-[#1a1815] font-semibold">
                          <div>{pkt.src_ip}:{pkt.src_port}</div>
                          {pkt.src_host && pkt.src_host !== pkt.src_ip && (
                            <div className="text-[10px] text-[#2f7d4f] font-mono flex items-center gap-1 truncate max-w-[140px]">
                              <Globe className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{pkt.src_host}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#1a1815]">
                          <div>{pkt.dst_ip}:{pkt.dst_port}</div>
                          {pkt.dst_host && pkt.dst_host !== pkt.dst_ip && (
                            <div className="text-[10px] text-[#6b6459] font-mono flex items-center gap-1 truncate max-w-[140px]">
                              <Globe className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{pkt.dst_host}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#1a1815] font-semibold">
                            {pkt.transport_protocol}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#1a1815] font-bold">
                          {pkt.length} B
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getEntropyColor(pkt.entropy)}`}>
                            {pkt.entropy.toFixed(3)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            {flags?.syn ? <span className="px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#ffffff] text-[#1a1815] text-[10px] font-bold">SYN</span> : null}
                            {flags?.ack ? <span className="px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#f0fdf4] text-[#2f7d4f] text-[10px] font-bold">ACK</span> : null}
                            {flags?.psh ? <span className="px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#fefce8] text-[#8a4b00] text-[10px] font-bold">PSH</span> : null}
                            {flags?.rst ? <span className="px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#fff1f2] text-[#b91c1c] text-[10px] font-bold">RST</span> : null}
                            {flags?.fin ? <span className="px-1.5 py-0.2 rounded border border-[#1a1815] bg-[#f4f1ea] text-[#6b6459] text-[10px] font-bold">FIN</span> : null}
                            {!flags?.syn && !flags?.ack && !flags?.psh && !flags?.rst && !flags?.fin ? (
                              <span className="text-[#6b6459]">-</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#6b6459] font-mono">
                          {(pkt.iat * 1000).toFixed(2)}
                        </td>
                      </tr>

                      {/* Expanded JSON Inspector */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-4 bg-[#f4f1ea] border-y-2 border-[#1a1815]">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-[#1a1815] font-mono">
                                <span className="font-bold">Packet #{pkt.id} Raw Feature Attributes</span>
                                <span className="text-[#6b6459]">Shannon Entropy: {pkt.entropy} bits/byte</span>
                              </div>
                              <pre className="p-3 rounded border border-[#1a1815] bg-[#ffffff] text-[#1a1815] text-xs font-mono overflow-x-auto press-shadow-sm">
                                {JSON.stringify(pkt, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
