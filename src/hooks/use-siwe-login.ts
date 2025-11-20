import { useSignMessage, useWallets } from "@privy-io/react-auth";
import { useState, useCallback, useRef } from "react";
import { createSiweMessage } from "viem/siwe";
import { getCorsConfig } from "@otim/sdk";

function generateNonce(): string {
  const charset =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nonceLength = 17;
  let nonce = "";
  for (let i = 0; i < nonceLength; i++) {
    nonce += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return nonce;
}

function parseSignatureToVRS(signature: `0x${string}`) {
  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = Number(`0x${signature.slice(130, 132)}`);
  return { r, s, v };
}

interface UseSiweLoginResult {
  signIn: () => Promise<void>;
  isSigningIn: boolean;
  error: Error | null;
}

export const useSiweLogin = (): UseSiweLoginResult => {
  // Use a ref to store the SIWE message so it's always available when the callback runs
  const siweMessageRef = useRef<string | null>(null);
  // Track if we're currently processing a login to prevent duplicate calls
  const isProcessingRef = useRef<boolean>(false);
  // Track processed signatures to prevent duplicate processing
  const processedSignaturesRef = useRef<Set<string>>(new Set());
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { wallets } = useWallets();

  const handleLoginSuccess = useCallback((token: string) => {
    window.localStorage.setItem("otimToken", token);
    // dispatch custom event to trigger client recreation
    window.dispatchEvent(new Event("otim-token-set"));
    setIsSigningIn(false);
  }, []);

  const handleLoginError = useCallback((err: Error) => {
    setError(err);
    setIsSigningIn(false);
  }, []);

  const { signMessage } = useSignMessage({
    onSuccess: async ({ signature }) => {
      const signatureStr = signature as string;
      
      // Check if we've already processed this exact signature
      if (processedSignaturesRef.current.has(signatureStr)) {
        return;
      }
      
      // Atomically check and set processing flag to prevent duplicate calls
      if (isProcessingRef.current) {
        return;
      }
      
      // Set flag immediately to prevent race conditions
      isProcessingRef.current = true;
      // Mark this signature as being processed
      processedSignaturesRef.current.add(signatureStr);

      try {
        const vrsParsedSignature = parseSignatureToVRS(
          signature as `0x${string}`,
        );

        const message = siweMessageRef.current;
        if (!message) {
          // Don't throw here - if message is null, it might have already been processed
          // Just return early to avoid duplicate processing
          isProcessingRef.current = false;
          processedSignaturesRef.current.delete(signatureStr);
          return;
        }

        const loginUrl = `${getCorsConfig("development").baseURL}/auth/login`;

        // call the auth endpoint directly
        const response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            siwe: message,
            signature: vrsParsedSignature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Authentication failed: ${errorText || response.statusText}`,
          );
        }

        const data = await response.json();
        
        // Clear the ref after successful login
        siweMessageRef.current = null;
        isProcessingRef.current = false;
        // Keep signature in processed set to prevent reprocessing
        
        handleLoginSuccess(data.authorization);
      } catch (err) {
        isProcessingRef.current = false;
        // Remove signature from processed set on error so it can be retried
        processedSignaturesRef.current.delete(signatureStr);
        console.error("[SIWE Login] Error in onSuccess:", err);
        handleLoginError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    onError: (err: unknown) => {
      console.error("[SIWE Login] Error signing message:", err);
      handleLoginError(
        new Error(
          err instanceof Error ? err.message : "Failed to sign message",
        ),
      );
    },
  });

  const signIn = useCallback(async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      isProcessingRef.current = false; // Reset processing flag
      // Clear processed signatures when starting a new sign-in
      processedSignaturesRef.current.clear();

      const embeddedWallet = wallets.find(
        (wallet) => wallet.walletClientType === "privy",
      );

      if (!embeddedWallet?.address) {
        throw new Error("No embedded wallet found");
      }

      const nonce = generateNonce();

      const message = createSiweMessage({
        address: embeddedWallet.address as `0x${string}`,
        chainId: 0,
        nonce,
        statement: `Welcome to Otim! By signing in, you accept the Otim Terms and Conditions (https://otim.com/tac). This request will not trigger a blockchain transaction or cost any gas fees.`,
        domain: window.location.host,
        uri: window.location.origin,
        version: "1",
      });

      // Store message in ref so it's available when the callback runs
      siweMessageRef.current = message;
      signMessage({ message });
    } catch (err) {
      isProcessingRef.current = false;
      console.error("[SIWE Login] Error in signIn:", err);
      handleLoginError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [wallets, signMessage, handleLoginError]);

  return { signIn, isSigningIn, error };
};
