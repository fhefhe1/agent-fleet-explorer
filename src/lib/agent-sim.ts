export type AgentStatus = "active" | "paused" | "rate-limited";

export interface Agent {
  id: string;
  name: string;
  task: string;
  dailyLimit: number;
  paymaster: boolean;
  loopProtection: boolean;
  wallet: string;
  spent: number;
  status: AgentStatus;
  success: number;
  blocked: number;
  createdAt: number;
}

export interface ApiService {
  id: string;
  name: string;
  endpoint: string;
  price: number;
  latency: string;
  category: string;
}

export interface TxLog {
  id: string;
  ts: number;
  agentId: string;
  agentName: string;
  service: string;
  amount: number;
  status: "success" | "blocked" | "pending";
  hash: string;
  note?: string;
}

export interface TelemetryPoint {
  t: string;
  spend: number;
  budget: number;
}

const HEX = "0123456789abcdef";
export function randHex(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

export function makeWallet() {
  return `0x${randHex(40)}`;
}

export function makeTxHash() {
  return `0x${randHex(64)}`;
}

export function shorten(addr: string, size = 4) {
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`;
}

export const TASKS = [
  "Data Scraping",
  "LLM Inference",
  "Market Signal Analysis",
  "Onchain Indexing",
  "Content Generation",
];

export const SERVICES: ApiService[] = [
  {
    id: "svc-scraper",
    name: "Web Scraper API",
    endpoint: "https://api.kopicat.dev/v1/scrape",
    price: 0.001,
    latency: "230ms",
    category: "Data",
  },
  {
    id: "svc-serp",
    name: "SerpData API",
    endpoint: "https://api.kopicat.dev/v1/serp",
    price: 0.005,
    latency: "410ms",
    category: "Search",
  },
  {
    id: "svc-llm",
    name: "Nano LLM Inference",
    endpoint: "https://api.kopicat.dev/v1/infer",
    price: 0.012,
    latency: "870ms",
    category: "Inference",
  },
  {
    id: "svc-oracle",
    name: "Price Oracle Feed",
    endpoint: "https://api.kopicat.dev/v1/oracle",
    price: 0.0004,
    latency: "90ms",
    category: "Onchain",
  },
];

export function reputation(a: Agent) {
  const total = a.success + a.blocked;
  const compliance = a.dailyLimit > 0 ? 1 - Math.min(1, a.spent / a.dailyLimit) : 0;
  const reliability = total === 0 ? 0.75 : a.success / total;
  const volume = Math.min(1, a.success / 40);
  return Math.round((reliability * 0.55 + compliance * 0.25 + volume * 0.2) * 1000);
}

export function seedTelemetry(): TelemetryPoint[] {
  const pts: TelemetryPoint[] = [];
  let spend = 0;
  for (let i = 11; i >= 0; i--) {
    spend += Math.random() * 0.9;
    const d = new Date(Date.now() - i * 5 * 60_000);
    pts.push({
      t: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      spend: Number(spend.toFixed(4)),
      budget: 25,
    });
  }
  return pts;
}
