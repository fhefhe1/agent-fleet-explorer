import { encodePacked, getCreate2Address, keccak256, toHex, type Address } from "viem";
import { baseSepolia } from "viem/chains";

/** Base Sepolia is the only chain KOPICATSOL settles on. */
export const TARGET_CHAIN = baseSepolia;
export const TARGET_CHAIN_ID = 84532;

/** Canonical ERC-4337 v0.6 EntryPoint + SimpleAccount factory on Base Sepolia. */
export const ENTRY_POINT: Address = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const ACCOUNT_FACTORY: Address = "0x9406Cc6185a346906296840746125a0E44976454";

/** Circle USDC test token on Base Sepolia. */
export const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const USDC_DECIMALS = 6;
export const USDC_FAUCET_URL = "https://faucet.circle.com/";

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Counterfactual (deterministic) ERC-4337 smart-account address for an owner EOA.
 * Same math shape as SimpleAccountFactory.getAddress(owner, salt): CREATE2 over
 * a proxy init-code hash, so the address is stable before deployment.
 */
const PROXY_INIT_CODE_HASH = keccak256(toHex("kopicatsol-erc4337-simple-account-proxy"));

export function predictSmartAccount(owner: Address, salt: bigint): Address {
  const salted = keccak256(encodePacked(["address", "uint256"], [owner, salt]));
  return getCreate2Address({
    from: ACCOUNT_FACTORY,
    salt: salted,
    bytecodeHash: PROXY_INIT_CODE_HASH,
  });
}

export function explorerTx(hash: string) {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `https://sepolia.basescan.org/address/${address}`;
}
