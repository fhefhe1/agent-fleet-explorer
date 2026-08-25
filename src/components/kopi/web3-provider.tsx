import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { http } from "viem";

export default function Web3Provider({ children }: { children: ReactNode }) {
  // Lazily built: connector setup touches browser globals.
  const [config] = useState(() =>
    createConfig({
      chains: [baseSepolia],
      connectors: [
        injected({ shimDisconnect: true }),
        coinbaseWallet({ appName: "KOPICATSOL", preference: "all" }),
      ],
      transports: { [baseSepolia.id]: http() },
      ssr: false,
    }),
  );

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider
        initialChain={baseSepolia}
        theme={darkTheme({
          accentColor: "oklch(0.72 0.19 145)",
          accentColorForeground: "#04120a",
          borderRadius: "medium",
          overlayBlur: "small",
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
