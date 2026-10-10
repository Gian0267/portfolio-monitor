import type {
  Alert,
  CondizioneAlert,
  Dividendi,
  EsitoAggiornamento,
  EsitoImport,
  Portafoglio,
  PuntoAndamento,
  RisultatoRicerca,
  StatoImpostazioni,
  Strumento,
  StrumentoConPosizione,
  StrumentoDettaglio,
  Transazione,
  VoceWatchlist,
} from './tipi.ts';

/** Errore che porta con se' il messaggio leggibile prodotto dal backend. */
export class ErroreApi extends Error {
  constructor(
    readonly stato: number,
    message: string,
    readonly dettagli?: unknown,
  ) {
    super(message);
    this.name = 'ErroreApi';
  }
}

async function chiama<T>(percorso: string, opzioni: RequestInit = {}): Promise<T> {
  const risposta = await fetch(`/api${percorso}`, {
    ...opzioni,
    headers: {
      ...(opzioni.body && typeof opzioni.body === 'string' && !opzioni.headers
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...opzioni.headers,
    },
  });

  if (!risposta.ok) {
    let messaggio = `Errore ${risposta.status}`;
    let dettagli: unknown;
    try {
      const corpo = await risposta.json();
      messaggio = corpo.errore ?? messaggio;
      dettagli = corpo.dettagli;
      // Gli errori di validazione arrivano come elenco campo/messaggio.
      if (Array.isArray(dettagli)) {
        messaggio += `: ${dettagli
          .map((d: { campo?: string; messaggio?: string }) => `${d.campo} ${d.messaggio}`)
          .join(', ')}`;
      }
    } catch {
      // Corpo non JSON: di solito non e' l'app a rispondere ma il proxy o il
      // sistema, perche' il server e' spento. Diciamolo invece di mostrare
      // un codice di stato nudo.
      messaggio =
        risposta.status >= 500
          ? "Il server dell'app non risponde. Controlla che la finestra di avvio sia ancora aperta, poi riprova."
          : `${messaggio} ${risposta.statusText}`.trim();
    }
    throw new ErroreApi(risposta.status, messaggio, dettagli);
  }

  if (risposta.status === 204) return undefined as T;
  return (await risposta.json()) as T;
}

const json = (corpo: unknown): RequestInit => ({
  body: JSON.stringify(corpo),
  headers: { 'Content-Type': 'application/json' },
});

export const api = {
  salute: () => chiama<{ stato: string; valutaBase: string; versione: string }>('/salute'),

  // --- Strumenti ---
  strumenti: () => chiama<StrumentoConPosizione[]>('/strumenti'),
  strumento: (id: number) => chiama<StrumentoDettaglio>(`/strumenti/${id}`),
  creaStrumento: (dati: Partial<Strumento>) =>
    chiama<Strumento>('/strumenti', { method: 'POST', ...json(dati) }),
  modificaStrumento: (id: number, dati: Partial<Strumento>) =>
    chiama<Strumento>(`/strumenti/${id}`, { method: 'PUT', ...json(dati) }),
  eliminaStrumento: (id: number) =>
    chiama<{ eliminato: number }>(`/strumenti/${id}`, { method: 'DELETE' }),
  ricerca: (q: string) => chiama<RisultatoRicerca[]>(`/strumenti/ricerca?q=${encodeURIComponent(q)}`),
  storico: (id: number, giorni: number) =>
    chiama<{ simbolo: string; valuta: string; punti: Array<{ data: string; chiusura: number }> }>(
      `/strumenti/${id}/storico?giorni=${giorni}`,
    ),
  aggiornaQuotazione: (id: number) =>
    chiama<unknown>(`/strumenti/${id}/aggiorna-quotazione`, { method: 'POST' }),

  // --- Transazioni ---
  transazioni: (filtri: { strumento_id?: number; tipo?: string; da?: string; a?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtri)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return chiama<Transazione[]>(`/transazioni${qs ? `?${qs}` : ''}`);
  },
  creaTransazione: (dati: Record<string, unknown>) =>
    chiama<Transazione>('/transazioni', { method: 'POST', ...json(dati) }),
  modificaTransazione: (id: number, dati: Record<string, unknown>) =>
    chiama<Transazione>(`/transazioni/${id}`, { method: 'PUT', ...json(dati) }),
  eliminaTransazione: (id: number) =>
    chiama<{ eliminato: number }>(`/transazioni/${id}`, { method: 'DELETE' }),
  importaCsv: (contenuto: string) =>
    chiama<EsitoImport>('/transazioni/import', {
      method: 'POST',
      body: contenuto,
      headers: { 'Content-Type': 'text/csv' },
    }),

  // --- Portafoglio ---
  portafoglio: () => chiama<Portafoglio>('/portafoglio'),
  andamento: (giorni: number) => chiama<PuntoAndamento[]>(`/portafoglio/andamento?giorni=${giorni}`),
  dividendi: () => chiama<Dividendi>('/portafoglio/dividendi'),
  aggiornaTutto: () =>
    chiama<EsitoAggiornamento>('/portafoglio/aggiorna', { method: 'POST' }),

  // --- Watchlist ---
  watchlist: () => chiama<VoceWatchlist[]>('/watchlist'),
  aggiungiWatchlist: (dati: { strumento_id: number; prezzo_target?: number | null; nota?: string | null }) =>
    chiama<unknown>('/watchlist', { method: 'POST', ...json(dati) }),
  modificaWatchlist: (id: number, dati: { prezzo_target?: number | null; nota?: string | null }) =>
    chiama<unknown>(`/watchlist/${id}`, { method: 'PUT', ...json(dati) }),
  rimuoviWatchlist: (id: number) =>
    chiama<unknown>(`/watchlist/${id}`, { method: 'DELETE' }),

  // --- Alert ---
  alert: (soloAttivi = false) => chiama<Alert[]>(`/alert?solo_attivi=${soloAttivi}`),
  creaAlert: (dati: { strumento_id: number; condizione: CondizioneAlert; valore: number }) =>
    chiama<{ id: number }>('/alert', { method: 'POST', ...json(dati) }),
  eliminaAlert: (id: number) => chiama<unknown>(`/alert/${id}`, { method: 'DELETE' }),
  riattivaAlert: (id: number) => chiama<unknown>(`/alert/${id}/riattiva`, { method: 'POST' }),

  // --- Impostazioni ---
  impostazioni: () => chiama<StatoImpostazioni>('/impostazioni'),
  salvaImpostazioni: (dati: Record<string, string>) =>
    chiama<{ aggiornate: number }>('/impostazioni', { method: 'PUT', ...json(dati) }),
};

/** URL per i download diretti gestiti dal browser. */
export const urlExport = {
  transazioni: '/api/transazioni/export.csv',
  portafoglio: '/api/portafoglio/export.csv',
};
