import { getJson } from './http.js';
import {
  ErroreProvider,
  type ProviderDatiMercato,
  type Quotazione,
  type RisultatoRicerca,
  type SeriePrezzi,
} from './tipi.js';
import { timestampUnix } from '../lib/date.js';

const BASE = 'https://query1.finance.yahoo.com';

interface RispostaChart {
  chart: {
    error: { code: string; description: string } | null;
    result?: Array<{
      meta: {
        symbol: string;
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        instrumentType?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        longName?: string;
        shortName?: string;
      };
      timestamp?: number[];
      indicators: {
        quote?: Array<{ close?: (number | null)[] }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
  };
}

interface RispostaRicerca {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
    exchDisp?: string;
    currency?: string;
  }>;
}

/**
 * Yahoo Finance, endpoint `chart` pubblico: nessuna chiave, copertura USA +
 * borse europee (.MI Milano, .DE Xetra, .PA Parigi, .AS Amsterdam, .L Londra)
 * e la maggior parte di ETF e fondi.
 *
 * E' un'API non ufficiale: puo' cambiare senza preavviso. Per questo la catena
 * di provider prevede sempre un fallback.
 */
export class YahooProvider implements ProviderDatiMercato {
  readonly nome = 'yahoo';

  disponibile(): boolean {
    return true; // nessuna credenziale richiesta
  }

  async quotazione(simbolo: string): Promise<Quotazione> {
    const url =
      `${BASE}/v8/finance/chart/${encodeURIComponent(simbolo)}` +
      `?interval=1d&range=5d&includePrePost=false`;
    const dati = await getJson<RispostaChart>(this.nome, url);
    const risultato = this.primoRisultato(dati, simbolo);
    const meta = risultato.meta;

    const prezzo = meta.regularMarketPrice;
    if (typeof prezzo !== 'number' || !Number.isFinite(prezzo)) {
      throw new ErroreProvider(this.nome, `nessun prezzo per "${simbolo}"`);
    }

    const precedente = meta.chartPreviousClose ?? meta.previousClose;
    const variazione =
      typeof precedente === 'number' ? prezzo - precedente : undefined;

    return {
      simbolo: meta.symbol ?? simbolo,
      prezzo,
      valuta: (meta.currency ?? 'EUR').toUpperCase(),
      chiusuraPrecedente: precedente,
      variazioneAssoluta: variazione,
      variazionePercentuale:
        variazione !== undefined && precedente ? (variazione / precedente) * 100 : undefined,
      nome: meta.longName ?? meta.shortName,
      borsa: meta.fullExchangeName ?? meta.exchangeName,
      // Yahoo non espone marketState su questo endpoint: usiamo la freschezza
      // dell'ultimo tick come approssimazione (< 15 min => mercato aperto).
      mercatoAperto: meta.regularMarketTime
        ? Date.now() / 1000 - meta.regularMarketTime < 900
        : false,
      fonte: this.nome,
      timestamp: new Date().toISOString(),
    };
  }

  async storico(simbolo: string, daIso: string, aIso: string): Promise<SeriePrezzi> {
    const p1 = timestampUnix(daIso);
    const p2 = timestampUnix(aIso) + 86_400;
    const url =
      `${BASE}/v8/finance/chart/${encodeURIComponent(simbolo)}` +
      `?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplit`;
    const dati = await getJson<RispostaChart>(this.nome, url);
    const risultato = this.primoRisultato(dati, simbolo);

    const tempi = risultato.timestamp ?? [];
    // adjclose tiene conto di split e dividendi: preferito per i grafici storici.
    const serie =
      risultato.indicators.adjclose?.[0]?.adjclose ??
      risultato.indicators.quote?.[0]?.close ??
      [];

    const punti = tempi
      .map((t, i) => ({
        data: new Date(t * 1000).toISOString().slice(0, 10),
        chiusura: serie[i],
      }))
      .filter((p): p is { data: string; chiusura: number } => typeof p.chiusura === 'number');

    return {
      simbolo: risultato.meta.symbol ?? simbolo,
      valuta: (risultato.meta.currency ?? 'EUR').toUpperCase(),
      punti,
      fonte: this.nome,
    };
  }

  async ricerca(query: string): Promise<RisultatoRicerca[]> {
    const url =
      `${BASE}/v1/finance/search?q=${encodeURIComponent(query)}` +
      `&quotesCount=15&newsCount=0&listsCount=0`;
    const dati = await getJson<RispostaRicerca>(this.nome, url);
    return (dati.quotes ?? [])
      .filter((q) => q.symbol)
      .map((q) => ({
        simbolo: q.symbol as string,
        nome: q.longname ?? q.shortname ?? (q.symbol as string),
        tipo: mappaTipoYahoo(q.quoteType),
        borsa: q.exchDisp ?? q.exchange,
        valuta: q.currency?.toUpperCase(),
      }));
  }

  /** Yahoo quota i cambi come pseudo-simboli: "USDEUR=X". */
  async cambio(da: string, a: string): Promise<number> {
    if (da === a) return 1;
    const q = await this.quotazione(`${da}${a}=X`);
    return q.prezzo;
  }

  private primoRisultato(dati: RispostaChart, simbolo: string) {
    if (dati.chart?.error) {
      throw new ErroreProvider(
        this.nome,
        `${dati.chart.error.code}: ${dati.chart.error.description}`,
      );
    }
    const risultato = dati.chart?.result?.[0];
    if (!risultato) throw new ErroreProvider(this.nome, `simbolo "${simbolo}" sconosciuto`);
    return risultato;
  }
}

/** quoteType di Yahoo -> tipo usato dall'app. */
export function mappaTipoYahoo(quoteType?: string): string {
  switch ((quoteType ?? '').toUpperCase()) {
    case 'EQUITY':
      return 'AZIONE';
    case 'ETF':
      return 'ETF';
    case 'MUTUALFUND':
      return 'FONDO';
    case 'CRYPTOCURRENCY':
      return 'CRYPTO';
    case 'BOND':
      return 'OBBLIGAZIONE';
    default:
      return 'ALTRO';
  }
}
