import { useCallback, useEffect, useRef, useState } from "react";
import { parseUnits, type Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi, predictSmartAccount, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/web3";
import { parseChallenge, requestResource } from "@/lib/x402";
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
  { label: "Wallet Signed", detail: "Owner signs the USDC transfer in the wallet" },
  { label: "Onchain Settlement", detail: "Base Sepolia confirms the ERC-20 payment" },
  { label: "200 OK · Payload delivered", detail: "Resource streamed back to the agent" },
];


export function useAgentEconomy() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [steps, setSteps] = useState<X402Step[]>([]);
  const [running, setRunning] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState(0);
  const burstRef = useRef<Record<string, number[]>>({});
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();


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
          ? predictSmartAccount(owner as Address, salt)
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

      // ---- Real x402 flow against the live API host ----
      if (service.x402) {
        const url = serviceUrl(service);
        try {
          if (!url.startsWith("http")) {
            throw new Error("x402 API base URL is not configured");
          }
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

          const challenge = parseChallenge(first.body);
          if (!challenge) throw new Error("Could not parse the 402 payment challenge");
          setStep(1, {
            state: "done",
            detail: `${challenge.amount} USDC → ${challenge.recipient.slice(0, 10)}…`,
          });

          const asset = (challenge.asset ?? USDC_ADDRESS) as Address;
          const value = parseUnits(challenge.amount, USDC_DECIMALS);

          setStep(2, { state: "running", detail: "Awaiting wallet signature…" });
          const txHash = await writeContractAsync({
            address: asset,
            abi: erc20Abi,
            functionName: "transfer",
            args: [challenge.recipient, value],
          });
          setStep(2, { state: "done", detail: `Signed · ${txHash.slice(0, 12)}…` });

          setStep(3, { state: "running", detail: "Waiting for Base Sepolia confirmation…" });
          const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash });
          if (receipt && receipt.status === "reverted") throw new Error("Payment transaction reverted");
          setStep(3, {
            state: "done",
            detail: `Confirmed in block ${receipt?.blockNumber?.toString() ?? "—"}`,
          });

          setStep(4, { state: "running", detail: "Retrying with x-payment-proof…" });
          const second = await requestResource(url, txHash);
          if (second.status !== 200) throw new Error(`Payment proof rejected (HTTP ${second.status})`);
          const preview =
            typeof second.body === "string"
              ? second.body.slice(0, 80)
              : JSON.stringify(second.body).slice(0, 80);
          setStep(4, { state: "done", detail: preview });

          settle(txHash, "Settled onchain via x402");
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
    [publicClient, pushLog, running, updateAgent, writeContractAsync],
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
