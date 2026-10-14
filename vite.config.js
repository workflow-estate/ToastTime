import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/online': 'http://127.0.0.1:8787',
    },
  },
});
