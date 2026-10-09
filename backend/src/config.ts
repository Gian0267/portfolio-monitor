import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
/** Root del monorepo: funziona sia da src/ (tsx) sia da dist/ (build). */
export const ROOT = path.resolve(qui, '..', '..');

function env(chiave: string, fallback = ''): string {
  const v = process.env[chiave];
  return v === undefined || v === '' ? fallback : v;
}

function envNum(chiave: string, fallback: number): number {
  const n = Number(env(chiave, ''));
  return Number.isFinite(n) ? n : fallback;
}

function risolviPercorsoDb(valore: string): string {
  return path.isAbsolute(valore) ? valore : path.resolve(ROOT, valore);
}

export const config = {
  porta: envNum('BACKEND_PORT', 4000),
  produzione: env('NODE_ENV') === 'production',
  percorsoDb: risolviPercorsoDb(env('DATABASE_PATH', './data/portfolio.db')),
  valutaBase: env('VALUTA_BASE', 'EUR').toUpperCase(),
  providerOrdine: env('PROVIDER_ORDINE', 'yahoo,twelvedata')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  fxProviderOrdine: env('FX_PROVIDER_ORDINE', 'frankfurter,yahoo,twelvedata')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  twelveDataApiKey: env('TWELVEDATA_API_KEY'),
  quotazioneTtlSecondi: envNum('QUOTAZIONE_TTL_SECONDI', 900),
  // Qui leggiamo process.env direttamente: una stringa vuota deve poter
  // disattivare lo scheduler, mentre env() rimpiazzerebbe '' col default.
  cronAggiornamento: process.env.CRON_AGGIORNAMENTO ?? '0 19 * * 1-5',
};

/** Crea la cartella del database se non esiste. */
export function preparaCartellaDb(): void {
  fs.mkdirSync(path.dirname(config.percorsoDb), { recursive: true });
}
