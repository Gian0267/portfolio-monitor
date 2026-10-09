import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In sviluppo il frontend gira su 5173 e inoltra /api al backend:
    // in produzione il backend serve direttamente frontend/dist, stessa origine.
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Recharts e React cambiano di rado: in un chunk a parte restano
        // nella cache del browser quando si aggiorna solo il codice dell'app.
        manualChunks: {
          grafici: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
