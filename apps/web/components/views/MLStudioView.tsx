"use client";

import React, { useState, useEffect } from "react";
import { 
  fetchModelInfo, 
  fetchFeatureImportance, 
  predictCustomFeatures, 
  ModelInfo, 
  FeatureImportance 
} from "@/lib/api";
import { 
  Cpu, 
  Play, 
  BarChart3, 
  RefreshCw,
  GitFork,
  SlidersHorizontal
} from "lucide-react";
import { DecisionTreeFlowVisualizer } from "@/components/DecisionTreeFlowVisualizer";

export function MLStudioView() {
  const [activeTab, setActiveTab] = useState<"tree" | "classifier">("tree");
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [importanceList, setImportanceList] = useState<FeatureImportance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form feature values for testing
  const [features, setFeatures] = useState<Record<string, number>>({
    "Protocol": 6,
    "Flow Duration": 150000,
    "Total Fwd Packets": 10,
    "Total Backward Packets": 8,
    "Fwd Packets Length Total": 1200,
    "Bwd Packets Length Total": 3400,
    "Flow Bytes/s": 30000,
    "Flow Packets/s": 120,
    "Flow IAT Mean": 12000,
    "Flow IAT Std": 4500,
    "Flow IAT Max": 25000,
    "Fwd IAT Mean": 14000,
    "Bwd IAT Mean": 11000,
    "SYN Flag Count": 1,
    "RST Flag Count": 0,
    "FIN Flag Count": 1,
    "ACK Flag Count": 12,
    "PSH Flag Count": 3,
    "Packet Length Mean": 255,
    "Packet Length Std": 310,
    "Packet Length Max": 1460,
    "Packet Length Min": 40,
    "Down/Up Ratio": 0.8,
    "Init Fwd Win Bytes": 8192,
    "Init Bwd Win Bytes": 65535,
  });

  const [predicting, setPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([fetchModelInfo(), fetchFeatureImportance()])
      .then(([info, imp]) => {
        setModelInfo(info);
        setImportanceList(imp.rankings);
      })
      .catch((err) => console.error("Could not load ML data:", err))
      .finally(() => setLoading(false));
  }, []);

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const res = await predictCustomFeatures(features);
      setPredictionResult(res);
    } catch (err: any) {
      alert(`Prediction failed: ${err.message}`);
    } finally {
      setPredicting(false);
    }
  };

  const applyPreset = (preset: "benign" | "ftp" | "ssh") => {
    if (preset === "benign") {
      setFeatures({
        "Protocol": 6,
        "Flow Duration": 450000,
        "Total Fwd Packets": 15,
        "Total Backward Packets": 18,
        "Fwd Packets Length Total": 2400,
        "Bwd Packets Length Total": 14500,
        "Flow Bytes/s": 37555,
        "Flow Packets/s": 73,
        "Flow IAT Mean": 13600,
        "Flow IAT Std": 5200,
        "Flow IAT Max": 35000,
        "Fwd IAT Mean": 15000,
        "Bwd IAT Mean": 12000,
        "SYN Flag Count": 1,
        "RST Flag Count": 0,
        "FIN Flag Count": 1,
        "ACK Flag Count": 28,
        "PSH Flag Count": 8,
        "Packet Length Mean": 512,
        "Packet Length Std": 420,
        "Packet Length Max": 1460,
        "Packet Length Min": 54,
        "Down/Up Ratio": 1.2,
        "Init Fwd Win Bytes": 65535,
        "Init Bwd Win Bytes": 65535,
      });
    } else if (preset === "ftp") {
      setFeatures({
        "Protocol": 6,
        "Flow Duration": 22000,
        "Total Fwd Packets": 4,
        "Total Backward Packets": 0,
        "Fwd Packets Length Total": 180,
        "Bwd Packets Length Total": 0,
        "Flow Bytes/s": 8181,
        "Flow Packets/s": 181,
        "Flow IAT Mean": 5500,
        "Flow IAT Std": 1200,
        "Flow IAT Max": 7000,
        "Fwd IAT Mean": 5500,
        "Bwd IAT Mean": 0,
        "SYN Flag Count": 4,
        "RST Flag Count": 3,
        "FIN Flag Count": 0,
        "ACK Flag Count": 1,
        "PSH Flag Count": 0,
        "Packet Length Mean": 45,
        "Packet Length Std": 5,
        "Packet Length Max": 54,
        "Packet Length Min": 40,
        "Down/Up Ratio": 0.0,
        "Init Fwd Win Bytes": 1024,
        "Init Bwd Win Bytes": 0,
      });
    } else if (preset === "ssh") {
      setFeatures({
        "Protocol": 6,
        "Flow Duration": 95000,
        "Total Fwd Packets": 25,
        "Total Backward Packets": 22,
        "Fwd Packets Length Total": 3200,
        "Bwd Packets Length Total": 2800,
        "Flow Bytes/s": 63157,
        "Flow Packets/s": 494,
        "Flow IAT Mean": 2021,
        "Flow IAT Std": 850,
        "Flow IAT Max": 3500,
        "Fwd IAT Mean": 2100,
        "Bwd IAT Mean": 2000,
        "SYN Flag Count": 6,
        "RST Flag Count": 4,
        "FIN Flag Count": 1,
        "ACK Flag Count": 40,
        "PSH Flag Count": 12,
        "Packet Length Mean": 127,
        "Packet Length Std": 85,
        "Packet Length Max": 800,
        "Packet Length Min": 40,
        "Down/Up Ratio": 0.88,
        "Init Fwd Win Bytes": 2048,
        "Init Bwd Win Bytes": 1024,
      });
    }
    setPredictionResult(null);
  };

  const handleFieldChange = (key: string, val: string) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: parseFloat(val) || 0,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 sm:p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded border border-[#1a1815] bg-[#2f7d4f] text-white shrink-0">
            <Cpu className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1a1815] flex items-center gap-2">
              Decision Tree Diagnostic Studio
              <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-[#1a1815] bg-[#f0fdf4] text-[#2f7d4f] font-bold">
                Active
              </span>
            </h2>
            <p className="text-xs text-[#6b6459]">
              Simulate network flows and inspect Gini feature split importances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[11px] text-[#6b6459] bg-[#f4f1ea] px-3 py-1.5 rounded border border-[#1a1815] flex-wrap">
          <span className="font-bold text-[#1a1815]">Target Classes:</span>
          <span className="text-[#2f7d4f] font-bold">Benign</span>
          <span>•</span>
          <span className="text-[#b91c1c] font-bold">FTP-BruteForce</span>
          <span>•</span>
          <span className="text-[#8a4b00] font-bold">SSH-Bruteforce</span>
        </div>
      </div>

      {/* View Sub-Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-[#1a1815] pb-2">
        <button
          onClick={() => setActiveTab("tree")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === "tree"
              ? "bg-[#1a1815] text-white shadow-sm"
              : "bg-white hover:bg-slate-100 text-[#1a1815] border border-[#1a1815]"
          }`}
        >
          <GitFork className="w-3.5 h-3.5 text-sky-400" />
          <span>Interactive Tree Visualizer (@xyflow/react)</span>
        </button>

        <button
          onClick={() => setActiveTab("classifier")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === "classifier"
              ? "bg-[#1a1815] text-white shadow-sm"
              : "bg-white hover:bg-slate-100 text-[#1a1815] border border-[#1a1815]"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
          <span>Flow Feature Simulator & Importance Rankings</span>
        </button>
      </div>

      {/* Tab 1: Interactive Decision Tree Visualizer */}
      {activeTab === "tree" && (
        <DecisionTreeFlowVisualizer />
      )}

      {/* Tab 2: Feature Simulator & Rankings Grid */}
      {activeTab === "classifier" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulator Column (2 cols) */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[#1a1815] gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1a1815] uppercase font-mono tracking-wider">
                Flow Feature Simulator
              </h3>
              <p className="text-xs text-[#6b6459]">Modify feature values to observe Decision Tree classification</p>
            </div>

            {/* Simulation Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#6b6459] font-mono mr-1 font-bold">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("benign")}
                className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#2f7d4f] text-xs font-mono font-bold press-shadow-sm transition cursor-pointer"
              >
                Normal Web
              </button>
              <button
                type="button"
                onClick={() => applyPreset("ftp")}
                className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#fff1f2] hover:bg-[#ffe4e6] text-[#b91c1c] text-xs font-mono font-bold press-shadow-sm transition cursor-pointer"
              >
                FTP Attack
              </button>
              <button
                type="button"
                onClick={() => applyPreset("ssh")}
                className="px-2.5 py-1 rounded border border-[#1a1815] bg-[#fefce8] hover:bg-[#fef9c3] text-[#8a4b00] text-xs font-mono font-bold press-shadow-sm transition cursor-pointer"
              >
                SSH Attack
              </button>
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 text-xs font-mono max-h-[440px] xl:max-h-[520px] overflow-y-auto pr-1">
            {Object.entries(features).map(([key, val]) => (
              <div key={key} className="space-y-1">
                <label className="block text-[11px] text-[#6b6459] font-semibold truncate" title={key}>
                  {key}
                </label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="w-full bg-[#f4f1ea] border border-[#1a1815] rounded px-2.5 py-1.5 text-[#1a1815] font-bold focus:outline-none focus:ring-2 focus:ring-[#f7b955] tabular-nums"
                />
              </div>
            ))}
          </div>

          {/* Trigger Predict Button */}
          <button
            onClick={handlePredict}
            disabled={predicting}
            className="w-full py-2.5 rounded border border-[#1a1815] bg-[#f7b955] hover:bg-[#f4c775] text-[#1a1815] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer press-shadow transition disabled:opacity-50"
          >
            {predicting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Inference...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Decision Tree Prediction</span>
              </>
            )}
          </button>

          {/* Prediction Result Display */}
          {predictionResult && (
            <div className="p-4 rounded border border-[#1a1815] bg-[#f4f1ea] space-y-3 animate-in fade-in press-shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#6b6459] uppercase font-bold">Inference Result:</span>
                <span className={`px-3 py-1 rounded border border-[#1a1815] text-xs font-mono font-bold ${
                  predictionResult.prediction === "Benign"
                    ? "bg-[#2f7d4f] text-white"
                    : predictionResult.prediction === "FTP-BruteForce"
                      ? "bg-[#b91c1c] text-white"
                      : "bg-[#f7b955] text-[#1a1815]"
                }`}>
                  {predictionResult.prediction}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#6b6459] font-bold">Model Confidence:</span>
                <span className="text-[#1a1815] font-bold font-mono text-sm">
                  {(predictionResult.confidence * 100).toFixed(1)}%
                </span>
              </div>

              {predictionResult.probabilities && (
                <div className="space-y-1.5 pt-2 border-t border-[#d6cfc0]">
                  <div className="text-[11px] font-mono text-[#6b6459] mb-1 font-bold">Class Probabilities:</div>
                  {Object.entries(predictionResult.probabilities).map(([cls, prob]: any) => (
                    <div key={cls} className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#1a1815] font-semibold">{cls}</span>
                        <span className="text-[#6b6459] font-bold">{(prob * 100).toFixed(1)}%</span>
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
              )}
            </div>
          )}
        </div>

        {/* Feature Importance Column (1 col) */}
        <div className="p-5 rounded border-2 border-[#1a1815] bg-[#ffffff] press-shadow space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1815]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1a1815]" />
              <h3 className="text-sm font-bold text-[#1a1815] uppercase font-mono tracking-wider">
                Feature Importance
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#6b6459] font-bold">Gini Weights</span>
          </div>

          <p className="text-xs text-[#6b6459] leading-relaxed">
            Extracted from <code className="text-[#1a1815] font-bold font-mono text-[10px] bg-[#f4f1ea] px-1 py-0.5 rounded border border-[#d6cfc0]">feature_importance_DT.csv</code>. Shows which attributes dominate the decision boundaries.
          </p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {importanceList.map((item, idx) => {
              const pct = (item.importance * 100);
              const isTop = idx < 3;
              return (
                <div key={item.feature} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={`truncate font-bold ${isTop ? "text-[#1a1815]" : "text-[#6b6459]"}`}>
                      {item.feature}
                    </span>
                    <span className="text-[#1a1815] font-mono text-[11px] font-bold shrink-0 ml-2">
                      {pct >= 0.01 ? `${pct.toFixed(2)}%` : "<0.01%"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#f4f1ea] border border-[#1a1815] rounded overflow-hidden">
                    <div
                      style={{ width: `${Math.max(pct, item.importance > 0 ? 3 : 0)}%` }}
                      className={`h-full transition-all duration-300 ${
                        isTop ? "bg-[#f7b955]" : "bg-[#d6cfc0]"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
