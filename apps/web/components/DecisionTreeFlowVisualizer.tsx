"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
  NodeProps,
  Edge,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchTreeGraph, TreeGraphResponse, TreeNodeData } from "@/lib/api";
import { 
  GitFork, 
  Search, 
  Layers, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  Maximize2,
  Info,
  Sliders,
  CheckCircle2
} from "lucide-react";

// ============================================================================
// Custom Decision Tree Node Component for React Flow
// ============================================================================
function DecisionTreeNode({ data, selected }: NodeProps) {
  const node = data as unknown as TreeNodeData;
  const isLeaf = node.is_leaf;
  const isThreat = node.prediction !== "Benign";

  // Class colors
  const borderClass = isLeaf
    ? node.prediction === "Benign"
      ? "border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
      : node.prediction === "FTP-BruteForce"
      ? "border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
      : "border-rose-500/60 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
    : selected
    ? "border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.3)] ring-1 ring-cyan-400"
    : "border-slate-700/60 hover:border-slate-500/80";

  const totalDist = Object.values(node.distribution || {}).reduce((a, b) => a + b, 0) || 1;
  const benignPct = Math.round(((node.distribution?.["Benign"] || 0) / totalDist) * 100);
  const ftpPct = Math.round(((node.distribution?.["FTP-BruteForce"] || 0) / totalDist) * 100);
  const sshPct = Math.round(((node.distribution?.["SSH-Bruteforce"] || 0) / totalDist) * 100);

  return (
    <div
      className={`relative w-[280px] rounded-xl border bg-slate-900/90 dark:bg-[#0e131f]/95 p-3.5 backdrop-blur-md transition-all duration-200 text-slate-100 ${borderClass}`}
    >
      {/* Top Target Handle */}
      {node.depth > 0 && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-sky-400"
        />
      )}

      {/* Node Header Pill: ID & Depth */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700">
            Node #{node.node_id}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            L{node.depth}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-slate-400">
            n={node.samples.toLocaleString()}
          </span>
          <span className="px-1 py-0.2 rounded font-mono text-[9px] bg-slate-800/80 text-amber-300">
            g={node.impurity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Node Body: Decision Split vs Leaf Outcome */}
      {isLeaf ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Class Verdict</span>
            <div className="flex items-center gap-1 font-mono text-xs font-bold">
              {node.prediction === "Benign" ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Benign
                </span>
              ) : node.prediction === "FTP-BruteForce" ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> FTP-BruteForce
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> SSH-Bruteforce
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-400">Confidence</span>
            <span className="font-bold text-slate-200">{node.confidence}%</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
              Split Feature
            </div>
            <div className="font-mono text-xs font-bold text-sky-300 truncate" title={node.feature}>
              {node.feature}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md bg-slate-800/60 px-2 py-1 border border-slate-700/50">
            <span className="text-[10px] font-medium text-slate-400">Condition</span>
            <span className="font-mono text-xs font-bold text-amber-300">
              ≤ {node.threshold.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Class Proportion Mini-Bar */}
      <div className="mt-3 pt-2 border-t border-slate-800/60">
        <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-1">
          <span className="text-emerald-400">B: {benignPct}%</span>
          <span className="text-amber-400">FTP: {ftpPct}%</span>
          <span className="text-rose-400">SSH: {sshPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 flex overflow-hidden">
          <div style={{ width: `${benignPct}%` }} className="bg-emerald-500 h-full" />
          <div style={{ width: `${ftpPct}%` }} className="bg-amber-500 h-full" />
          <div style={{ width: `${sshPct}%` }} className="bg-rose-500 h-full" />
        </div>
      </div>

      {/* Bottom Source Handle (if internal node) */}
      {!isLeaf && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-amber-400"
        />
      )}
    </div>
  );
}

const nodeTypes = {
  decisionTreeNode: DecisionTreeNode,
};

// ============================================================================
// Main DecisionTreeFlowVisualizer Component
// ============================================================================
export function DecisionTreeFlowVisualizer() {
  const [treeData, setTreeData] = useState<TreeGraphResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDepth, setSelectedDepth] = useState<number>(3);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<TreeNodeData | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load Tree Data from Backend
  const loadTree = useCallback(async (depth: number) => {
    try {
      setLoading(true);
      const data = await fetchTreeGraph(depth);
      setTreeData(data);

      // Map to React Flow format
      const rfNodes: Node[] = data.nodes.map((n) => ({
        id: n.id,
        type: "decisionTreeNode",
        position: n.position,
        data: n.data as unknown as Record<string, unknown>,
      }));

      const rfEdges: Edge[] = data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "smoothstep",
        animated: e.label.startsWith("≤"),
        style: e.style || { stroke: "#38bdf8", strokeWidth: 2 },
        labelStyle: { fill: "#f8fafc", fontFamily: "monospace", fontSize: 11, fontWeight: 700 },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85, rx: 4, ry: 4 },
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (err) {
      console.error("Failed to load decision tree graph:", err);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadTree(selectedDepth);
  }, [selectedDepth, loadTree]);

  // Handle Search Filtering
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) {
      return nodes.map((n) => ({ ...n, selected: false }));
    }
    const term = searchTerm.toLowerCase();
    return nodes.map((n) => {
      const data = n.data as unknown as TreeNodeData;
      const match =
        (data.feature && data.feature.toLowerCase().includes(term)) ||
        (data.prediction && data.prediction.toLowerCase().includes(term)) ||
        n.id === term;
      return {
        ...n,
        selected: match,
      };
    });
  }, [nodes, searchTerm]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeInfo(node.data as unknown as TreeNodeData);
  }, []);

  return (
    <div className="flex flex-col h-[750px] w-full rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Visualizer Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Decision Tree Interactive Flow Visualizer
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                @xyflow/react
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Scikit-Learn DecisionTreeClassifier (109 total nodes, max depth 20)
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search feature or node..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-44 rounded-lg bg-slate-800/70 border border-slate-700/60 pl-8 pr-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Depth Selector */}
          <div className="flex items-center bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/60">
            {[
              { label: "Depth 2", val: 2 },
              { label: "Depth 3", val: 3 },
              { label: "Depth 4", val: 4 },
              { label: "Full Tree", val: 0 },
            ].map((d) => (
              <button
                key={d.val}
                onClick={() => setSelectedDepth(d.val)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                  selectedDepth === d.val
                    ? "bg-sky-500 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadTree(selectedDepth)}
            title="Reload Model Tree"
            className="h-8 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Interactive React Flow Canvas */}
      <div className="flex-1 w-full relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sky-400 font-mono text-xs">
              <span className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              Parsing Decision Tree Nodes & Edges...
            </div>
          </div>
        )}

        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.15}
          maxZoom={2.0}
          defaultViewport={{ x: 0, y: 0, zoom: 0.65 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="rgba(56, 189, 248, 0.12)" />
          <Controls className="!bg-slate-900 !border-slate-800 !text-slate-200 fill-slate-200 rounded-lg shadow-xl" />
          <MiniMap
            nodeColor={(n: any) => {
              if (n.data?.is_leaf) {
                return n.data?.prediction === "Benign" ? "#10b981" : "#ef4444";
              }
              return "#38bdf8";
            }}
            maskColor="rgba(15, 23, 42, 0.75)"
            className="!bg-slate-900/90 !border !border-slate-800 rounded-lg overflow-hidden"
          />
        </ReactFlow>

        {/* Selected Node Deep Inspector Overlay */}
        {selectedNodeInfo && (
          <div className="absolute bottom-4 left-4 z-10 max-w-sm w-full rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-md shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs">Node #{selectedNodeInfo.node_id} Details</span>
              </div>
              <button
                onClick={() => setSelectedNodeInfo(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Node Type:</span>
                <span className="font-bold text-sky-300">
                  {selectedNodeInfo.is_leaf ? "Leaf Verdict" : "Internal Split"}
                </span>
              </div>
              {!selectedNodeInfo.is_leaf && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Split Feature:</span>
                    <span className="text-white font-bold truncate max-w-[170px]" title={selectedNodeInfo.feature}>
                      {selectedNodeInfo.feature}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Split Threshold:</span>
                    <span className="text-amber-300 font-bold">≤ {selectedNodeInfo.threshold}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Gini Impurity:</span>
                <span className="text-slate-200">{selectedNodeInfo.impurity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Samples:</span>
                <span className="text-slate-200">{selectedNodeInfo.samples.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Class Majority:</span>
                <span className="font-bold text-emerald-400">{selectedNodeInfo.prediction} ({selectedNodeInfo.confidence}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
