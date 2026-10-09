import { db, valutaBase } from '../db/index.js';
import { datiCambio } from '../providers/index.js';
import { FrankfurterProvider } from '../providers/frankfurter.provider.js';
import { oggiIso } from '../lib/date.js';

const frankfurter = new FrankfurterProvider();

/** Il tasso del giorno viene riusato finche' non cambia giorno. */
const cacheMemoria = new Map<string, { tasso: number; giorno: string }>();

function salva(coppia: string, data: string, tasso: number, fonte: string): void {
  db.prepare(
    'INSERT INTO cambio (coppia, data, tasso, fonte) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(coppia, data) DO UPDATE SET tasso = excluded.tasso, fonte = excluded.fonte',
  ).run(coppia, data, tasso, fonte);
}

function leggiDb(coppia: string, data: string): number | null {
  const r = db
    .prepare('SELECT tasso FROM cambio WHERE coppia = ? AND data = ?')
    .get(coppia, data) as { tasso: number } | undefined;
  return r?.tasso ?? null;
}

/** Ultimo tasso noto non successivo alla data richiesta (per weekend e festivi). */
function leggiDbPrecedente(coppia: string, data: string): number | null {
  const r = db
    .prepare('SELECT tasso FROM cambio WHERE coppia = ? AND data <= ? ORDER BY data DESC LIMIT 1')
    .get(coppia, data) as { tasso: number } | undefined;
  return r?.tasso ?? null;
}

/**
 * Tasso di conversione `da` -> `a` di oggi.
 * Ordine: cache in memoria -> tabella cambio -> provider -> ultimo tasso noto.
 * L'ultimo gradino evita che un portafoglio multivaluta diventi invalutabile
 * solo perche' la rete e' momentaneamente giu'.
 */
export async function tassoCorrente(da: string, a: string): Promise<number> {
  const vDa = da.toUpperCase();
  const vA = a.toUpperCase();
  if (vDa === vA) return 1;

  const coppia = `${vDa}/${vA}`;
  const giorno = oggiIso();

  const inMemoria = cacheMemoria.get(coppia);
  if (inMemoria && inMemoria.giorno === giorno) return inMemoria.tasso;

  const inDb = leggiDb(coppia, giorno);
  if (inDb !== null) {
    cacheMemoria.set(coppia, { tasso: inDb, giorno });
    return inDb;
  }

  try {
    const tasso = await datiCambio.cambio(vDa, vA);
    salva(coppia, giorno, tasso, 'provider');
    cacheMemoria.set(coppia, { tasso, giorno });
    return tasso;
  } catch (e) {
    const precedente = leggiDbPrecedente(coppia, giorno);
    if (precedente !== null) {
      console.warn(
        `[cambi] ${coppia} non aggiornabile (${e instanceof Error ? e.message : e}); ` +
          `uso l'ultimo tasso noto ${precedente}`,
      );
      return precedente;
    }
    throw e;
  }
}

/**
 * Tasso storico alla data indicata, usato per valorizzare le operazioni
 * passate al cambio del giorno in cui sono avvenute.
 */
export async function tassoAllaData(da: string, a: string, dataIso: string): Promise<number> {
  const vDa = da.toUpperCase();
  const vA = a.toUpperCase();
  if (vDa === vA) return 1;

  const coppia = `${vDa}/${vA}`;
  const inDb = leggiDb(coppia, dataIso);
  if (inDb !== null) return inDb;

  try {
    const tasso = await frankfurter.cambioAllaData(vDa, vA, dataIso);
    salva(coppia, dataIso, tasso, 'frankfurter');
    return tasso;
  } catch {
    // Fuori dai giorni di borsa la BCE non pubblica: ripieghiamo sul noto.
    const precedente = leggiDbPrecedente(coppia, dataIso);
    if (precedente !== null) return precedente;
    return tassoCorrente(vDa, vA);
  }
}

/** Converte un importo nella valuta base del portafoglio, al cambio di oggi. */
export async function inValutaBase(importo: number, valuta: string): Promise<number> {
  const base = valutaBase();
  if (valuta.toUpperCase() === base) return importo;
  return importo * (await tassoCorrente(valuta, base));
}

export interface CambiPrecaricati {
  tassi: Map<string, number>;
  /** Valute per cui non esiste alcun tasso: convertite 1:1, valore NON attendibile. */
  nonConvertite: string[];
}

/**
 * Pre-carica i cambi di tutte le valute richieste in un'unica passata.
 *
 * Se una valuta non e' convertibile (rete giu' e nessuno storico) l'importo
 * resta nella sua valuta con tasso 1. E' una scelta deliberata - meglio un
 * totale incompleto che una dashboard in errore - ma la valuta viene elencata
 * in `nonConvertite` perche' chi legge il totale deve saperlo.
 */
export async function precaricaCambi(valute: string[]): Promise<CambiPrecaricati> {
  const base = valutaBase();
  const uniche = [...new Set(valute.map((v) => v.toUpperCase()))];
  const tassi = new Map<string, number>([[base, 1]]);
  const nonConvertite: string[] = [];

  await Promise.all(
    uniche
      .filter((v) => v !== base)
      .map(async (v) => {
        try {
          tassi.set(v, await tassoCorrente(v, base));
        } catch (e) {
          console.error(
            `[cambi] impossibile convertire ${v}->${base}: ${e instanceof Error ? e.message : e}`,
          );
          tassi.set(v, 1);
          nonConvertite.push(v);
        }
      }),
  );
  return { tassi, nonConvertite };
}
