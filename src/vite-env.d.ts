/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
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
