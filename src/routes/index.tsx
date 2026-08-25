import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

// Wallet SDKs are browser-only: load the dashboard after hydration.
const Dashboard = lazy(() => import("@/components/kopi/dashboard"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOPICATSOL — Agentic AI Economic Infrastructure" },
      {
        name: "description",
        content:
          "Connect a Base Sepolia wallet, deploy ERC-4337 agent smart accounts, enforce USDC spend policy, and settle x402 micro-payments.",
      },
      { property: "og:title", content: "KOPICATSOL — Agentic AI Economic Infrastructure" },
      {
        property: "og:description",
        content:
          "Web3 dashboard for autonomous AI agents paying per API call with HTTP 402 micro-payments on Base Sepolia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Booting() {
  return (
    <div className="grid min-h-screen place-items-center">
      <p className="font-mono text-xs tracking-widest text-muted-foreground">
        INITIALIZING KOPICATSOL RUNTIME…
      </p>
    </div>
  );
}

function Home() {
  return (
    <ClientOnly fallback={<Booting />}>
      <Suspense fallback={<Booting />}>
        <Dashboard />
      </Suspense>
    </ClientOnly>
  );
}
