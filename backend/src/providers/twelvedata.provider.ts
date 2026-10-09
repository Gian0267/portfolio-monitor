import { getJson } from './http.js';
import {
  ErroreProvider,
  type ProviderDatiMercato,
  type Quotazione,
  type RisultatoRicerca,
  type SeriePrezzi,
} from './tipi.js';

const BASE = 'https://api.twelvedata.com';

/**
 * Suffisso Yahoo -> MIC code di Twelve Data.
 * Twelve Data non usa i suffissi: vuole il ticker "nudo" piu' il mercato,
 * quindi "ENI.MI" diventa symbol=ENI & mic_code=XMIL.
 */
const SUFFISSO_A_MIC: Record<string, string> = {
  MI: 'XMIL', // Borsa Italiana
  DE: 'XETR', // Xetra
  F: 'XFRA', // Francoforte
  PA: 'XPAR', // Euronext Parigi
  AS: 'XAMS', // Euronext Amsterdam
  BR: 'XBRU', // Euronext Bruxelles
  LS: 'XLIS', // Euronext Lisbona
  IR: 'XDUB', // Euronext Dublino
  L: 'XLON', // London Stock Exchange
  SW: 'XSWX', // SIX Svizzera
  MC: 'XMAD', // Madrid
  VI: 'XWBO', // Vienna
  ST: 'XSTO', // Stoccolma
  CO: 'XCSE', // Copenaghen
  OL: 'XOSL', // Oslo
  HE: 'XHEL', // Helsinki
  WA: 'XWAR', // Varsavia
  PR: 'XPRA', // Praga
  AT: 'XATH', // Atene
  IS: 'XIST', // Istanbul
  TO: 'XTSE', // Toronto
};

interface RispostaErrore {
  code?: number;
  message?: string;
  status?: string;
}

interface RispostaQuote extends RispostaErrore {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  is_market_open?: boolean;
}

interface RispostaTimeSeries extends RispostaErrore {
  meta?: { symbol?: string; currency?: string };
  values?: Array<{ datetime: string; close: string }>;
}

interface RispostaSymbolSearch extends RispostaErrore {
  data?: Array<{
    symbol?: string;
    instrument_name?: string;
    exchange?: string;
    mic_code?: string;
    instrument_type?: string;
    currency?: string;
    country?: string;
  }>;
}

interface RispostaExchangeRate extends RispostaErrore {
  rate?: number;
}

/**
 * Twelve Data: API ufficiale con piano gratuito (~800 chiamate/giorno,
 * 8 al minuto). Usata come fallback quando Yahoo non risponde.
 * Senza TWELVEDATA_API_KEY il provider si dichiara non disponibile e la
 * catena lo salta.
 */
export class TwelveDataProvider implements ProviderDatiMercato {
  readonly nome = 'twelvedata';

  constructor(private readonly apiKey: string) {}

  disponibile(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async quotazione(simbolo: string): Promise<Quotazione> {
    const dati = await getJson<RispostaQuote>(this.nome, this.url('/quote', simbolo));
    this.verificaErrore(dati, simbolo);

    const prezzo = Number(dati.close);
    if (!Number.isFinite(prezzo)) {
      throw new ErroreProvider(this.nome, `nessun prezzo per "${simbolo}"`);
    }
    const precedente = Number(dati.previous_close);
    const variazione = Number(dati.change);
    const variazionePerc = Number(dati.percent_change);

    return {
      simbolo,
      prezzo,
      valuta: (dati.currency ?? 'EUR').toUpperCase(),
      chiusuraPrecedente: Number.isFinite(precedente) ? precedente : undefined,
      variazioneAssoluta: Number.isFinite(variazione) ? variazione : undefined,
      variazionePercentuale: Number.isFinite(variazionePerc) ? variazionePerc : undefined,
      nome: dati.name,
      borsa: dati.exchange,
      mercatoAperto: dati.is_market_open ?? false,
      fonte: this.nome,
      timestamp: new Date().toISOString(),
    };
  }

  async storico(simbolo: string, daIso: string, aIso: string): Promise<SeriePrezzi> {
    const url =
      this.url('/time_series', simbolo) +
      `&interval=1day&start_date=${daIso}&end_date=${aIso}&outputsize=5000&order=ASC`;
    const dati = await getJson<RispostaTimeSeries>(this.nome, url);
    this.verificaErrore(dati, simbolo);

    const punti = (dati.values ?? [])
      .map((v) => ({ data: v.datetime.slice(0, 10), chiusura: Number(v.close) }))
      .filter((p) => Number.isFinite(p.chiusura))
      .sort((a, b) => a.data.localeCompare(b.data));

    return {
      simbolo,
      valuta: (dati.meta?.currency ?? 'EUR').toUpperCase(),
      punti,
      fonte: this.nome,
    };
  }

  async ricerca(query: string): Promise<RisultatoRicerca[]> {
    const url =
      `${BASE}/symbol_search?symbol=${encodeURIComponent(query)}` +
      `&outputsize=15&apikey=${encodeURIComponent(this.apiKey)}`;
    const dati = await getJson<RispostaSymbolSearch>(this.nome, url);
    if (dati.status === 'error') {
      throw new ErroreProvider(this.nome, dati.message ?? 'ricerca fallita');
    }
    return (dati.data ?? [])
      .filter((d) => d.symbol)
      .map((d) => ({
        // Ricostruiamo il suffisso Yahoo per restare coerenti in tutta l'app.
        simbolo: aSimboloYahoo(d.symbol as string, d.mic_code),
        nome: d.instrument_name ?? (d.symbol as string),
        tipo: mappaTipoTwelveData(d.instrument_type),
        borsa: d.exchange,
        valuta: d.currency?.toUpperCase(),
      }));
  }

  async cambio(da: string, a: string): Promise<number> {
    if (da === a) return 1;
    const url =
      `${BASE}/exchange_rate?symbol=${encodeURIComponent(`${da}/${a}`)}` +
      `&apikey=${encodeURIComponent(this.apiKey)}`;
    const dati = await getJson<RispostaExchangeRate>(this.nome, url);
    if (dati.status === 'error' || !Number.isFinite(Number(dati.rate))) {
      throw new ErroreProvider(this.nome, dati.message ?? `cambio ${da}/${a} non disponibile`);
    }
    return Number(dati.rate);
  }

  /** Costruisce l'URL traducendo il simbolo dal formato Yahoo a quello Twelve Data. */
  private url(percorso: string, simboloYahoo: string): string {
    const { ticker, mic } = daSimboloYahoo(simboloYahoo);
    const parti = [
      `symbol=${encodeURIComponent(ticker)}`,
      `apikey=${encodeURIComponent(this.apiKey)}`,
    ];
    if (mic) parti.push(`mic_code=${mic}`);
    return `${BASE}${percorso}?${parti.join('&')}`;
  }

  private verificaErrore(dati: RispostaErrore, simbolo: string): void {
    if (dati.status === 'error' || (dati.code && dati.code >= 400)) {
      throw new ErroreProvider(
        this.nome,
        `${dati.message ?? 'errore'} (simbolo "${simbolo}", codice ${dati.code ?? '?'})`,
      );
    }
  }
}

/** "ENI.MI" -> { ticker: "ENI", mic: "XMIL" }; "AAPL" -> { ticker: "AAPL" }. */
export function daSimboloYahoo(simbolo: string): { ticker: string; mic?: string } {
  // I cambi Yahoo ("EURUSD=X") e le crypto ("BTC-USD") non hanno suffisso di borsa.
  if (simbolo.includes('=') || simbolo.includes('-')) return { ticker: simbolo };
  const punto = simbolo.lastIndexOf('.');
  if (punto === -1) return { ticker: simbolo };
  const suffisso = simbolo.slice(punto + 1).toUpperCase();
  const mic = SUFFISSO_A_MIC[suffisso];
  return mic ? { ticker: simbolo.slice(0, punto), mic } : { ticker: simbolo };
}

/** Inverso di `daSimboloYahoo`: "ENI" + XMIL -> "ENI.MI". */
export function aSimboloYahoo(ticker: string, mic?: string): string {
  if (!mic) return ticker;
  const suffisso = Object.entries(SUFFISSO_A_MIC).find(([, m]) => m === mic)?.[0];
  return suffisso ? `${ticker}.${suffisso}` : ticker;
}

export function mappaTipoTwelveData(tipo?: string): string {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('etf')) return 'ETF';
  if (t.includes('fund')) return 'FONDO';
  if (t.includes('bond')) return 'OBBLIGAZIONE';
  if (t.includes('digital') || t.includes('crypto')) return 'CRYPTO';
  if (t.includes('stock') || t.includes('share') || t.includes('equity')) return 'AZIONE';
  return 'ALTRO';
}
