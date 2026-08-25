import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount, useChainId } from "wagmi";
import { Toaster } from "@/components/ui/sonner";
import Web3Provider from "@/components/kopi/web3-provider";
import { WalletBar } from "@/components/kopi/wallet-bar";
import { AgentPanel } from "@/components/kopi/agent-panel";
import { Marketplace } from "@/components/kopi/marketplace";
import { Telemetry } from "@/components/kopi/telemetry";
import { TxLogPanel } from "@/components/kopi/tx-log";
import { useAgentEconomy } from "@/hooks/use-agent-economy";
import { TARGET_CHAIN_ID } from "@/lib/web3";

export default function Dashboard() {
  return (
    <Web3Provider>
      <DashboardInner />
    </Web3Provider>
  );
}

function DashboardInner() {
  const eco = useAgentEconomy();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onBaseSepolia = isConnected && chainId === TARGET_CHAIN_ID;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => eco.agents.find((a) => a.id === selectedId) ?? eco.agents[0] ?? null,
    [eco.agents, selectedId],
  );

  const totalSpent = eco.agents.reduce((s, a) => s + a.spent, 0);
  const totalBudget = eco.agents.reduce((s, a) => s + a.dailyLimit, 0);

  const gate = !isConnected
    ? "Connect an EVM wallet to execute"
    : !onBaseSepolia
      ? "Switch to Base Sepolia (84532) to execute"
      : !selected
        ? "Deploy an agent first"
        : selected.status === "paused"
          ? `${selected.name} is disabled by policy`
          : null;

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />
      <WalletBar faucetBalance={eco.faucetBalance} onFaucet={eco.fundFaucet} />

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Active agents"
            value={String(eco.agents.filter((a) => a.status === "active").length)}
            sub="onchain smart accounts"
          />
          <Kpi
            label="Daily spend"
            value={`${totalSpent.toFixed(3)}`}
            sub={`of ${totalBudget.toFixed(2)} USDC cap`}
          />
          <Kpi
            label="Settled calls"
            value={String(eco.logs.filter((l) => l.status === "success").length)}
            sub="x402 micro-payments"
          />
          <Kpi
            label="Policy blocks"
            value={String(eco.logs.filter((l) => l.status === "blocked").length)}
            sub="budget / loop guard"
            tone="text-destructive"
          />
        </div>

        <AgentPanel
          agents={eco.agents}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onCreate={(input) => eco.createAgent(input, address ?? null)}
          onUpdate={eco.updateAgent}
          onRemove={eco.removeAgent}
          canDeploy={onBaseSepolia}
        />

        <Telemetry data={eco.telemetry} agent={selected} />

        <Marketplace
          agent={selected}
          steps={eco.steps}
          running={eco.running}
          gate={gate}
          onExecute={(svc) => {
            if (!selected) return;
            if (gate) {
              toast.error(gate);
              return;
            }
            void eco.execute(selected, svc);
          }}
        />

        <TxLogPanel logs={eco.logs} />

        <p className="pb-6 text-center font-mono text-[11px] text-muted-foreground">
          KOPICATSOL MVP · Base Sepolia testnet · x402 settlement is simulated, no mainnet funds
          move
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
