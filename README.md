# AgentFlow Wallet

Create a Web3 Dashboard & Simulator for an "Agentic AI Economic Infrastructure" MVP. This platform manages automated crypto wallets and micro-payments for autonomous AI Agents using ERC-4337 (Account Abstraction) and HTTP 402 (x402 protocol) concept over a fast Layer-2 network (e.g., Base or Arbitrum).

### KEY FEATURES & UI COMPONENTS:

1. Dashboard Header & Wallet Connect:

- Web3 Wallet Connection (RainbowKit / Wagmi style interface).

- Network switcher default to Base Sepolia Testnet.

2. AI Agent Management Panel (Create & Deploy Agent):

- Form to create an AI Agent with parameters: Agent Name, Primary Task (e.g., Data Scraping, LLM Inference), Spend Limit (Daily/Monthly in USDC), and Gas Policy (Paymaster enabled).

- Generating a dedicated ERC-4337 Smart Contract Wallet address for the agent upon creation.

3. Programmatic Budget & Safety Controls (Software Limits):

- Visual controls to set "Daily Max Budget" in USDC.

- Loop Payment Protection toggle: Auto-pause agent wallet if >5 transactions occur within 10 seconds to same API endpoint.

- Spending velocity indicator (charts showing real-time token depletion).

4. API Marketplace & x402 (HTTP 402) Payment Simulator:

- A interactive mock marketplace listing pay-per-use APIs (e.g., "Web Scraper API - 0.001 USDC/call", "SerpData API - 0.005 USDC/call").

- A "Test AI Execution" button that simulates an AI Agent sending an HTTP request, receiving a 402 Payment Required status, automatically signing an EIP-712 micro-payment via ERC-4337 Paymaster, and unlocking the API payload instantly.

5. On-Chain Transaction & Agent Reputation Log:

- Real-time stream of agent transactions showing: Timestamp, Agent ID, Target Service, Amount (USDC), Status (Success/Blocked by Policy), and Mock Tx Hash.

- Agent Reputation Score card based on successful execution history and budget compliance.

### DESIGN & STYLING:

- Dark Mode / Futuristic Cyberpunk FinTech Aesthetic (Deep Slate/Black background, Electric Cyan/Neon Green accents).

- High visual scannability using clean data cards, live indicators, status badges (Active, Paused, Rate-limited), and intuitive modals.

- Clean Code Structure using React, Tailwind CSS, Lucide icons, and Recharts for budget telemetry. jangan ulang kembali kalimat yang sudah di tulis di sini agar tidak mengambil kredit yang tersisa

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/676b83b6-4498-4876-95f5-b3f576ee870d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
