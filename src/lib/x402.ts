import type { Address } from "viem";
import { encodeAbiParameters } from "viem";

/**
 * x402 Payment Protocol (v2.0)
 * Reference: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
 *
 * This module implements the official x402 spec:
 * - Client sends GET request
 * - Server replies with 402 + PaymentRequirements in `accepts: PaymentRequirements[]`
 * - Client signs an EIP-3009 transferWithAuthorization (off-chain, no gas)
 * - Client retries with `X-PAYMENT` header: base64({ x402Version, scheme, network, payload })
 * - Server/facilitator verifies signature + settles on-chain
 * - Server responds 200 + `X-PAYMENT-RESPONSE` header with settlement info
 */

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

/**
 * Official x402 spec PaymentRequirements fields.
 * See: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
 */
export interface PaymentRequirements {
  scheme: string; // e.g. "exact" for EIP-3009, "eip191" for signed messages
  network: string; // e.g. "base-sepolia", "ethereum", etc.
  maxAmountRequired: string; // human-readable decimal, e.g. "0.001"
  resource?: string; // the resource being gated
  description?: string; // human-readable description
  mimeType?: string; // e.g. "application/json"
  payTo: Address; // recipient address
  maxTimeoutSeconds?: number; // signature validity window
  asset: Address; // token contract address
  extra?: Record<string, unknown>; // chain-specific or custom fields
}

/**
 * Parses the 402 response body for the PaymentRequirements array.
 * Returns the first valid requirement or null.
 */
export function parseChallenge(body: unknown): PaymentRequirements | null {
  const b = body as Record<string, any> | null;
  if (!b) return null;

  // Spec expects `accepts: PaymentRequirements[]`
  const accepts = Array.isArray(b['accepts']) ? b['accepts'] : null;
  const req = accepts?.[0];
  if (!req) return null;

  // Map to spec fields; if missing, attempt fallback only for `payTo`
  const payTo = req.payTo ?? req.recipient ?? req.to;
  const asset = req.asset ?? req.token;
  const maxAmountRequired = req.maxAmountRequired ?? req.amount;

  if (!payTo || !asset || !maxAmountRequired) return null;

  return {
    scheme: req.scheme ?? "exact",
    network: req.network ?? "base-sepolia",
    maxAmountRequired: String(maxAmountRequired),
    resource: req.resource,
    description: req.description,
    mimeType: req.mimeType,
    payTo: payTo as Address,
    maxTimeoutSeconds: req.maxTimeoutSeconds,
    asset: asset as Address,
    extra: req.extra,
  };
}

/**
 * EIP-3009 transferWithAuthorization typed-data (EIP-712).
 * Used to build the payload for signing.
 */
export interface EIP3009Authorization {
  from: Address;
  to: Address;
  value: string; // stringified bigint
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`; // 32-byte hex nonce
}

/**
 * Builds the EIP-712 typed-data structure for EIP-3009 transferWithAuthorization.
 * Domain includes USDC-specific constants (name, version, chainId, verifyingContract).
 */
export function buildEIP712TypedData(
  auth: EIP3009Authorization,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  },
) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    domain,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: auth.from,
      to: auth.to,
      value: BigInt(auth.value),
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce,
    },
  };
}

/**
 * Spec-compliant X-PAYMENT header value: base64-encoded JSON.
 * Structure: { x402Version, scheme, network, payload: { signature, authorization } }
 */
export interface X402PaymentPayload {
  x402Version: "2.0";
  scheme: string; // e.g. "exact" for EIP-3009
  network: string; // e.g. "base-sepolia"
  payload: {
    signature: string; // hex string, e.g. "0xabcd..."
    authorization: EIP3009Authorization;
  };
}

/**
 * X-PAYMENT-RESPONSE header structure (from facilitator/server).
 * Contains settlement result and on-chain transaction hash.
 */
export interface X402PaymentResponse {
  x402Version?: string;
  transactionHash?: string; // on-chain settlement tx hash
  status?: string; // e.g., "settled", "pending"
  network?: string;
  payer?: Address;
  [key: string]: unknown; // allow extra fields
}

/**
 * Encodes the X-PAYMENT header value per spec.
 */
export function encodeX402PaymentHeader(data: X402PaymentPayload): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString("base64");
}

/**
 * Decodes and parses the X-PAYMENT-RESPONSE header.
 * Returns null if header is missing, empty, or invalid.
 */
export function parseX402PaymentResponse(headerValue: string | null): X402PaymentResponse | null {
  if (!headerValue) return null;
  try {
    // Assume base64-encoded JSON per spec (confirm with facilitator)
    const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(decoded) as X402PaymentResponse;
  } catch {
    return null;
  }
}

/**
 * Response from requestResource.
 */
export interface X402RequestResponse {
  status: number;
  body: unknown;
  paymentResponse: X402PaymentResponse | null; // parsed X-PAYMENT-RESPONSE header
}

/**
 * Fetch a protected resource, optionally with an X-PAYMENT header.
 * On success, attempts to parse and return the X-PAYMENT-RESPONSE header.
 */
export async function requestResource(
  url: string,
  paymentHeader?: string,
): Promise<X402RequestResponse> {
  const headers: Record<string, string> = { ...X402_HEADERS };
  if (paymentHeader) {
    headers["X-PAYMENT"] = paymentHeader;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  let json: unknown = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  // Extract and parse X-PAYMENT-RESPONSE header
  const paymentResponseHeader = res.headers.get("X-PAYMENT-RESPONSE");
  const paymentResponse = parseX402PaymentResponse(paymentResponseHeader);

  return {
    status: res.status,
    body: json,
    paymentResponse,
  };
}
