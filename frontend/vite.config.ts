import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      // Frontend calls /api/* on its own origin; Vite forwards to the planner.
      // Keeps the Gemini key on the server and avoids CORS entirely.
      '/api': { target: 'http://localhost:8787', changeOrigin: true }
    }
  }
});
