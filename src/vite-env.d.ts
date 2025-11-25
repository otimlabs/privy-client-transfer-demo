/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_CHAIN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Buffer polyfill for browser
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}
