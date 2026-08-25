import { Activity, AlertTriangle, Droplets, ExternalLink } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TARGET_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_FAUCET_URL,
  erc20Abi,
} from "@/lib/web3";

export function WalletBar({
  faucetBalance,
  onFaucet,
}: {
  faucetBalance: number;
  onFaucet: () => void;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  const { data: onchain } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  });

  const usdc =
    (onchain ? Number(formatUnits(onchain as bigint, USDC_DECIMALS)) : 0) + faucetBalance;

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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isConnected && (
            <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 font-mono text-xs sm:flex">
              <span className="text-muted-foreground">USDC</span>
              <span className="text-accent">{usdc.toFixed(3)}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!isConnected}
            onClick={() => {
              onFaucet();
              window.open(USDC_FAUCET_URL, "_blank", "noopener,noreferrer");
              toast.success("Test USDC credited to your Agent Fleet", {
                description: "Circle faucet opened for real Base Sepolia USDC",
              });
            }}
          >
            <Droplets className="size-3.5" /> USDC Faucet
            <ExternalLink className="size-3 opacity-60" />
          </Button>

          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </div>

      {wrongNetwork && (
        <div className="border-t border-destructive/40 bg-destructive/10">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
            <AlertTriangle className="size-4 text-destructive" />
            <p className="text-xs text-destructive">
              Wrong network. KOPICATSOL settles on Base Sepolia Testnet (chain 84532).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 text-xs"
              onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            >
              Switch to Base Sepolia
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
