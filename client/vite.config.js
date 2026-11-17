import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy keeps the API same-origin, so the HTTP-only auth cookie just works in dev.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
});
