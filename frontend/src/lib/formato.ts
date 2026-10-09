import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const SIMBOLI: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  GBp: 'p',
};

/** Importo con separatori italiani e simbolo di valuta. */
export function valuta(n: number | null | undefined, divisa = 'EUR', decimali = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const testo = n.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  });
  const simbolo = SIMBOLI[divisa.toUpperCase()] ?? divisa.toUpperCase();
  return simbolo.length === 1 ? `${simbolo} ${testo}` : `${testo} ${simbolo}`;
}

/** Importo compatto per le card: 1,2 Mln / 45,3 mila. */
export function valutaCompatta(n: number | null | undefined, divisa = 'EUR'): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const simbolo = SIMBOLI[divisa.toUpperCase()] ?? divisa.toUpperCase();
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${simbolo} ${(n / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} Mln`;
  if (abs >= 10_000) return `${simbolo} ${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} mila`;
  return valuta(n, divisa);
}

/** Percentuale con segno esplicito: +3,45 % / −1,20 %. */
export function percento(n: number | null | undefined, decimali = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const segno = n > 0 ? '+' : '';
  return `${segno}${n.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  })} %`;
}

export function numero(n: number | null | undefined, decimali = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('it-IT', { maximumFractionDigits: decimali });
}

/** Quantita': senza decimali inutili per i titoli interi, fino a 6 per le frazioni. */
export function quantita(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('it-IT', { maximumFractionDigits: Number.isInteger(n) ? 0 : 6 });
}

export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: it });
  } catch {
    return iso;
  }
}

export function dataOra(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'alle' HH:mm", { locale: it });
  } catch {
    return iso;
  }
}

/** "3 minuti fa", per segnalare quanto e' vecchia una quotazione. */
export function daQuandoTesto(iso: string | null | undefined): string {
  if (!iso) return 'mai';
  const minuti = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 1) return 'adesso';
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa`;
}

/** Classe Tailwind per colorare un valore in base al segno. */
export function classeSegno(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return 'text-slate-500';
  return n > 0 ? 'text-emerald-600' : 'text-red-600';
}

export const ETICHETTE_TIPO: Record<string, string> = {
  AZIONE: 'Azione',
  ETF: 'ETF',
  FONDO: 'Fondo',
  OBBLIGAZIONE: 'Obbligazione',
  CRYPTO: 'Crypto',
  ALTRO: 'Altro',
};

export const ETICHETTE_TRANSAZIONE: Record<string, string> = {
  ACQUISTO: 'Acquisto',
  VENDITA: 'Vendita',
  DIVIDENDO: 'Dividendo',
  COMMISSIONE: 'Commissione',
  SPLIT: 'Split',
};

export const ETICHETTE_CONDIZIONE: Record<string, string> = {
  SOPRA: 'Prezzo sopra',
  SOTTO: 'Prezzo sotto',
  VAR_PERC_SOPRA: 'Variazione % sopra',
  VAR_PERC_SOTTO: 'Variazione % sotto',
};

/**
 * Palette dei grafici: slot categoriali in ordine FISSO (mai ciclato).
 * Valori validati per separazione cromatica, daltonismo e contrasto sulla
 * superficie chiara; l'ordine e' parte della validazione, non estetica.
 *
 * I grafici di allocazione NON usano questa palette: sono barre in tinta unica
 * con etichetta diretta, cosi' il numero di categorie non conta.
 */
export const COLORI_SERIE = [
  '#2a78d6', // blu
  '#eb6834', // arancio
  '#1baf7a', // acqua
  '#eda100', // giallo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // viola
  '#e34948', // rosso
] as const;

/** Tinta unica per le barre di magnitudine (allocazioni, dividendi per anno). */
export const COLORE_MAGNITUDINE = '#2a78d6';

/** Griglia e assi: devono restare in secondo piano rispetto ai dati. */
export const COLORE_GRIGLIA = '#e8e8e4';
export const COLORE_ASSE = '#52514e';
