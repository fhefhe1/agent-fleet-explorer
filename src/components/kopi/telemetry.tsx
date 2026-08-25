import { Gauge, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { reputation, type Agent, type TelemetryPoint } from "@/lib/agent-sim";
import { Progress } from "@/components/ui/progress";

export function Telemetry({
  data,
  agent,
}: {
  data: TelemetryPoint[];
  agent: Agent | null;
}) {
  const score = agent ? reputation(agent) : 0;
  const pct = agent ? Math.min(100, (agent.spent / agent.dailyLimit) * 100) : 0;

  return (
    <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">Spending Velocity</h2>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">USDC / 5min</span>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#spendFill)"
              />
              <Line
                type="monotone"
                dataKey="budget"
                stroke="var(--color-chart-5)"
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide">Agent Reputation</h2>
        </div>
        {agent ? (
          <div className="space-y-4">
            <div>
              <p className="font-display text-5xl font-bold neon-text">{score}</p>
              <p className="text-xs text-muted-foreground">
                score / 1000 · {agent.name}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Budget compliance</span>
                <span className="font-mono">{(100 - pct).toFixed(0)}%</span>
              </div>
              <Progress value={100 - pct} className="h-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <Stat label="successful" value={agent.success} tone="text-accent" />
              <Stat label="policy blocks" value={agent.blocked} tone="text-destructive" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select an agent to view reputation.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className={`text-xl ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
