export type TipoStrumento = 'AZIONE' | 'ETF' | 'FONDO' | 'OBBLIGAZIONE' | 'CRYPTO' | 'ALTRO';
export type TipoTransazione = 'ACQUISTO' | 'VENDITA' | 'DIVIDENDO' | 'COMMISSIONE' | 'SPLIT';
export type CondizioneAlert = 'SOPRA' | 'SOTTO' | 'VAR_PERC_SOPRA' | 'VAR_PERC_SOTTO';

export interface Strumento {
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

export interface Posizione {
  strumentoId: number;
  quantita: number;
  prezzoMedio: number;
  costoTotale: number;
  plRealizzato: number;
  dividendiIncassati: number;
  oneriTotali: number;
  quantitaAcquistata: number;
  quantitaVenduta: number;
  primaOperazione: string | null;
  ultimaOperazione: string | null;
  numeroOperazioni: number;
}

export interface Quotazione {
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

export interface Transazione {
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
  simbolo?: string;
  strumento_nome?: string;
  strumento_tipo?: TipoStrumento;
}

export interface StrumentoConPosizione extends Strumento {
  posizione: Posizione;
  quotazione: Quotazione | null;
}

export interface StrumentoDettaglio extends StrumentoConPosizione {
  transazioni: Transazione[];
}

export interface RigaPortafoglio {
  strumento: Strumento;
  posizione: Posizione;
  prezzoCorrente: number | null;
  variazioneGiornoPercentuale: number | null;
  valoreMercato: number;
  costo: number;
  plNonRealizzato: number;
  plNonRealizzatoPercentuale: number;
  plGiorno: number;
  plRealizzato: number;
  dividendi: number;
  plTotale: number;
  pesoPercentuale: number;
  cambioApplicato: number;
  quotazioneAggiornataIl: string | null;
  fonteQuotazione: string | null;
  prezzoMancante: boolean;
}

export interface TotaliPortafoglio {
  valutaBase: string;
  valoreMercato: number;
  costo: number;
  plNonRealizzato: number;
  plNonRealizzatoPercentuale: number;
  plGiorno: number;
  plGiornoPercentuale: number;
  plRealizzato: number;
  dividendi: number;
  plTotale: number;
  plTotalePercentuale: number;
  numeroPosizioni: number;
  numeroStrumenti: number;
  oneriTotali: number;
}

export interface VoceAllocazione {
  etichetta: string;
  valore: number;
  percentuale: number;
}

export interface Portafoglio {
  totali: TotaliPortafoglio;
  righe: RigaPortafoglio[];
  allocazionePerTipo: VoceAllocazione[];
  allocazionePerValuta: VoceAllocazione[];
  allocazionePerPaese: VoceAllocazione[];
  allocazionePerSettore: VoceAllocazione[];
  migliori: RigaPortafoglio[];
  peggiori: RigaPortafoglio[];
  avvisi: string[];
  calcolatoIl: string;
}

export interface PuntoAndamento {
  data: string;
  valore: number;
  costo: number;
  pl: number;
}

export interface VoceWatchlist {
  id: number;
  strumento_id: number;
  simbolo: string;
  nome: string;
  tipo: TipoStrumento;
  valuta: string;
  borsa: string | null;
  isin: string | null;
  prezzo_target: number | null;
  nota: string | null;
  prezzo: number | null;
  variazione_percentuale: number | null;
  quotazione_aggiornata_il: string | null;
  fonte: string | null;
  distanza_target_percentuale: number | null;
  target_raggiunto: boolean | null;
  creato_il: string;
}

export interface Alert {
  id: number;
  strumento_id: number;
  simbolo: string;
  nome: string;
  valuta: string;
  condizione: CondizioneAlert;
  valore: number;
  attivo: number;
  scattato_il: string | null;
  prezzo_scatto: number | null;
  prezzo_attuale: number | null;
  creato_il: string;
}

export interface RisultatoRicerca {
  simbolo: string;
  nome: string;
  tipo: string;
  borsa?: string;
  valuta?: string;
}

export interface EsitoAggiornamento {
  aggiornati: number;
  falliti: Array<{ simbolo: string; errore: string }>;
  durataMs: number;
}

export interface EsitoImport {
  importate: number;
  strumentiCreati: string[];
  scartate: Array<{ riga: number; motivo: string }>;
}

export interface Dividendi {
  valutaBase: string;
  dettaglio: Array<{
    anno: string;
    simbolo: string;
    nome: string;
    valuta: string;
    netto: number;
    netto_base: number;
    accrediti: number;
  }>;
  perAnno: Array<{ anno: string; totale: number }>;
}

export interface StatoImpostazioni {
  impostazioni: Record<string, string>;
  provider: { quotazioni: string[]; cambi: string[]; twelvedataConfigurato: boolean };
  quotazioneTtlSecondi: number;
  cronAggiornamento: string | null;
  percorsoDb: string;
}
