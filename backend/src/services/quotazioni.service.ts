import { config } from '../config.js';
import { db } from '../db/index.js';
import { datiMercato } from '../providers/index.js';
import { inLotti } from '../providers/http.js';
import { adessoIso, giorniIndietro, oggiIso } from '../lib/date.js';
import type { RigaQuotazione, RigaStrumento } from '../tipi.js';

export interface EsitoAggiornamento {
  aggiornati: number;
  falliti: Array<{ simbolo: string; errore: string }>;
  durataMs: number;
}

const salvaQuotazione = db.prepare(`
  INSERT INTO quotazione (strumento_id, prezzo, valuta, chiusura_precedente,
                          variazione_assoluta, variazione_percentuale,
                          mercato_aperto, fonte, aggiornato_il)
  VALUES (@strumento_id, @prezzo, @valuta, @chiusura_precedente,
          @variazione_assoluta, @variazione_percentuale,
          @mercato_aperto, @fonte, @aggiornato_il)
  ON CONFLICT(strumento_id) DO UPDATE SET
    prezzo = excluded.prezzo,
    valuta = excluded.valuta,
    chiusura_precedente = excluded.chiusura_precedente,
    variazione_assoluta = excluded.variazione_assoluta,
    variazione_percentuale = excluded.variazione_percentuale,
    mercato_aperto = excluded.mercato_aperto,
    fonte = excluded.fonte,
    aggiornato_il = excluded.aggiornato_il
`);

export function quotazioneInCache(strumentoId: number): RigaQuotazione | null {
  return (
    (db
      .prepare('SELECT * FROM quotazione WHERE strumento_id = ?')
      .get(strumentoId) as RigaQuotazione | undefined) ?? null
  );
}

export function tutteLeQuotazioni(): Map<number, RigaQuotazione> {
  const righe = db.prepare('SELECT * FROM quotazione').all() as RigaQuotazione[];
  return new Map(righe.map((q) => [q.strumento_id, q]));
}

function scaduta(q: RigaQuotazione | null): boolean {
  if (!q) return true;
  const eta = (Date.now() - new Date(q.aggiornato_il).getTime()) / 1000;
  return eta > config.quotazioneTtlSecondi;
}

/** Scarica e salva la quotazione di un singolo strumento. */
export async function aggiornaQuotazione(strumento: RigaStrumento): Promise<RigaQuotazione> {
  const q = await datiMercato.quotazione(strumento.simbolo);

  const riga: RigaQuotazione = {
    strumento_id: strumento.id,
    prezzo: q.prezzo,
    valuta: q.valuta || strumento.valuta,
    chiusura_precedente: q.chiusuraPrecedente ?? null,
    variazione_assoluta: q.variazioneAssoluta ?? null,
    variazione_percentuale: q.variazionePercentuale ?? null,
    mercato_aperto: q.mercatoAperto ? 1 : 0,
    fonte: q.fonte,
    aggiornato_il: adessoIso(),
  };
  salvaQuotazione.run(riga);

  // Teniamo traccia anche del prezzo di chiusura odierno: alimenta i grafici
  // senza dover riscaricare lo storico.
  db.prepare(
    'INSERT INTO prezzo_storico (strumento_id, data, chiusura) VALUES (?, ?, ?) ' +
      'ON CONFLICT(strumento_id, data) DO UPDATE SET chiusura = excluded.chiusura',
  ).run(strumento.id, oggiIso(), q.prezzo);

  // La valuta dichiarata dal provider e' piu' attendibile di quella inserita a mano.
  if (q.valuta && q.valuta !== strumento.valuta) {
    db.prepare('UPDATE strumento SET valuta = ?, aggiornato_il = ? WHERE id = ?').run(
      q.valuta,
      adessoIso(),
      strumento.id,
    );
  }
  return riga;
}

/** Quotazione fresca: usa la cache se ancora valida, altrimenti riscarica. */
export async function quotazioneFresca(strumento: RigaStrumento): Promise<RigaQuotazione | null> {
  const inCache = quotazioneInCache(strumento.id);
  if (!scaduta(inCache)) return inCache;
  try {
    return await aggiornaQuotazione(strumento);
  } catch (e) {
    console.warn(`[quotazioni] ${strumento.simbolo}: ${e instanceof Error ? e.message : e}`);
    return inCache; // meglio un prezzo vecchio che nessun prezzo
  }
}

/**
 * Aggiorna in blocco. I provider gratuiti hanno limiti al minuto, quindi
 * procediamo a lotti di 5 anziche' con N richieste parallele.
 */
export async function aggiornaTutteLeQuotazioni(soloScadute = false): Promise<EsitoAggiornamento> {
  const inizio = Date.now();
  const strumenti = db
    .prepare('SELECT * FROM strumento ORDER BY simbolo')
    .all() as RigaStrumento[];

  const daAggiornare = soloScadute
    ? strumenti.filter((s) => scaduta(quotazioneInCache(s.id)))
    : strumenti;

  const esiti = await inLotti(daAggiornare, 5, (s) => aggiornaQuotazione(s));

  const falliti: EsitoAggiornamento['falliti'] = [];
  esiti.forEach((e, i) => {
    if (e.status === 'rejected') {
      falliti.push({
        simbolo: daAggiornare[i].simbolo,
        errore: e.reason instanceof Error ? e.reason.message : String(e.reason),
      });
    }
  });

  if (daAggiornare.length > 0) valutaAlert();

  return {
    aggiornati: esiti.filter((e) => e.status === 'fulfilled').length,
    falliti,
    durataMs: Date.now() - inizio,
  };
}

/** Scarica lo storico e lo mette in cache; ritorna i punti dal DB. */
export async function storicoStrumento(
  strumento: RigaStrumento,
  giorni: number,
): Promise<Array<{ data: string; chiusura: number }>> {
  const da = giorniIndietro(giorni);
  const a = oggiIso();

  try {
    const serie = await datiMercato.storico(strumento.simbolo, da, a);
    const inserisci = db.prepare(
      'INSERT INTO prezzo_storico (strumento_id, data, chiusura) VALUES (?, ?, ?) ' +
        'ON CONFLICT(strumento_id, data) DO UPDATE SET chiusura = excluded.chiusura',
    );
    db.transaction(() => {
      for (const p of serie.punti) inserisci.run(strumento.id, p.data, p.chiusura);
    })();
  } catch (e) {
    console.warn(
      `[quotazioni] storico ${strumento.simbolo} non scaricabile: ` +
        `${e instanceof Error ? e.message : e} (uso la cache locale)`,
    );
  }

  return db
    .prepare(
      'SELECT data, chiusura FROM prezzo_storico WHERE strumento_id = ? AND data >= ? ORDER BY data ASC',
    )
    .all(strumento.id, da) as Array<{ data: string; chiusura: number }>;
}

interface RigaAlert {
  id: number;
  strumento_id: number;
  condizione: 'SOPRA' | 'SOTTO' | 'VAR_PERC_SOPRA' | 'VAR_PERC_SOTTO';
  valore: number;
  attivo: number;
}

/** Confronta gli alert attivi con le quotazioni in cache e marca quelli scattati. */
export function valutaAlert(): number {
  const alert = db
    .prepare('SELECT id, strumento_id, condizione, valore, attivo FROM alert WHERE attivo = 1')
    .all() as RigaAlert[];
  if (alert.length === 0) return 0;

  const quotazioni = tutteLeQuotazioni();
  const marca = db.prepare(
    'UPDATE alert SET attivo = 0, scattato_il = ?, prezzo_scatto = ? WHERE id = ?',
  );

  let scattati = 0;
  for (const a of alert) {
    const q = quotazioni.get(a.strumento_id);
    if (!q) continue;
    const variazione = q.variazione_percentuale ?? 0;

    const condizioneVera =
      (a.condizione === 'SOPRA' && q.prezzo >= a.valore) ||
      (a.condizione === 'SOTTO' && q.prezzo <= a.valore) ||
      (a.condizione === 'VAR_PERC_SOPRA' && variazione >= a.valore) ||
      (a.condizione === 'VAR_PERC_SOTTO' && variazione <= a.valore);

    if (condizioneVera) {
      marca.run(adessoIso(), q.prezzo, a.id);
      scattati += 1;
    }
  }
  return scattati;
}
