import { usePrivy } from "@privy-io/react-auth";
import { WalletStatus } from "./wallet-status";
import { AuthenticationPanel } from "./authentication-panel";

export function MainContent() {
  const { login, authenticated } = usePrivy();

  return (
    <div className="app">
      <div className="app__content">
        <div className="app__logo">
          <span className="app__logo-icon">⚡</span>
        </div>

        <h1 className="app__title">Flash Transfer</h1>

        {!authenticated ? (
          <>
            <p className="app__description">Connect with Privy</p>
            <div className="app__connect-wrapper">
              <button onClick={login} className="app__connect-button">
                Login with Privy
              </button>
            </div>
          </>
        ) : (
          <>
            <WalletStatus />
            <AuthenticationPanel />
          </>
        )}
      </div>

      <footer className="app__footer">
        <p className="app__footer-text">Powered by Otim SDK</p>
      </footer>
    </div>
  );
}
