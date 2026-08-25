import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { WalletBar } from "@/components/kopi/wallet-bar";
import { AgentPanel } from "@/components/kopi/agent-panel";
import { Marketplace } from "@/components/kopi/marketplace";
import { Telemetry } from "@/components/kopi/telemetry";
import { TxLogPanel } from "@/components/kopi/tx-log";
import { useAgentEconomy } from "@/hooks/use-agent-economy";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOPICATSOL — Agentic AI Economic Infrastructure" },
      {
        name: "description",
        content:
          "Deploy ERC-4337 agent wallets, enforce USDC spend policies, and simulate x402 micro-payments on Base Sepolia.",
      },
      { property: "og:title", content: "KOPICATSOL — Agentic AI Economic Infrastructure" },
      {
        property: "og:description",
        content:
          "Web3 dashboard and simulator for autonomous AI agents paying per API call with HTTP 402 micro-payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const eco = useAgentEconomy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => eco.agents.find((a) => a.id === selectedId) ?? eco.agents[0] ?? null,
    [eco.agents, selectedId],
  );

  const totalSpent = eco.agents.reduce((s, a) => s + a.spent, 0);
  const totalBudget = eco.agents.reduce((s, a) => s + a.dailyLimit, 0);

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />
      <WalletBar
        connected={eco.connected}
        address={eco.address}
        network={eco.network}
        onConnect={eco.connect}
        onDisconnect={eco.disconnect}
        onNetwork={eco.setNetwork}
      />

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Active agents" value={String(eco.agents.filter((a) => a.status === "active").length)} sub="onchain smart accounts" />
          <Kpi label="Daily spend" value={`${totalSpent.toFixed(3)}`} sub={`of ${totalBudget.toFixed(2)} USDC cap`} />
          <Kpi label="Settled calls" value={String(eco.logs.filter((l) => l.status === "success").length)} sub="x402 micro-payments" />
          <Kpi label="Policy blocks" value={String(eco.logs.filter((l) => l.status === "blocked").length)} sub="budget / loop guard" tone="text-destructive" />
        </div>

        <AgentPanel
          agents={eco.agents}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onCreate={eco.createAgent}
          onUpdate={eco.updateAgent}
          onRemove={eco.removeAgent}
        />

        <Telemetry data={eco.telemetry} agent={selected} />

        <Marketplace
          agent={selected}
          steps={eco.steps}
          running={eco.running}
          onExecute={(svc) => {
            if (!selected) return;
            if (selected.status === "paused") {
              toast.error("Agent is paused by policy");
              return;
            }
            void eco.execute(selected, svc);
          }}
        />

        <TxLogPanel logs={eco.logs} />

        <p className="pb-6 text-center font-mono text-[11px] text-muted-foreground">
          KOPICATSOL MVP · simulated environment · no real funds are moved
        </p>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-3xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
