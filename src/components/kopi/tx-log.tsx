import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { shorten, type TxLog } from "@/lib/agent-sim";

export function TxLogPanel({ logs }: { logs: TxLog[] }) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide">Onchain Transaction Stream</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
          <span className="size-1.5 rounded-full bg-accent pulse-dot" /> live
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="py-2 font-medium">Time</th>
              <th className="py-2 font-medium">Agent</th>
              <th className="py-2 font-medium">Target service</th>
              <th className="py-2 font-medium">Amount</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Tx hash</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No settlements yet — run a test execution.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="py-2.5 text-muted-foreground">
                  {new Date(l.ts).toLocaleTimeString()}
                </td>
                <td className="py-2.5">{l.agentName}</td>
                <td className="py-2.5 text-muted-foreground">{l.service}</td>
                <td className="py-2.5 text-accent">{l.amount.toFixed(4)} USDC</td>
                <td className="py-2.5">
                  <Badge
                    variant="outline"
                    className={
                      l.status === "success"
                        ? "border-accent/40 bg-accent/10 text-accent text-[10px]"
                        : "border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
                    }
                  >
                    {l.status === "success" ? "Success" : "Blocked by policy"}
                  </Badge>
                  {l.note && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{l.note}</span>
                  )}
                </td>
                <td className="py-2.5 text-primary">{shorten(l.hash, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
