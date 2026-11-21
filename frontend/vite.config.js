import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No dev proxy: the browser build talks to the Rust WebAssembly module, and the
// Tauri build talks to the Rust backend through `invoke`. There is no HTTP API.
//
// GitHub Project Pages serve the app from /<repo>/, so CI sets VITE_BASE.
// Desktop/mobile builds and local development keep the default "/".
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
});
