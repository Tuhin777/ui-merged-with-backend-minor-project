// Client utilities for communicating with the DPI Python Backend (FastAPI)

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/live";

export interface SystemStatus {
  status: "idle" | "capturing";
  active_interface: string | null;
  bpf_filter: string;
  uptime: number;
  duration_seconds?: number | null;
  remaining_seconds?: number | null;
  total_packets: number;
  total_bytes: number;
  active_flows: number;
  packet_rate?: number;
  threat_counts: {
    Benign: number;
    "FTP-BruteForce": number;
    "SSH-Bruteforce": number;
    Other: number;
  };
  model_loaded: boolean;
  model_path: string | null;
}

export interface NetworkInterface {
  id: string;
  raw: string;
  name: string;
}

export interface XAIFactor {
  feature: string;
  value: string;
  impact_pct: number;
  title: string;
  reason: string;
}

export interface XAIExplanation {
  verdict: string;
  confidence: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "SAFE";
  analyst_summary: string;
  top_factors: XAIFactor[];
  decision_tree_steps: string[];
  recommended_action: string;
  probabilities?: Record<string, number>;
  features_analyzed?: number;
}

export interface FlowSummary {
  key: string;
  forward_key: string;
  src_endpoint: string;
  dst_endpoint: string;
  src_ip?: string;
  dst_ip?: string;
  src_host?: string;
  dst_host?: string;
  dns_name?: string;
  transport_protocol: string;
  protocol: number;
  total_packets: number;
  fwd_packets: number;
  bwd_packets: number;
  total_bytes: number;
  fwd_bytes: number;
  bwd_bytes: number;
  duration: number;
  last_seen: number;
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  features_25?: Record<string, number>;
  xai_explanation?: XAIExplanation;
}

export interface PacketRecord {
  id: number;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_host?: string;
  dst_host?: string;
  dns_query?: string;
  src_port: number;
  dst_port: number;
  protocol: number;
  transport_protocol: string;
  length: number;
  ttl: number;
  window_size: number;
  tcp_flags: {
    syn: number;
    ack: number;
    fin: number;
    rst: number;
    psh: number;
  };
  entropy: number;
  iat: number;
}

export interface ModelInfo {
  model_type: string;
  classes: string[];
  feature_count: number;
  features: string[];
  model_path: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE_URL}/api/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch system status");
  return res.json();
}

export async function fetchInterfaces(): Promise<NetworkInterface[]> {
  const res = await fetch(`${API_BASE_URL}/api/interfaces`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch network interfaces");
  return res.json();
}

export async function startCapture(
  interfaceName: string = "Wi-Fi",
  bpfFilter: string = "ip or ip6",
  packetCount?: number,
  durationSeconds?: number
) {
  const res = await fetch(`${API_BASE_URL}/api/capture/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interface: interfaceName,
      bpf_filter: bpfFilter,
      packet_count: packetCount || null,
      duration_seconds: durationSeconds || null
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start capture");
  }
  return res.json();
}

export async function stopCapture() {
  const res = await fetch(`${API_BASE_URL}/api/capture/stop`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to stop capture");
  return res.json();
}

export async function uploadPcapFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/capture/upload-pcap`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload PCAP file");
  }
  return res.json();
}

export async function resetSession() {
  const res = await fetch(`${API_BASE_URL}/api/session/reset`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to reset session");
  return res.json();
}

export async function fetchFlows(search?: string, label?: string): Promise<{ total_flows: number; flows: FlowSummary[] }> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (label && label !== "ALL") params.append("label", label);

  const res = await fetch(`${API_BASE_URL}/api/flows?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch flows");
  return res.json();
}

export async function fetchFlowDetail(key: string): Promise<FlowSummary> {
  const res = await fetch(`${API_BASE_URL}/api/flows/${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch flow detail");
  return res.json();
}

export async function fetchFlowExplanation(key: string): Promise<XAIExplanation> {
  const res = await fetch(`${API_BASE_URL}/api/flows/${encodeURIComponent(key)}/explain`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch flow explanation");
  return res.json();
}

export async function fetchPackets(limit: number = 100): Promise<{ count: number; packets: PacketRecord[] }> {
  const res = await fetch(`${API_BASE_URL}/api/packets?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch packets");
  return res.json();
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch(`${API_BASE_URL}/api/model/info`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch model info");
  return res.json();
}

export async function predictCustomFeatures(featuresDict: Record<string, number>): Promise<{
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  status: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/model/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features: featuresDict })
  });
  if (!res.ok) throw new Error("Failed to execute ML prediction");
  return res.json();
}

export async function fetchFeatureImportance(): Promise<{ count: number; rankings: FeatureImportance[] }> {
  const res = await fetch(`${API_BASE_URL}/api/model/importance`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch feature importance");
  return res.json();
}

export interface SessionReport {
  status: "capturing" | "idle";
  interface: string;
  bpf_filter: string;
  uptime: number;
  total_packets: number;
  total_bytes: number;
  total_flows: number;
  packet_rate: number;
  byte_rate: number;
  threat_counts: {
    Benign: number;
    "FTP-BruteForce": number;
    "SSH-Bruteforce": number;
    Other: number;
  };
  total_threats: number;
  benign_percentage: number;
  threat_verdict: {
    level: "BENIGN" | "WARNING" | "CRITICAL";
    headline: string;
    summary: string;
  };
  protocol_distribution: {
    TCP: number;
    UDP: number;
    ICMP: number;
    Other: number;
  };
  top_sources: Array<{ ip: string; host?: string; packets: number; bytes: number }>;
  top_destinations: Array<{ port: number; service: string; packets: number; threat?: boolean }>;
  flagged_flows: Array<{
    key: string;
    src_endpoint: string;
    dst_endpoint: string;
    src_ip?: string;
    dst_ip?: string;
    src_host?: string;
    dst_host?: string;
    dns_name?: string;
    prediction: string;
    confidence: number;
    total_packets: number;
    total_bytes: number;
    duration: number;
    reasons: string[];
  }>;
}

export interface DatasetSample {
  id: number;
  actual?: string | null;
  prediction: string;
  confidence: number;
  is_correct?: boolean | null;
  protocol: number;
  duration: number;
  fwd_packets: number;
  bwd_packets: number;
  init_bwd_win: number;
}

export interface DatasetEvaluationResult {
  source: string;
  total_samples: number;
  class_distribution: Record<string, number>;
  threat_count: number;
  has_ground_truth: boolean;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  confusion_matrix?: {
    classes: string[];
    matrix: number[][];
  } | null;
  samples: DatasetSample[];
}

export async function fetchSessionReport(): Promise<SessionReport> {
  const res = await fetch(`${API_BASE_URL}/api/session/report`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch session report");
  return res.json();
}

export async function evaluateCsvDataset(file: File): Promise<DatasetEvaluationResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/dataset/evaluate-csv`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to evaluate dataset");
  }
  return res.json();
}

export async function fetchSampleBenchmark(): Promise<DatasetEvaluationResult> {
  const res = await fetch(`${API_BASE_URL}/api/dataset/sample-benchmark`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch benchmark evaluation");
  return res.json();
}

export async function resolveDns(ip: string): Promise<{ ip: string; hostname: string; resolved: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dns/resolve?ip=${encodeURIComponent(ip)}`, { cache: "no-store" });
    if (!res.ok) return { ip, hostname: ip, resolved: false };
    return res.json();
  } catch {
    return { ip, hostname: ip, resolved: false };
  }
}

// ─── Cyber Lab & Attack Simulation Types ────────────────────────────────────

export interface LabTarget {
  port: number;
  online: boolean;
  service: string;
  type: string;
}

export interface LabLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface LabStatus {
  is_running: boolean;
  mode: string | null;
  rate: string;
  duration_seconds: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  stats: {
    requests_sent: number;
    success: number;
    rejected: number;
    errors: number;
  };
  logs: LabLogEntry[];
  targets: {
    ftp: LabTarget;
    ssh: LabTarget;
    http: LabTarget;
  };
}

export async function fetchLabStatus(): Promise<LabStatus> {
  const res = await fetch(`${API_BASE_URL}/api/lab/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch lab status");
  return res.json();
}

export async function startLabSimulation(
  mode: string = "ssh",
  durationSeconds: number = 30,
  rate: string = "aggressive"
): Promise<{ status: string; mode: string; duration: number; rate: string }> {
  const res = await fetch(`${API_BASE_URL}/api/lab/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      duration_seconds: durationSeconds,
      rate
    }),
  });
  if (!res.ok) throw new Error("Failed to start lab simulation");
  return res.json();
}

export async function stopLabSimulation(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/lab/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to stop lab simulation");
  return res.json();
}

export async function startLabServices(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/lab/services/start`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to start lab services");
  return res.json();
}

export interface TreeNodeData extends Record<string, unknown> {
  node_id: number;
  depth: number;
  is_leaf: boolean;
  feature: string;
  threshold: number;
  samples: number;
  impurity: number;
  distribution: Record<string, number>;
  prediction: string;
  confidence: number;
}

export interface TreeGraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: TreeNodeData;
}

export interface TreeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: string;
  style?: Record<string, any>;
}

export interface TreeGraphResponse {
  nodes: TreeGraphNode[];
  edges: TreeGraphEdge[];
  total_nodes: number;
  max_depth: number;
  classes: string[];
}

export async function fetchTreeGraph(maxDepth: number = 4): Promise<TreeGraphResponse> {
  const res = await fetch(`${API_BASE_URL}/api/model/tree-graph?max_depth=${maxDepth}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch model tree graph");
  return res.json();
}
