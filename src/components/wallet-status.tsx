import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import "./wallet-status.css";

export function WalletStatus() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [copied, setCopied] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const copyAddress = async () => {
    if (embeddedWallet?.address) {
      await navigator.clipboard.writeText(embeddedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="wallet-status">
      <div className="wallet-status__info">
        <p className="wallet-status__label">
          {user?.email?.address || "Wallet Connected"}
        </p>
        {embeddedWallet?.address && (
          <button 
            className="wallet-status__address"
            onClick={copyAddress}
            title="Click to copy"
          >
            {embeddedWallet.address}
            <span className="wallet-status__copy-hint">
              {copied ? "Copied!" : "Click to copy"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
