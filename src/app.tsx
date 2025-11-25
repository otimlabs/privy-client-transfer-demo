import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppContainer } from "./components";
import { MainContent } from "./components/main-content";
import { OtimAuthProvider } from "./hooks";
import { wagmiConfig } from "./wagmi";
import "./app.css";

const queryClient = new QueryClient();

const privyConfig = {
  appearance: {
    theme: "light" as const,
    accentColor: "#8B5CF6" as `#${string}`,
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users" as const,
    },
  },
};

function App() {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ""}
      config={privyConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <OtimAuthProvider>
            <AppContainer>
              <MainContent />
            </AppContainer>
          </OtimAuthProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default App;
