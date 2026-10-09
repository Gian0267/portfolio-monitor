export interface Quotazione {
  simbolo: string;
  prezzo: number;
  valuta: string;
  chiusuraPrecedente?: number;
  variazioneAssoluta?: number;
  variazionePercentuale?: number;
  mercatoAperto?: boolean;
  nome?: string;
  borsa?: string;
  fonte: string;
  timestamp: string;
}

export interface PuntoPrezzo {
  data: string; // YYYY-MM-DD
  chiusura: number;
}

export interface SeriePrezzi {
  simbolo: string;
  valuta: string;
  punti: PuntoPrezzo[];
  fonte: string;
}

export interface RisultatoRicerca {
  simbolo: string;
  nome: string;
  tipo: string;
  borsa?: string;
  valuta?: string;
  isin?: string;
}

/** Contratto comune a tutti i provider. Un provider puo' supportarne solo una parte. */
export interface ProviderDatiMercato {
  readonly nome: string;
  /** false quando mancano le credenziali: la catena lo salta senza tentare. */
  disponibile(): boolean;
  quotazione?(simbolo: string): Promise<Quotazione>;
  storico?(simbolo: string, daIso: string, aIso: string): Promise<SeriePrezzi>;
  ricerca?(query: string): Promise<RisultatoRicerca[]>;
  cambio?(da: string, a: string): Promise<number>;
}

export class ErroreProvider extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ErroreProvider';
  }
}
