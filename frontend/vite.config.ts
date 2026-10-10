import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const RADICE = fileURLToPath(new URL('..', import.meta.url));

/**
 * Legge una singola chiave dal .env nella radice del monorepo.
 *
 * Deliberatamente NON si usa `loadEnv` di Vite: quello carica tutto il file e,
 * trovando `NODE_ENV`, lo applica al build. Con `NODE_ENV=development` nel .env
 * il bundle di produzione finirebbe per contenere React in versione di
 * sviluppo: circa 265 kB in piu' e gli avvisi di debug attivi.
 */
function daEnvRadice(chiave: string): string | undefined {
  const file = path.join(RADICE, '.env');
  if (!fs.existsSync(file)) return undefined;
  for (const riga of fs.readFileSync(file, 'utf8').split('\n')) {
    const trovata = new RegExp(`^\\s*${chiave}\\s*=\\s*(.*)$`).exec(riga);
    if (trovata) return trovata[1].trim().replace(/^["']|["']$/g, '') || undefined;
  }
  return undefined;
}

export default defineConfig(({ command }) => {
  // Il bersaglio del proxy serve solo in sviluppo: in produzione il backend
  // serve direttamente frontend/dist, stessa origine e nessun proxy.
  const bersaglio =
    command === 'serve'
      ? daEnvRadice('BACKEND_URL') ?? `http://localhost:${daEnvRadice('BACKEND_PORT') ?? 4000}`
      : '';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: bersaglio,
          changeOrigin: true,
          configure(proxy) {
            // Senza questo, un backend spento produce un 500 con corpo HTML e
            // l'interfaccia mostra "Errore 500" senza dire cosa fare.
            proxy.on('error', (errore, _richiesta, risposta) => {
              console.error(`[proxy] backend non raggiungibile su ${bersaglio}: ${errore.message}`);
              if ('writeHead' in risposta && !risposta.headersSent) {
                risposta.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                risposta.end(
                  JSON.stringify({
                    errore:
                      `Il server dell'app non risponde su ${bersaglio}. ` +
                      'Controlla che la finestra di avvio sia ancora aperta.',
                  }),
                );
              }
            });
          },
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
  };
});
