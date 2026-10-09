import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, preparaCartellaDb } from '../config.js';

const qui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lo schema .sql non viene compilato da tsc: in dist/ non esiste.
 * Cerchiamo prima accanto al file compilato, poi nei sorgenti.
 */
function leggiSchema(): string {
  const candidati = [
    path.join(qui, 'schema.sql'),
    path.resolve(qui, '..', '..', 'src', 'db', 'schema.sql'),
  ];
  for (const c of candidati) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  }
  throw new Error(`schema.sql non trovato (cercato in: ${candidati.join(', ')})`);
}

preparaCartellaDb();

export const db = new Database(config.percorsoDb);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(leggiSchema());

/** Valori di default delle impostazioni, inseriti solo se mancanti. */
const DEFAULT_IMPOSTAZIONI: Record<string, string> = {
  valuta_base: config.valutaBase,
  provider_ordine: config.providerOrdine.join(','),
  mostra_valori_lordi: 'true',
};

const upsertImpostazione = db.prepare(
  'INSERT INTO impostazione (chiave, valore) VALUES (?, ?) ON CONFLICT(chiave) DO NOTHING',
);
for (const [k, v] of Object.entries(DEFAULT_IMPOSTAZIONI)) upsertImpostazione.run(k, v);

export function leggiImpostazione(chiave: string, fallback = ''): string {
  const riga = db
    .prepare('SELECT valore FROM impostazione WHERE chiave = ?')
    .get(chiave) as { valore: string } | undefined;
  return riga?.valore ?? fallback;
}

export function scriviImpostazione(chiave: string, valore: string): void {
  db.prepare(
    'INSERT INTO impostazione (chiave, valore) VALUES (?, ?) ' +
      'ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore',
  ).run(chiave, valore);
}

/** Valuta base effettiva: l'impostazione in DB vince sulla variabile d'ambiente. */
export function valutaBase(): string {
  return (leggiImpostazione('valuta_base', config.valutaBase) || 'EUR').toUpperCase();
}
