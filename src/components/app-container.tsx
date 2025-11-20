import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useOtimAuth, useLoadingTransition } from "../hooks";
import { Loader } from "./loader";
import "./app-container.css";

interface AppContainerProps {
  children: React.ReactNode;
}

export function AppContainer({ children }: AppContainerProps) {
  const { ready, authenticated } = usePrivy();
  const { otimClient } = useOtimAuth();
  const { isLoading, stopLoading } = useLoadingTransition(2000);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (ready && authenticated && otimClient) {
      setIsReady(true);
      stopLoading();
    } else if (ready && !authenticated) {
      setIsReady(true);
      stopLoading();
    }
  }, [ready, authenticated, otimClient, stopLoading]);

  if (!isReady || (authenticated && isLoading)) {
    return <Loader />;
  }

  return (
    <div
      className={`app-container ${isLoading ? "app-container--loading" : "app-container--ready"}`}
    >
      {children}
    </div>
  );
}
