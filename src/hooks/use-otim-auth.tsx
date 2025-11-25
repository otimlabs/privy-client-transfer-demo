import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import {
  usePrivy,
  useWallets,
  useSign7702Authorization,
  useSignMessage,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { createOtimClient, getCorsConfig } from "@otim/sdk";
import type { OtimClient } from "@otim/sdk";
import { toRlp, toHex } from "viem";
import { createWalletClient, custom } from "viem";
import { createSiweMessage } from "viem/siwe";
import { publicClient, chain } from "../wagmi";

const TOKEN_KEY = "otimToken";
const WALLET_KEY = "otimWallet";
const CHAIN_ID = chain.id;

function generateNonce(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: 17 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface OtimAuthContextValue {
  otimClient: OtimClient | null;
  walletAddress: string | null;
  isLoading: boolean;
  isDelegated: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const OtimAuthContext = createContext<OtimAuthContextValue | null>(null);

export function OtimAuthProvider({ children }: { children: ReactNode }) {
  const { authenticated, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();
  const { setActiveWallet } = useSetActiveWallet();
  const { signMessage } = useSignMessage();

  const [otimClient, setOtimClient] = useState<OtimClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current wallet address to detect changes
  const currentWalletRef = useRef<string | null>(null);
  // Prevent concurrent auth attempts
  const isAuthenticatingRef = useRef(false);
  // Track if we've completed setup for current wallet
  const setupCompleteRef = useRef(false);
  // Prevent re-auth during logout
  const isLoggingOutRef = useRef(false);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address ?? null;

  // Set active wallet
  useEffect(() => {
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet);
    }
  }, [embeddedWallet, setActiveWallet]);

  // Clear state when wallet changes or user logs out
  useEffect(() => {
    const newAddress = walletAddress?.toLowerCase() ?? null;
    const prevAddress = currentWalletRef.current;

    if (newAddress !== prevAddress) {
      // Wallet changed - reset everything
      currentWalletRef.current = newAddress;
      setupCompleteRef.current = false;
      isAuthenticatingRef.current = false;
      setOtimClient(null);
      setIsDelegated(false);
      setError(null);
      setIsLoading(false);

      // Clear stored data if wallet changed
      if (prevAddress && newAddress !== prevAddress) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WALLET_KEY);
      }
    }
  }, [walletAddress]);

  // Main auth flow
  useEffect(() => {
    if (!authenticated || !embeddedWallet || !walletAddress) {
      return;
    }

    // Don't re-auth during logout
    if (isLoggingOutRef.current) {
      return;
    }

    // Already set up for this wallet
    if (setupCompleteRef.current && otimClient) {
      return;
    }

    // Already in progress
    if (isAuthenticatingRef.current) {
      return;
    }

    const runAuthFlow = async () => {
      isAuthenticatingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedWallet = localStorage.getItem(WALLET_KEY);
        const currentAddress = walletAddress.toLowerCase();

        let token = storedToken;

        // Need new token if none exists or wallet changed
        if (!token || storedWallet?.toLowerCase() !== currentAddress) {
          console.log("[Otim] Authenticating with SIWE...");
          token = await authenticateWithSiwe();
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(WALLET_KEY, currentAddress);
          console.log("[Otim] SIWE authentication complete");
        }

        // Create client
        console.log("[Otim] Creating Otim client...");
        const provider = await embeddedWallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: walletAddress as `0x${string}`,
          chain,
          transport: custom(provider),
        });

        const client = createOtimClient({
          walletClient,
          authorizationToken: token,
          ...getCorsConfig("development"),
        });

        setOtimClient(client);

        // Check delegation status
        console.log("[Otim] Checking delegation status...");
        const delegated = await checkDelegation(token, walletAddress);
        console.log("[Otim] Is delegated:", delegated);
        
        if (!delegated) {
          console.log("[Otim] Performing delegation...");
          await performDelegation(client);
          console.log("[Otim] Delegation complete");
        }

        setIsDelegated(true);
        setupCompleteRef.current = true;
        console.log("[Otim] Setup complete");
      } catch (err) {
        console.error("[Otim] Auth flow error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        // Clear bad token
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WALLET_KEY);
      } finally {
        setIsLoading(false);
        isAuthenticatingRef.current = false;
      }
    };

    const authenticateWithSiwe = async (): Promise<string> => {
      const message = createSiweMessage({
        address: walletAddress as `0x${string}`,
        chainId: 0,
        nonce: generateNonce(),
        statement: "Welcome to Otim! By signing in, you accept the Otim Terms and Conditions (https://otim.com/tac). This request will not trigger a blockchain transaction or cost any gas fees.",
        domain: window.location.host,
        uri: window.location.origin,
        version: "1",
      });

      const { signature } = await signMessage({ message });

      const r = signature.slice(0, 66) as `0x${string}`;
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
      const v = Number(`0x${signature.slice(130, 132)}`);

      const response = await fetch(`${getCorsConfig("development").baseURL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siwe: message, signature: { r, s, v } }),
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${await response.text()}`);
      }

      const data = await response.json();
      return data.authorization;
    };

    const checkDelegation = async (token: string, address: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/delegation/status?address=${encodeURIComponent(address)}&chainId=${CHAIN_ID}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) return false;

        const data = await response.json();
        return (data.delegationStatus || data.status) === "Delegated";
      } catch {
        return false;
      }
    };

    const performDelegation = async (client: OtimClient) => {
      const { otimDelegateAddress } = await client.config.getDelegateAddress({ chainId: CHAIN_ID });

      const nonce = await publicClient.getTransactionCount({
        address: walletAddress as `0x${string}`,
      });

      const authorization = await signAuthorization({
        chainId: CHAIN_ID,
        contractAddress: otimDelegateAddress as `0x${string}`,
        nonce,
      });

      const rlpEncoded = toRlp([
        toHex(CHAIN_ID),
        otimDelegateAddress.toLowerCase() as `0x${string}`,
        authorization.nonce === 0 ? "0x" : toHex(authorization.nonce),
        authorization.yParity === 0 ? "0x" : toHex(authorization.yParity),
        authorization.r.toLowerCase() as `0x${string}`,
        authorization.s.toLowerCase() as `0x${string}`,
      ]);

      await client.delegation.delegate({ signedAuthorization: rlpEncoded });
    };

    runAuthFlow();
  }, [authenticated, embeddedWallet, walletAddress, signMessage, signAuthorization, otimClient]);

  const logout = useCallback(async () => {
    console.log("[Otim] Logging out...");
    
    // Set flag to prevent re-auth during logout
    isLoggingOutRef.current = true;
    
    if (otimClient) {
      try {
        console.log("[Otim] Calling Otim logout API...");
        await otimClient.auth.logout();
        console.log("[Otim] Otim logout complete");
      } catch (err) {
        console.error("[Otim] Logout API error:", err);
      }
    }

    console.log("[Otim] Clearing local storage...");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);

    console.log("[Otim] Clearing state...");
    setOtimClient(null);
    setIsDelegated(false);
    setError(null);
    setIsLoading(false);
    setupCompleteRef.current = false;
    currentWalletRef.current = null;
    isAuthenticatingRef.current = false;

    console.log("[Otim] Calling Privy logout...");
    await privyLogout();
    
    isLoggingOutRef.current = false;
    console.log("[Otim] Logout complete");
  }, [otimClient, privyLogout]);

  const value: OtimAuthContextValue = {
    otimClient,
    walletAddress,
    isLoading,
    isDelegated,
    error,
    logout,
  };

  return (
    <OtimAuthContext.Provider value={value}>
      {children}
    </OtimAuthContext.Provider>
  );
}

export function useOtimAuth(): OtimAuthContextValue {
  const context = useContext(OtimAuthContext);
  if (!context) {
    throw new Error("useOtimAuth must be used within OtimAuthProvider");
  }
  return context;
}
