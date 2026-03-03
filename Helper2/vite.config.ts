import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { startBackendPlugin } from './vite-plugin-start-backend';
import path from 'path';
import { fileURLToPath } from 'url';

// Явно определяем директорию, где находится vite.config.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  // ЯВНО указываем root - директорию, где находится vite.config.ts и index.html
  root: __dirname,
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
