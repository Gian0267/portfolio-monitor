export type TipoStrumento = 'AZIONE' | 'ETF' | 'FONDO' | 'OBBLIGAZIONE' | 'CRYPTO' | 'ALTRO';
export type TipoTransazione = 'ACQUISTO' | 'VENDITA' | 'DIVIDENDO' | 'COMMISSIONE' | 'SPLIT';
export type CondizioneAlert = 'SOPRA' | 'SOTTO' | 'VAR_PERC_SOPRA' | 'VAR_PERC_SOTTO';

export interface RigaStrumento {
  id: number;
  simbolo: string;
  isin: string | null;
  nome: string;
  tipo: TipoStrumento;
  valuta: string;
  borsa: string | null;
  paese: string | null;
  settore: string | null;
  note: string | null;
  creato_il: string;
  aggiornato_il: string;
}

export interface RigaTransazione {
  id: number;
  strumento_id: number;
  tipo: TipoTransazione;
  data: string;
  quantita: number;
  prezzo: number;
  commissioni: number;
  tasse: number;
  valuta: string;
  cambio: number | null;
  note: string | null;
  creato_il: string;
}

export interface RigaQuotazione {
  strumento_id: number;
  prezzo: number;
  valuta: string;
  chiusura_precedente: number | null;
  variazione_assoluta: number | null;
  variazione_percentuale: number | null;
  mercato_aperto: number;
  fonte: string;
  aggiornato_il: string;
}
