import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { startBackendPlugin } from './vite-plugin-start-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname, // Явно указываем директорию, где находится vite.config.ts
  plugins: [
    react(),
    // Отключаем плагин для production сборки (он только для dev режима)
    process.env.NODE_ENV !== 'production' ? startBackendPlugin() : undefined
  ].filter(Boolean),
  server: {
    host: true,
    port: 5176,
    strictPort: false,
    open: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
