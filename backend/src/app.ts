import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import { config, ROOT } from './config.js';
import { valutaBase } from './db/index.js';
import { ErroreHttp } from './lib/errori.js';
import { ErroreProvider } from './providers/index.js';
import { alertRouter } from './routes/alert.routes.js';
import { impostazioniRouter } from './routes/impostazioni.routes.js';
import { portafoglioRouter } from './routes/portafoglio.routes.js';
import { strumentiRouter } from './routes/strumenti.routes.js';
import { transazioniRouter } from './routes/transazioni.routes.js';
import { watchlistRouter } from './routes/watchlist.routes.js';
import { avviaScheduler } from './scheduler.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
// L'import CSV arriva come testo grezzo.
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));

app.get('/api/salute', (_req, res) => {
  res.json({
    stato: 'ok',
    valutaBase: valutaBase(),
    versione: '1.0.0',
    ambiente: config.produzione ? 'produzione' : 'sviluppo',
  });
});

app.use('/api/strumenti', strumentiRouter);
app.use('/api/transazioni', transazioniRouter);
app.use('/api/portafoglio', portafoglioRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alert', alertRouter);
app.use('/api/impostazioni', impostazioniRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ errore: 'Endpoint non trovato' });
});

// In produzione il backend serve anche il frontend compilato: un solo processo,
// stessa origine, nessun CORS da configurare.
const frontendBuild = path.join(ROOT, 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Middleware finale: traduce gli errori in risposte JSON leggibili.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    // Zod v4: le violazioni stanno in `issues`, non in `errors`.
    res.status(400).json({
      errore: 'Dati non validi',
      dettagli: err.issues.map((i) => ({ campo: i.path.join('.') || '(radice)', messaggio: i.message })),
    });
    return;
  }
  if (err instanceof ErroreHttp) {
    res.status(err.stato).json({ errore: err.message, dettagli: err.dettagli });
    return;
  }
  if (err instanceof ErroreProvider) {
    // 502: il nostro server sta bene, e' la fonte dati esterna che non risponde.
    res.status(502).json({ errore: err.message });
    return;
  }

  const messaggio = err instanceof Error ? err.message : String(err);
  console.log(`[ERRORE] ${req.method} ${req.path} -> ${messaggio}`);
  if (err instanceof Error && err.stack) console.log(err.stack);
  res.status(500).json({ errore: 'Errore interno del server', dettagli: messaggio });
});

const porta = config.porta;
app.listen(porta, () => {
  console.log(`[avvio] Portfolio Monitor in ascolto su http://localhost:${porta}`);
  console.log(`[avvio] database: ${config.percorsoDb}`);
  console.log(`[avvio] valuta base: ${valutaBase()}`);
  console.log(`[avvio] provider quotazioni: ${config.providerOrdine.join(' -> ')}`);
  if (!config.twelveDataApiKey) {
    console.log('[avvio] TWELVEDATA_API_KEY assente: attivo solo Yahoo Finance (nessun fallback).');
  }
  avviaScheduler();
});
