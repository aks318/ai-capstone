import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development, requests to /api are forwarded to the Express server.
// The browser only ever talks to the Vite dev server, so no API key is exposed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
