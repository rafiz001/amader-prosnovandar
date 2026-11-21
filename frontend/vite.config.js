import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No dev proxy: the browser build talks to the Rust WebAssembly module, and the
// Tauri build talks to the Rust backend through `invoke`. There is no HTTP API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
});
