/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGORA_APP_ID?: string;
  readonly VITE_AGORA_CHANNEL?: string;
  readonly VITE_AGORA_TOKEN?: string;
  readonly VITE_AGORA_UID?: string;
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
