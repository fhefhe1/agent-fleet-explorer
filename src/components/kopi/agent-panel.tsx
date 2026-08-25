import { useState } from "react";
import { Bot, Copy, Cpu, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASKS, shorten, type Agent, type AgentStatus } from "@/lib/agent-sim";

const STATUS: Record<AgentStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-accent/15 text-accent border-accent/40" },
  paused: { label: "Paused", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  "rate-limited": { label: "Rate-limited", cls: "bg-warning/15 text-warning border-warning/40" },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const s = STATUS[status];
  return (
    <Badge variant="outline" className={`gap-1.5 text-[10px] uppercase ${s.cls}`}>
      <span className="size-1.5 rounded-full bg-current pulse-dot" />
      {s.label}
    </Badge>
  );
}

export function AgentPanel({
  agents,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onRemove,
  canDeploy = true,
}: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: {
    name: string;
    task: string;
    dailyLimit: number;
    paymaster: boolean;
    loopProtection: boolean;
  }) => Agent;
  onUpdate: (id: string, patch: Partial<Agent>) => void;
  onRemove: (id: string) => void;
  canDeploy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState(TASKS[0]!);
  const [limit, setLimit] = useState(25);
  const [paymaster, setPaymaster] = useState(true);
  const [loop, setLoop] = useState(true);

  function submit() {
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    const agent = onCreate({
      name: name.trim().toUpperCase(),
      task,
      dailyLimit: limit,
      paymaster,
      loopProtection: loop,
    });
    onSelect(agent.id);
    setOpen(false);
    setName("");
    toast.success("Smart account deployed", { description: shorten(agent.wallet, 6) });
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-3">
        <Bot className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wide">Agent Fleet</h2>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ERC-4337
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto gap-1.5" disabled={!canDeploy}>
              <Plus className="size-3.5" /> Deploy Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Deploy Autonomous Agent</DialogTitle>
              <DialogDescription>
                Provisions a dedicated ERC-4337 smart contract wallet with onchain spend policy.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  placeholder="KOPI-SCOUT-03"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Primary task</Label>
                <Select value={task} onValueChange={setTask}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASKS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Daily spend limit</Label>
                  <span className="font-mono text-sm text-primary">{limit.toFixed(2)} USDC</span>
                </div>
                <Slider
                  value={[limit]}
                  min={1}
                  max={250}
                  step={1}
                  onValueChange={(v) => setLimit(v[0] ?? 1)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Paymaster gas policy</p>
                  <p className="text-xs text-muted-foreground">Sponsor gas, agent pays in USDC</p>
                </div>
                <Switch checked={paymaster} onCheckedChange={setPaymaster} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Loop payment protection</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-pause on &gt;5 calls / 10s to one endpoint
                  </p>
                </div>
                <Switch checked={loop} onCheckedChange={setLoop} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} className="gap-2">
                <Zap className="size-4" /> Deploy smart account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {agents.map((a) => {
          const pct = Math.min(100, (a.spent / a.dailyLimit) * 100);
          const selected = a.id === selectedId;
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(a.id);
              }}
              className={`cursor-pointer rounded-md border p-4 text-left transition-colors ${
                selected
                  ? "border-primary/60 bg-primary/5 glow"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <span className="font-display text-sm font-semibold">{a.name}</span>
                <span className="ml-auto">
                  <AgentStatusBadge status={a.status} />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.task}</p>
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                {shorten(a.wallet, 6)}
                <Copy
                  className="size-3 cursor-pointer hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigator.clipboard.writeText(a.wallet);
                    toast.success("Smart account copied");
                  }}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">daily budget</span>
                  <span className={pct > 80 ? "text-destructive" : "text-accent"}>
                    {a.spent.toFixed(3)} / {a.dailyLimit.toFixed(2)} USDC
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                {a.paymaster && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="size-3 text-accent" /> Paymaster
                  </span>
                )}
                <span
                  className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(a.id);
                  }}
                >
                  <Trash2 className="size-3" /> revoke
                </span>
              </div>
              {selected && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>Loop protection</span>
                    <Switch
                      checked={a.loopProtection}
                      onCheckedChange={(v) => onUpdate(a.id, { loopProtection: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Agent enabled</span>
                    <Switch
                      checked={a.status !== "paused"}
                      onCheckedChange={(v) => onUpdate(a.id, { status: v ? "active" : "paused" })}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Daily max budget</span>
                      <span className="font-mono text-primary">
                        {a.dailyLimit.toFixed(2)} USDC
                      </span>
                    </div>
                    <Slider
                      value={[a.dailyLimit]}
                      min={1}
                      max={250}
                      step={1}
                      onValueChange={(v) => onUpdate(a.id, { dailyLimit: v[0] ?? 1 })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
