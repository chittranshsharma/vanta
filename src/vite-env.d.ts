/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  /** Comma-separated client flags; see src/lib/flags.ts. Build-time only. */
  readonly VITE_FLAGS?: string;
  /** Optional operator-owned endpoint for scrubbed client error events. */
  readonly VITE_TELEMETRY_ENDPOINT?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
