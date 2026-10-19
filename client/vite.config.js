import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(process.cwd(), 'src') },
    },
    server: {
      port: Number(env.VITE_PORT) || 5173,
      // Dev proxy keeps cookies first-party, so httpOnly auth works locally.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/share': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
    },
  };
});
