import { Activity, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shorten } from "@/lib/agent-sim";
import { toast } from "sonner";

const NETWORKS = [
  { id: "base-sepolia", label: "Base Sepolia", tag: "Testnet" },
  { id: "base", label: "Base Mainnet", tag: "L2" },
  { id: "arbitrum-sepolia", label: "Arbitrum Sepolia", tag: "Testnet" },
];

export function WalletBar({
  connected,
  address,
  network,
  onConnect,
  onDisconnect,
  onNetwork,
}: {
  connected: boolean;
  address: string | null;
  network: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onNetwork: (id: string) => void;
}) {
  const current = NETWORKS.find((n) => n.id === network) ?? NETWORKS[0]!;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-primary/15 glow">
            <Activity className="size-5 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-widest neon-text">KOPICATSOL</p>
            <p className="text-[11px] text-muted-foreground">Agentic AI Economic Infrastructure</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
                <span className="size-2 rounded-full bg-accent pulse-dot" />
                {current.label}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {NETWORKS.map((n) => (
                <DropdownMenuItem key={n.id} onClick={() => onNetwork(n.id)} className="gap-3">
                  <span className="text-sm">{n.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{n.tag}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {connected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2 font-mono text-xs">
                  <Wallet className="size-3.5" />
                  {shorten(address)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    void navigator.clipboard.writeText(address);
                    toast.success("Address copied");
                  }}
                >
                  <Copy className="size-3.5" /> Copy address
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDisconnect}>
                  <LogOut className="size-3.5" /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" className="gap-2" onClick={onConnect}>
              <Wallet className="size-4" /> Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
