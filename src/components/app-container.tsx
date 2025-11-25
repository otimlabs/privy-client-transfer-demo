import { usePrivy } from "@privy-io/react-auth";
import { Loader } from "./loader";
import "./app-container.css";

interface AppContainerProps {
  children: React.ReactNode;
}

export function AppContainer({ children }: AppContainerProps) {
  const { ready } = usePrivy();

  if (!ready) {
    return <Loader />;
  }

  return <div className="app-container app-container--ready">{children}</div>;
}
