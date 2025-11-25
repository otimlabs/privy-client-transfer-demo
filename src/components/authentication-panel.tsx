import { useOtimAuth } from "../hooks";
import "./authentication-panel.css";

export function AuthenticationPanel() {
  const { isLoading, isDelegated, error, logout } = useOtimAuth();

  if (isLoading) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__loading">
          <div className="auth-panel__spinner" />
          <span className="auth-panel__loading-text">Setting up...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__error">
          <p className="auth-panel__error-text">{error}</p>
        </div>
        <button
          onClick={logout}
          className="auth-panel__button auth-panel__button--secondary"
        >
          Logout & Retry
        </button>
      </div>
    );
  }

  if (isDelegated) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__status">
          <div className="auth-panel__status-indicator auth-panel__status-indicator--success" />
          <span className="auth-panel__status-text">Ready</span>
        </div>
        <button
          onClick={logout}
          className="auth-panel__button auth-panel__button--secondary"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <div className="auth-panel__loading">
        <div className="auth-panel__spinner" />
        <span className="auth-panel__loading-text">Initializing...</span>
      </div>
    </div>
  );
}
