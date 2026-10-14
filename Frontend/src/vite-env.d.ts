/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for a deployed build, e.g. `https://api.example.co.nz`. Optional locally. */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
