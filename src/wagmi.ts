import { createConfig } from "@privy-io/wagmi";
import { http, createPublicClient, type Chain } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

// Get chain from env, default to Base Sepolia (84532)
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || "84532", 10);

const chains: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
};

export const chain = chains[chainId] ?? baseSepolia;

export const wagmiConfig = createConfig({
  chains: [chain],
  transports: {
    [chain.id]: http(),
  },
});

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});
