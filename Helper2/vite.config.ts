import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { startBackendPlugin } from './vite-plugin-start-backend';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), startBackendPlugin()],
  server: {
    host: true,
    port: 5176,
    strictPort: false,
    open: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
