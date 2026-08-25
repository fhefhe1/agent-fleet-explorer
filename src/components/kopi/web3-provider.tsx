import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { http } from "viem";

export default function Web3Provider({ children }: { children: ReactNode }) {
  // Lazily built: connector setup touches browser globals.
  const [config] = useState(() =>
    getDefaultConfig({
      appName: "KOPICATSOL",
      projectId: import.meta.env["VITE_WALLETCONNECT_PROJECT_ID"] ?? "kopicatsol_demo_project",
      chains: [baseSepolia],
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
