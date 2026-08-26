import { useCallback, useEffect, useRef, useState } from "react";
import { parseUnits, type Address } from "viem";
import { usePublicClient, useSignTypedData } from "wagmi";
import { useAccount } from "wagmi";
import { erc20Abi, USDC_ADDRESS, USDC_DECIMALS, USDC_EIP712_DOMAIN, TARGET_CHAIN_ID } from "@/lib/web3";
import {
  parseChallenge,
  requestResource,
  buildEIP712TypedData,
  encodeX402PaymentHeader,
  type EIP3009Authorization,
  type X402PaymentPayload,
} from "@/lib/x402";
import {
  makeTxHash,
  makeWallet,
  seedTelemetry,
  serviceUrl,
  type Agent,
  type ApiService,
  type TelemetryPoint,
  type TxLog,
} from "@/lib/agent-sim";

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export interface X402Step {
  label: string;
  detail: string;
  state: "pending" | "running" | "done" | "failed";
}

const STEP_TEMPLATE: Array<{ label: string; detail: string }> = [
  { label: "HTTP GET", detail: "Agent requests the protected resource" },
  { label: "402 Payment Required", detail: "Server replies with x402 payment challenge" },
  { label: "EIP-3009 Authorization", detail: "Owner signs the authorization (off-chain, no gas)" },
  { label: "Retried with X-PAYMENT", detail: "Request resent with payment header" },
  { label: "200 OK · Payload delivered", detail: "Resource streamed back to the agent" },
];

/**
 * Generate a cryptographically random 32-byte nonce for EIP-3009.
 * Each authorization must have a unique nonce to prevent replay attacks.
 */
function generateRandomNonce(): `0x${string}` {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

export function useAgentEconomy() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [steps, setSteps] = useState<X402Step[]>([]);
  const [running, setRunning] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState(0);
  const burstRef = useRef<Record<string, number[]>>({});
  const publicClient = usePublicClient();
  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  useEffect(() => {
    setTelemetry(seedTelemetry());
    setAgents([
      {
        id: nextId("agt"),
        name: "KOPI-SCOUT-01",
        task: "Data Scraping",
        dailyLimit: 25,
        paymaster: true,
        loopProtection: true,
        wallet: makeWallet(),
        spent: 4.238,
        status: "active",
        success: 128,
        blocked: 3,
        createdAt: Date.now() - 86_400_000,
      },
      {
        id: nextId("agt"),
        name: "CAT-ORACLE-02",
        task: "Market Signal Analysis",
        dailyLimit: 10,
        paymaster: true,
        loopProtection: false,
        wallet: makeWallet(),
        spent: 8.912,
        status: "rate-limited",
        success: 61,
        blocked: 9,
        createdAt: Date.now() - 3_600_000,
      },
    ]);
  }, []);

  const fundFaucet = useCallback(() => {
    setFaucetBalance((b) => Number((b + 100).toFixed(6)));
  }, []);

  const createAgent = useCallback(
    (input: {
      name: string;
      task: string;
      dailyLimit: number;
      paymaster: boolean;
      loopProtection: boolean;
    }, owner?: Address | string | null) => {
      const salt = BigInt(Date.now());
      const smartAccount =
        owner && owner.startsWith("0x") && owner.length === 42
          ? (owner as Address)
          : makeWallet();
      const agent: Agent = {
        id: nextId("agt"),
        ...input,
        wallet: smartAccount,
        spent: 0,
        status: "active",
        success: 0,
        blocked: 0,
        createdAt: Date.now(),
      };
      setAgents((a) => [agent, ...a]);
      return agent;
    },
    [],
  );

  const updateAgent = useCallback((id: string, patch: Partial<Agent>) => {
    setAgents((list) =>
      list.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...patch };
        // Budget cap drives status unless the operator explicitly toggled it.
        if (patch.status === undefined && next.status !== "paused") {
          next.status = next.spent >= next.dailyLimit ? "rate-limited" : "active";
        }
        return next;
      }),
    );
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents((list) => list.filter((a) => a.id !== id));
  }, []);

  const pushLog = useCallback((log: TxLog) => {
    setLogs((l) => [log, ...l].slice(0, 60));
  }, []);

  const execute = useCallback(
    async (agent: Agent, service: ApiService) => {
      if (running) return;
      setRunning(true);
      setSteps(STEP_TEMPLATE.map((s) => ({ ...s, state: "pending" })));

      const setStep = (i: number, patch: Partial<X402Step>) =>
        setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));

      const settle = (hash: string, note: string) => {
        updateAgent(agent.id, {
          spent: Number((agent.spent + service.price).toFixed(6)),
          success: agent.success + 1,
          status: "active",
        });
        pushLog({
          id: nextId("tx"),
          ts: Date.now(),
          agentId: agent.id,
          agentName: agent.name,
          service: service.name,
          amount: service.price,
          status: "success",
          hash,
          note,
        });
        setFaucetBalance((b) => Number(Math.max(0, b - service.price).toFixed(6)));
        setTelemetry((t) => {
          const d = new Date();
          const last = t[t.length - 1]?.spend ?? 0;
          return [
            ...t.slice(-23),
            {
              t: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
              spend: Number((last + service.price).toFixed(4)),
              budget: agent.dailyLimit,
            },
          ];
        });
      };

      const now = Date.now();
      const key = `${agent.id}:${service.id}`;
      const hits = (burstRef.current[key] ?? []).filter((t) => now - t < 10_000);
      hits.push(now);
      burstRef.current[key] = hits;

      const loopBreach = agent.loopProtection && hits.length > 5;
      const overBudget = agent.spent + service.price > agent.dailyLimit;

      if (loopBreach || overBudget) {
        setStep(loopBreach ? 1 : 2, {
          state: "failed",
          detail: loopBreach
            ? "Loop protection tripped: >5 calls / 10s to same endpoint"
            : "Daily USDC budget exceeded — policy rejected the intent",
        });
        updateAgent(agent.id, {
          blocked: agent.blocked + 1,
          status: loopBreach ? "paused" : "rate-limited",
        });
        pushLog({
          id: nextId("tx"),
          ts: Date.now(),
          agentId: agent.id,
          agentName: agent.name,
          service: service.name,
          amount: service.price,
          status: "blocked",
          hash: makeTxHash(),
          note: loopBreach ? "Loop payment protection" : "Daily budget cap",
        });
        setRunning(false);
        return;
      }

      // ---- Spec-compliant x402 flow against the live API host ----
      if (service.x402) {
        const url = serviceUrl(service);
        try {
          if (!url.startsWith("http")) {
            throw new Error("x402 API base URL is not configured");
          }

          // Step 1: GET request
          setStep(0, { state: "running", detail: `GET ${url}` });
          const first = await requestResource(url);

          if (first.status === 200) {
            setStep(0, { state: "done", detail: "200 OK — resource was not gated" });
            setSteps((s) => s.map((st, i) => (i > 0 ? { ...st, state: "done" } : st)));
            settle(makeTxHash(), "No payment required by the server");
            setRunning(false);
            return;
          }

          if (first.status !== 402) {
            throw new Error(`Unexpected HTTP ${first.status} from the API`);
          }
          setStep(0, { state: "done", detail: "Server gated the resource" });

          // Step 2: Parse 402 challenge
          const requirement = parseChallenge(first.body);
          if (!requirement) throw new Error("Could not parse the 402 payment challenge");
          setStep(1, {
            state: "done",
            detail: `${requirement.maxAmountRequired} USDC → ${requirement.payTo.slice(0, 10)}…`,
          });

          // Step 3: Sign EIP-3009 authorization (off-chain, no gas)
          if (!connectedAddress) {
            throw new Error("Wallet not connected");
          }

          setStep(2, { state: "running", detail: "Awaiting wallet signature…" });

          const value = parseUnits(requirement.maxAmountRequired, USDC_DECIMALS);
          const nowSecs = Math.floor(Date.now() / 1000);
          const validAfter = nowSecs;
          const validBefore = nowSecs + 3600; // 1 hour validity window

          // Generate a cryptographically random nonce (not derived from request params)
          const nonce = generateRandomNonce();

          const auth: EIP3009Authorization = {
            from: connectedAddress,
            to: requirement.payTo,
            value: value.toString(),
            validAfter,
            validBefore,
            nonce,
          };

          const typedData = buildEIP712TypedData(auth, USDC_EIP712_DOMAIN);
          const signature = await signTypedDataAsync(typedData as any);

          setStep(2, { state: "done", detail: `Signed · ${signature.slice(0, 12)}…` });

          // Step 4: Build X-PAYMENT header and retry
          setStep(3, { state: "running", detail: "Retrying with X-PAYMENT header…" });

          const paymentPayload: X402PaymentPayload = {
            x402Version: "2.0",
            scheme: requirement.scheme, // Now defaults to "exact" per spec
            network: requirement.network,
            payload: {
              signature,
              authorization: auth,
            },
          };

          const paymentHeader = encodeX402PaymentHeader(paymentPayload);
          const second = await requestResource(url, paymentHeader);

          if (second.status !== 200) {
            throw new Error(`Payment proof rejected (HTTP ${second.status})`);
          }

          // Step 5: Success — extract settlement tx hash from X-PAYMENT-RESPONSE
          let settlementHash = "pending-offchain-verification";
          let settlementNote = "Settlement awaiting facilitator confirmation";

          if (second.paymentResponse) {
            const txHash = second.paymentResponse.transactionHash;
            if (txHash) {
              settlementHash = txHash;
              settlementNote = `Settled via x402 facilitator (tx: ${txHash.slice(0, 10)}…)`;
            } else {
              // Response exists but no tx hash; treat as pending off-chain
              console.warn(
                "[x402] X-PAYMENT-RESPONSE received but no transactionHash field:",
                second.paymentResponse,
              );
            }
          } else if (second.paymentResponse === null) {
            // Header was missing or unparseable
            console.warn(
              "[x402] No X-PAYMENT-RESPONSE header or failed to parse; settlement may be off-chain",
            );
          }

          const preview =
            typeof second.body === "string"
              ? second.body.slice(0, 80)
              : JSON.stringify(second.body).slice(0, 80);
          setStep(4, {
            state: "done",
            detail: preview,
          });

          settle(settlementHash, settlementNote);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Execution failed";
          setSteps((s) => {
            const idx = s.findIndex((st) => st.state === "running");
            const target = idx === -1 ? 0 : idx;
            return s.map((st, i) => (i === target ? { ...st, state: "failed", detail: message } : st));
          });
          updateAgent(agent.id, { blocked: agent.blocked + 1 });
          pushLog({
            id: nextId("tx"),
            ts: Date.now(),
            agentId: agent.id,
            agentName: agent.name,
            service: service.name,
            amount: service.price,
            status: "blocked",
            hash: makeTxHash(),
            note: message.slice(0, 60),
          });
        }
        setRunning(false);
        return;
      }

      // ---- Services without a live x402 host: stepped local trace ----
      for (let i = 0; i < STEP_TEMPLATE.length; i++) {
        setStep(i, { state: "running" });
        await new Promise((r) => setTimeout(r, 460));
        setStep(i, { state: "done" });
      }
      settle(makeTxHash(), agent.paymaster ? "Gas sponsored by Paymaster" : "Gas paid in USDC");
      setRunning(false);
    },
    [connectedAddress, publicClient, pushLog, running, signTypedDataAsync, updateAgent],
  );

  return {
    faucetBalance,
    fundFaucet,
    agents,
    createAgent,
    updateAgent,
    removeAgent,
    logs,
    telemetry,
    steps,
    running,
    execute,
  };
}
