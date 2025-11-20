import { createConfig } from "@privy-io/wagmi";
import { http, createPublicClient } from "viem";
import { sepolia } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});
