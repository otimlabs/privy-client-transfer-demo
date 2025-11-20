import { useOtimAuth } from "../hooks";
import "./authentication-panel.css";

export function AuthenticationPanel() {
  const {
    isAuthenticated,
    isAuthenticating,
    isDelegated,
    isDelegating,
    error,
    authenticate,
    logout,
    clearError,
  } = useOtimAuth();

  const handleAuthenticate = async () => {
    clearError();
    await authenticate();
  };

  if (isAuthenticated && isDelegated) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__status">
          <div className="auth-panel__status-indicator auth-panel__status-indicator--success" />
          <span className="auth-panel__status-text">
            Authenticated & Delegated
          </span>
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

  if (isAuthenticating || isDelegating) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__loading">
          <div className="auth-panel__spinner" />
          <span className="auth-panel__loading-text">
            {isAuthenticating
              ? "Authenticating..."
              : "Setting up delegation..."}
          </span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !isDelegated) {
    return (
      <div className="auth-panel">
        <div className="auth-panel__status">
          <div className="auth-panel__status-indicator auth-panel__status-indicator--warning" />
          <span className="auth-panel__status-text">
            Setting up delegation...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      {error && (
        <div className="auth-panel__error">
          <p className="auth-panel__error-text">{error}</p>
          <button
            onClick={clearError}
            className="auth-panel__error-close"
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}
      <button
        onClick={handleAuthenticate}
        className="auth-panel__button auth-panel__button--primary"
        disabled={isAuthenticating}
      >
        Authenticate with Otim
      </button>
    </div>
  );
}
