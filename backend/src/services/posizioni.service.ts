import { db } from '../db/index.js';
import { arrotonda } from '../lib/numeri.js';
import type { RigaTransazione } from '../tipi.js';

export interface Posizione {
  strumentoId: number;
  /** Quantita' residua in portafoglio. */
  quantita: number;
  /** Costo medio unitario di carico, commissioni incluse, valuta dello strumento. */
  prezzoMedio: number;
  /** Capitale ancora investito (quantita' x prezzoMedio). */
  costoTotale: number;
  /** Utile/perdita gia' incassato dalle vendite. */
  plRealizzato: number;
  /** Dividendi netti incassati. */
  dividendiIncassati: number;
  /** Commissioni e tasse complessive sostenute. */
  oneriTotali: number;
  quantitaAcquistata: number;
  quantitaVenduta: number;
  primaOperazione: string | null;
  ultimaOperazione: string | null;
  numeroOperazioni: number;
}

const POSIZIONE_VUOTA = (strumentoId: number): Posizione => ({
  strumentoId,
  quantita: 0,
  prezzoMedio: 0,
  costoTotale: 0,
  plRealizzato: 0,
  dividendiIncassati: 0,
  oneriTotali: 0,
  quantitaAcquistata: 0,
  quantitaVenduta: 0,
  primaOperazione: null,
  ultimaOperazione: null,
  numeroOperazioni: 0,
});

/**
 * Ricostruisce la posizione da tutte le transazioni, in ordine cronologico,
 * col metodo del **costo medio ponderato** (la convenzione usata dagli
 * intermediari italiani per il prezzo medio di carico).
 *
 * - ACQUISTO: aumenta quantita' e costo; le commissioni entrano nel costo.
 * - VENDITA: riduce la quantita' al costo medio corrente, il delta sul prezzo
 *   di vendita (al netto degli oneri) diventa utile/perdita realizzato.
 *   Il prezzo medio NON cambia per effetto di una vendita.
 * - SPLIT: moltiplica la quantita' e divide il prezzo medio: il costo totale
 *   resta invariato (campo `quantita` = rapporto, es. 4 per uno split 4:1;
 *   per un raggruppamento 1:10 si usa 0.1).
 * - DIVIDENDO: non toccano quantita' ne' costo, si accumulano a parte.
 * - COMMISSIONE: solo onere, a riduzione del risultato.
 *
 * Le transazioni sono deliberatamente la sola fonte di verita': non esiste
 * una tabella "posizioni" da tenere sincronizzata.
 */
export function calcolaPosizione(strumentoId: number, transazioni?: RigaTransazione[]): Posizione {
  const righe =
    transazioni ??
    (db
      .prepare(
        'SELECT * FROM transazione WHERE strumento_id = ? ORDER BY data ASC, id ASC',
      )
      .all(strumentoId) as RigaTransazione[]);

  const p = POSIZIONE_VUOTA(strumentoId);
  if (righe.length === 0) return p;

  for (const t of righe) {
    const oneri = (t.commissioni ?? 0) + (t.tasse ?? 0);

    switch (t.tipo) {
      case 'ACQUISTO': {
        const costoOperazione = t.quantita * t.prezzo + oneri;
        p.costoTotale += costoOperazione;
        p.quantita += t.quantita;
        p.quantitaAcquistata += t.quantita;
        p.oneriTotali += oneri;
        break;
      }

      case 'VENDITA': {
        // Quantita' effettivamente vendibile: protegge da dati incoerenti
        // (es. una vendita importata prima del relativo acquisto).
        const venduta = Math.min(t.quantita, p.quantita);
        const costoMedioPrima = p.quantita > 0 ? p.costoTotale / p.quantita : 0;
        const ricavoNetto = venduta * t.prezzo - oneri;

        p.plRealizzato += ricavoNetto - venduta * costoMedioPrima;
        p.costoTotale -= venduta * costoMedioPrima;
        p.quantita -= venduta;
        p.quantitaVenduta += venduta;
        p.oneriTotali += oneri;

        // Azzeriamo i residui da arrotondamento a posizione chiusa.
        if (p.quantita <= 1e-9) {
          p.quantita = 0;
          p.costoTotale = 0;
        }
        break;
      }

      case 'SPLIT': {
        const rapporto = t.quantita;
        if (rapporto > 0) {
          p.quantita *= rapporto;
          p.quantitaAcquistata *= rapporto;
          p.quantitaVenduta *= rapporto;
          // costoTotale invariato: cambia solo il numero di pezzi.
        }
        break;
      }

      case 'DIVIDENDO': {
        // Importo = quantita x prezzo se entrambi valorizzati, altrimenti il
        // solo `prezzo` vale come importo complessivo dell'accredito.
        const lordo = t.quantita > 0 ? t.quantita * t.prezzo : t.prezzo;
        p.dividendiIncassati += lordo - oneri;
        p.oneriTotali += oneri;
        break;
      }

      case 'COMMISSIONE': {
        const importo = oneri > 0 ? oneri : t.prezzo;
        p.oneriTotali += importo;
        p.plRealizzato -= importo;
        break;
      }
    }

    p.numeroOperazioni += 1;
    if (!p.primaOperazione || t.data < p.primaOperazione) p.primaOperazione = t.data;
    if (!p.ultimaOperazione || t.data > p.ultimaOperazione) p.ultimaOperazione = t.data;
  }

  p.prezzoMedio = p.quantita > 0 ? p.costoTotale / p.quantita : 0;

  // Arrotondamenti solo in uscita: i calcoli intermedi restano a piena precisione.
  p.quantita = arrotonda(p.quantita, 8);
  p.prezzoMedio = arrotonda(p.prezzoMedio, 6);
  p.costoTotale = arrotonda(p.costoTotale, 2);
  p.plRealizzato = arrotonda(p.plRealizzato, 2);
  p.dividendiIncassati = arrotonda(p.dividendiIncassati, 2);
  p.oneriTotali = arrotonda(p.oneriTotali, 2);
  return p;
}

/** Posizioni di tutti gli strumenti, con una sola lettura delle transazioni. */
export function calcolaTutteLePosizioni(): Map<number, Posizione> {
  const righe = db
    .prepare('SELECT * FROM transazione ORDER BY strumento_id ASC, data ASC, id ASC')
    .all() as RigaTransazione[];

  const perStrumento = new Map<number, RigaTransazione[]>();
  for (const t of righe) {
    const elenco = perStrumento.get(t.strumento_id);
    if (elenco) elenco.push(t);
    else perStrumento.set(t.strumento_id, [t]);
  }

  const out = new Map<number, Posizione>();
  for (const [id, ts] of perStrumento) out.set(id, calcolaPosizione(id, ts));
  return out;
}

/**
 * Quantita' detenuta a una data passata, per ricostruire il valore storico
 * del portafoglio.
 */
export function quantitaAllaData(transazioni: RigaTransazione[], dataIso: string): number {
  let q = 0;
  for (const t of transazioni) {
    if (t.data > dataIso) break;
    if (t.tipo === 'ACQUISTO') q += t.quantita;
    else if (t.tipo === 'VENDITA') q -= Math.min(t.quantita, q);
    else if (t.tipo === 'SPLIT' && t.quantita > 0) q *= t.quantita;
  }
  return q > 1e-9 ? q : 0;
}
