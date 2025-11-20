import { useState, useEffect, useCallback } from "react";
import {
  usePrivy,
  useWallets,
  useSign7702Authorization,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { createOtimClient, getCorsConfig } from "@otim/sdk";
import type { OtimClient } from "@otim/sdk";
import { toRlp, toHex } from "viem";
import { sepolia } from "viem/chains";
import { createWalletClient, custom } from "viem";
import { publicClient } from "../wagmi";
import { useSiweLogin } from "./use-siwe-login";

const OTIM_AUTH_TOKEN_KEY = "otimToken";
const CHAIN_ID = 11155111; // sepolia

interface UseOtimAuthReturn {
  otimClient: OtimClient | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isDelegated: boolean;
  isDelegating: boolean;
  error: string | null;
  authenticate: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useOtimAuth(): UseOtimAuthReturn {
  const { authenticated: privyAuthenticated, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();
  const { setActiveWallet } = useSetActiveWallet();
  const { signIn, isSigningIn, error: signInError } = useSiweLogin();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otimClient, setOtimClient] = useState<OtimClient | null>(null);
  const [hasAttemptedDelegation, setHasAttemptedDelegation] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  // set active wallet when available
  useEffect(() => {
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet);
    }
  }, [embeddedWallet, setActiveWallet]);

  // create otim client when wallet is available and authenticated
  useEffect(() => {
    const createClient = async () => {
      if (!embeddedWallet) {
        setOtimClient(null);
        return;
      }

      const storedToken = localStorage.getItem(OTIM_AUTH_TOKEN_KEY);
      if (!storedToken) {
        setOtimClient(null);
        setIsAuthenticated(false);
        return;
      }

      try {
        // create a wallet client from the privy wallet
        const provider = await embeddedWallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: embeddedWallet.address as `0x${string}`,
          chain: sepolia,
          transport: custom(provider),
        });

        const client = createOtimClient({
          walletClient,
          authorizationToken: storedToken,
          ...getCorsConfig("development"),
        });

        setOtimClient(client);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Failed to create Otim client:", err);
        setOtimClient(null);
      }
    };

    createClient();

    // listen for storage events to recreate client when token changes
    const handleStorageChange = () => {
      createClient();
    };

    window.addEventListener("storage", handleStorageChange);
    // also listen for custom storage event from same window
    window.addEventListener("otim-token-set", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("otim-token-set", handleStorageChange);
    };
  }, [embeddedWallet]);

  // watch for token changes to recreate client
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem(OTIM_AUTH_TOKEN_KEY);
      if (token && !otimClient && embeddedWallet) {
        // trigger client recreation
        const event = new Event("otim-token-set");
        window.dispatchEvent(event);
      }
    };

    // check token periodically after sign in
    if (isSigningIn || (!isAuthenticated && privyAuthenticated)) {
      const interval = setInterval(checkToken, 500);
      return () => clearInterval(interval);
    }
  }, [
    isSigningIn,
    isAuthenticated,
    privyAuthenticated,
    otimClient,
    embeddedWallet,
  ]);

  const handleDelegation = useCallback(async () => {
    if (!otimClient || !embeddedWallet || isDelegating) return;

    try {
      setError(null);
      setIsDelegating(true);

      // get the delegate address from the SDK config
      const { otimDelegateAddress } =
        await otimClient.config.getDelegateAddress({
          chainId: CHAIN_ID,
        });

      const nonce = await publicClient.getTransactionCount({
        address: embeddedWallet.address as `0x${string}`,
      });

      const authorization = await signAuthorization({
        chainId: CHAIN_ID,
        contractAddress: otimDelegateAddress as `0x${string}`,
        nonce: nonce,
      });

      // prepare rlp encoded authorization
      const delegateAddressLower =
        otimDelegateAddress.toLowerCase() as `0x${string}`;
      const rlpInput = [
        toHex(CHAIN_ID),
        delegateAddressLower,
        authorization.nonce === 0 ? "0x" : toHex(authorization.nonce),
        authorization.yParity === 0 ? "0x" : toHex(authorization.yParity),
        authorization.r.toLowerCase() as `0x${string}`,
        authorization.s.toLowerCase() as `0x${string}`,
      ] as const;

      const rlpEncoded = toRlp(rlpInput);

      // delegate using sdk
      await otimClient.delegation.delegate({
        signedAuthorization: rlpEncoded,
      });

      setIsDelegated(true);
    } catch (error) {
      console.error("Authorization error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to complete authorization",
      );
      setIsDelegating(false);
    }
  }, [otimClient, embeddedWallet, isDelegating, signAuthorization]);

  // check delegation status when authenticated
  useEffect(() => {
    const checkDelegationStatus = async () => {
      if (!privyAuthenticated || !wallets.length || !otimClient) return;

      const embeddedWallet = wallets.find(
        (wallet) => wallet.walletClientType === "privy",
      );
      if (!embeddedWallet) return;

      const token = window.localStorage.getItem(OTIM_AUTH_TOKEN_KEY);
      if (!token) {
        signIn();
        return;
      }

      try {
        // Workaround: Browsers strip bodies from GET requests, so we send data as query params
        // The proxy extracts them and forwards as GET with body to the API
        const address = embeddedWallet.address as `0x${string}`;
        const chainId = CHAIN_ID;
        
        const response = await fetch(
          `/api/delegation/status?address=${encodeURIComponent(address)}&chainId=${chainId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        const status = {
          delegationStatus: data.delegationStatus || data.status || "NotDelegated",
        };

        setIsDelegated(status.delegationStatus === "Delegated");

        if (status.delegationStatus === "Delegated") {
          setIsDelegating(false);
          // Clear the attempted flag since we're confirmed delegated
          setHasAttemptedDelegation(false);
        } else if (!hasAttemptedDelegation && !isDelegating && !isDelegated) {
          // only attempt delegation once if not already delegated or delegating
          // Also check isDelegated to prevent re-delegation if we previously confirmed it
          setHasAttemptedDelegation(true);
          handleDelegation();
        }
      } catch (error: unknown) {
        // Don't trigger delegation on error - wallet might already be delegated
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServerError =
          errorMessage.includes("500") ||
          errorMessage.includes("Internal Server Error") ||
          errorMessage.includes("Unhandled error") ||
          errorMessage.includes("ServiceError");

        if (isServerError) {
          console.debug("Delegation status check failed (will retry):", errorMessage);
        } else {
          console.warn("Delegation status check error:", errorMessage);
        }
      }
    };

    // check immediately and set up polling
    if (privyAuthenticated && wallets.length > 0 && otimClient) {
      checkDelegationStatus();
      const interval = setInterval(checkDelegationStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [
    privyAuthenticated,
    wallets,
    wallets.length,
    hasAttemptedDelegation,
    otimClient,
    signIn,
    isDelegating,
    handleDelegation,
  ]);

  // reset hasAttemptedDelegation when auth state changes
  useEffect(() => {
    if (!privyAuthenticated) {
      setHasAttemptedDelegation(false);
      setIsAuthenticated(false);
      setIsDelegated(false);
      setError(null);
    }
  }, [privyAuthenticated]);

  const authenticate = useCallback(async () => {
    setError(null);
    await signIn();
  }, [signIn]);

  const logout = useCallback(async () => {
    if (otimClient) {
      try {
        await otimClient.auth.logout();
      } catch (err) {
        console.error("logout api call failed:", err);
      }
    }

    localStorage.removeItem(OTIM_AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
    setIsDelegated(false);
    setError(null);

    // logout from privy
    await privyLogout();
  }, [otimClient, privyLogout]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // merge errors
  const combinedError = error || (signInError ? signInError.message : null);

  return {
    otimClient,
    isAuthenticated,
    isAuthenticating: isSigningIn,
    isDelegated,
    isDelegating,
    error: combinedError,
    authenticate,
    logout,
    clearError,
  };
}
