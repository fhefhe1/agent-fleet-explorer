import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, Play, ShoppingBag, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SERVICES, type Agent, type ApiService } from "@/lib/agent-sim";
import type { X402Step } from "@/hooks/use-agent-economy";

export function Marketplace({
  agent,
  steps,
  running,
  gate = null,
  onExecute,
}: {
  agent: Agent | null;
  steps: X402Step[];
  running: boolean;
  gate?: string | null;
  onExecute: (service: ApiService) => void;
}) {
  const [selected, setSelected] = useState<string>(SERVICES[0]!.id);
  const service = SERVICES.find((s) => s.id === selected)!;

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-3">
        <ShoppingBag className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide">API Marketplace</h2>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          x402 · HTTP 402
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-2">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                s.id === selected
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {s.category}
                </Badge>
                <span className="ml-auto font-mono text-xs text-accent">
                  {s.price} USDC/call
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {serviceUrl(s)} · p50 {s.latency}
              </p>

            </button>
          ))}
        </div>

        <div className="rounded-md border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              x402 execution trace
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!agent || running || Boolean(gate)}
              onClick={() => onExecute(service)}
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Execute Onchain Call
            </Button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {gate ?? (agent ? `${agent.name} → ${service.name}` : "Select an agent")}
          </p>

          <ol className="mt-4 space-y-3">
            {(steps.length ? steps : placeholderSteps()).map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5">
                  {s.state === "done" ? (
                    <CheckCircle2 className="size-4 text-accent" />
                  ) : s.state === "failed" ? (
                    <XCircle className="size-4 text-destructive" />
                  ) : s.state === "running" ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <CircleDashed className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div>
                  <p
                    className={`font-mono text-xs ${
                      s.state === "failed"
                        ? "text-destructive"
                        : s.state === "pending"
                          ? "text-muted-foreground"
                          : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function placeholderSteps(): X402Step[] {
  return [
    { label: "HTTP GET", detail: "Agent requests the protected resource", state: "pending" },
    { label: "402 Payment Required", detail: "Server replies with payment challenge", state: "pending" },
    { label: "EIP-712 Signature", detail: "Agent signs the micro-payment intent", state: "pending" },
    { label: "UserOperation → Bundler", detail: "ERC-4337 op sponsored by Paymaster", state: "pending" },
    { label: "200 OK · Payload unlocked", detail: "Resource streamed back to the agent", state: "pending" },
  ];
}
