import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { startBackendPlugin } from './vite-plugin-start-backend';

// https://vitejs.dev/config/
// Vite автоматически определяет root как директорию, где находится vite.config.ts
// Поэтому index.html должен быть в той же директории, что и vite.config.ts
export default defineConfig({
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
