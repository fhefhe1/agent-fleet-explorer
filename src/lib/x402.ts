import type { Address } from "viem";

/**
 * Base URL of the x402-protected API (ngrok tunnel).
 * Priority: runtime override in localStorage -> build-time env -> empty.
 * Set at runtime from the browser console:
 *   localStorage.setItem("x402:baseUrl", "https://xxxx.ngrok-free.app")
 */
const ENV_BASE = (import.meta.env['VITE_X402_BASE_URL'] as string | undefined) ?? "";
const LS_KEY = "x402:baseUrl";

export function x402BaseUrl(): string {
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem(LS_KEY);
    if (override) return override.replace(/\/+$/, "");
  }
  return ENV_BASE.replace(/\/+$/, "");
}

export function setX402BaseUrl(url: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, url.replace(/\/+$/, ""));
}

export function x402Url(path: string): string {
  const base = x402BaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const X402_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
};

export interface X402Challenge {
  asset: Address;
  amount: string; // human readable, e.g. "0.001"
  recipient: Address;
  network?: string;
  raw: unknown;
}

/** Tolerant parser for the 402 JSON body (supports flat and x402 `accepts[]` shapes). */
export function parseChallenge(body: unknown): X402Challenge | null {
  const b = body as Record<string, any> | null;
  if (!b) return null;
  const c = Array.isArray(b['accepts']) ? b['accepts'][0] : (b['paymentRequirements'] ?? b);
  if (!c) return null;
  const asset = c.asset ?? c.token ?? c.contract ?? c.assetAddress;
  const recipient = c.recipient ?? c.payTo ?? c.receiver ?? c.to ?? c.address;
  const amount = c.amount ?? c.maxAmountRequired ?? c.price ?? c.value;
  if (!asset || !recipient || amount === undefined) return null;
  return {
    asset: asset as Address,
    amount: String(amount),
    recipient: recipient as Address,
    network: c.network ?? c.chain,
    raw: body,
  };
}

export async function requestResource(url: string, paymentProof?: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: paymentProof ? { ...X402_HEADERS, "x-payment-proof": paymentProof } : X402_HEADERS,
  });
  let json: unknown = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}
