import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const backendEnv = loadEnv('development', fileURLToPath(new URL('../backend', import.meta.url)), 'PORT');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': process.env.API_PROXY || `http://127.0.0.1:${backendEnv.PORT || 3000}`,
    },
  },
});
