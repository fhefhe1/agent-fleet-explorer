import { useCallback, useEffect, useRef, useState } from "react";
import { predictSmartAccount } from "@/lib/web3";
import type { Address } from "viem";
import {
  makeTxHash,
  makeWallet,
  seedTelemetry,
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
  { label: "EIP-712 Signature", detail: "Agent signs the micro-payment intent offchain" },
  { label: "UserOperation → Bundler", detail: "ERC-4337 op sponsored by Paymaster" },
  { label: "200 OK · Payload unlocked", detail: "Resource streamed back to the agent" },
];

export function useAgentEconomy() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [steps, setSteps] = useState<X402Step[]>([]);
  const [running, setRunning] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState(0);
  const burstRef = useRef<Record<string, number[]>>({});

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

      const now = Date.now();
      const key = `${agent.id}:${service.id}`;
      const hits = (burstRef.current[key] ?? []).filter((t) => now - t < 10_000);
      hits.push(now);
      burstRef.current[key] = hits;

      const loopBreach = agent.loopProtection && hits.length > 5;
      const overBudget = agent.spent + service.price > agent.dailyLimit;
      const blockedAt = loopBreach ? 1 : overBudget ? 2 : -1;

      for (let i = 0; i < STEP_TEMPLATE.length; i++) {
        setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, state: "running" } : st)));
        await new Promise((r) => setTimeout(r, 460));
        if (i === blockedAt) {
          setSteps((s) =>
            s.map((st, idx) =>
              idx === i
                ? {
                    ...st,
                    state: "failed",
                    detail: loopBreach
                      ? "Loop protection tripped: >5 calls / 10s to same endpoint"
                      : "Daily USDC budget exceeded — policy rejected the intent",
                  }
                : st,
            ),
          );
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
        setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, state: "done" } : st)));
      }

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
        hash: makeTxHash(),
        note: agent.paymaster ? "Gas sponsored by Paymaster" : "Gas paid in USDC",
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
      setRunning(false);
    },
    [pushLog, running, updateAgent],
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
