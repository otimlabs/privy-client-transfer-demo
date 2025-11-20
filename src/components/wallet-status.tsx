import { usePrivy, useWallets } from "@privy-io/react-auth";
import "./wallet-status.css";

export function WalletStatus() {
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="wallet-status">
      <div className="wallet-status__icon">
        <div className="wallet-status__icon-circle">👛</div>
      </div>
      <div className="wallet-status__info">
        <p className="wallet-status__label">
          {user?.email?.address || "Wallet Connected"}
        </p>
        {embeddedWallet?.address && (
          <p className="wallet-status__address">
            {formatAddress(embeddedWallet.address)}
          </p>
        )}
      </div>
    </div>
  );
}
