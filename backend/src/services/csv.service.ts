import { db } from '../db/index.js';
import { adessoIso, normalizzaData } from '../lib/date.js';
import { numeroDa } from '../lib/numeri.js';
import type { RigaStrumento, TipoStrumento, TipoTransazione } from '../tipi.js';

const COLONNE_EXPORT = [
  'simbolo',
  'nome',
  'tipo_strumento',
  'isin',
  'valuta_strumento',
  'tipo',
  'data',
  'quantita',
  'prezzo',
  'commissioni',
  'tasse',
  'valuta',
  'note',
] as const;

/** Intestazioni accettate in import (minuscole, senza accenti) -> colonna interna. */
const ALIAS: Record<string, string> = {
  simbolo: 'simbolo',
  ticker: 'simbolo',
  symbol: 'simbolo',
  nome: 'nome',
  name: 'nome',
  descrizione: 'nome',
  isin: 'isin',
  tipo_strumento: 'tipo_strumento',
  'tipo strumento': 'tipo_strumento',
  categoria: 'tipo_strumento',
  tipo: 'tipo',
  operazione: 'tipo',
  movimento: 'tipo',
  data: 'data',
  date: 'data',
  'data operazione': 'data',
  quantita: 'quantita',
  'quantità': 'quantita',
  quantity: 'quantita',
  qty: 'quantita',
  pezzi: 'quantita',
  prezzo: 'prezzo',
  price: 'prezzo',
  'prezzo unitario': 'prezzo',
  commissioni: 'commissioni',
  commissione: 'commissioni',
  fees: 'commissioni',
  tasse: 'tasse',
  imposte: 'tasse',
  taxes: 'tasse',
  valuta: 'valuta',
  currency: 'valuta',
  valuta_strumento: 'valuta_strumento',
  note: 'note',
  notes: 'note',
};

const TIPI_TRANSAZIONE: TipoTransazione[] = [
  'ACQUISTO',
  'VENDITA',
  'DIVIDENDO',
  'COMMISSIONE',
  'SPLIT',
];
const TIPI_STRUMENTO: TipoStrumento[] = [
  'AZIONE',
  'ETF',
  'FONDO',
  'OBBLIGAZIONE',
  'CRYPTO',
  'ALTRO',
];

/** Sinonimi comuni nei tracciati degli intermediari. */
const ALIAS_TIPO_TRANSAZIONE: Record<string, TipoTransazione> = {
  acquisto: 'ACQUISTO',
  buy: 'ACQUISTO',
  compra: 'ACQUISTO',
  carico: 'ACQUISTO',
  vendita: 'VENDITA',
  sell: 'VENDITA',
  vendi: 'VENDITA',
  scarico: 'VENDITA',
  dividendo: 'DIVIDENDO',
  dividend: 'DIVIDENDO',
  cedola: 'DIVIDENDO',
  commissione: 'COMMISSIONE',
  fee: 'COMMISSIONE',
  split: 'SPLIT',
  frazionamento: 'SPLIT',
};

export interface EsitoImport {
  importate: number;
  strumentiCreati: string[];
  scartate: Array<{ riga: number; motivo: string }>;
}

/** Parser CSV minimale ma corretto su virgolette, virgole e newline interni. */
export function leggiCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let campo = '';
  let riga: string[] = [];
  let traVirgolette = false;

  const pulito = testo.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const separatore = rilevaSeparatore(pulito);

  for (let i = 0; i < pulito.length; i += 1) {
    const c = pulito[i];
    if (traVirgolette) {
      if (c === '"') {
        if (pulito[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else traVirgolette = false;
      } else campo += c;
      continue;
    }
    if (c === '"') traVirgolette = true;
    else if (c === separatore) {
      riga.push(campo);
      campo = '';
    } else if (c === '\n') {
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe.filter((r) => r.some((c) => c.trim() !== ''));
}

/** I CSV italiani usano spesso il punto e virgola: lo deduciamo dall'intestazione. */
function rilevaSeparatore(testo: string): string {
  const primaRiga = testo.split('\n', 1)[0] ?? '';
  const puntoEVirgola = (primaRiga.match(/;/g) ?? []).length;
  const virgole = (primaRiga.match(/,/g) ?? []).length;
  const tab = (primaRiga.match(/\t/g) ?? []).length;
  if (tab > puntoEVirgola && tab > virgole) return '\t';
  return puntoEVirgola > virgole ? ';' : ',';
}

function normalizzaIntestazione(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Importa transazioni da CSV creando al volo gli strumenti mancanti.
 * Tutto in una transazione SQLite: o passa l'intero file o nulla, per non
 * lasciare un portafoglio mezzo importato.
 */
export function importaTransazioniCsv(contenuto: string): EsitoImport {
  const righe = leggiCsv(contenuto);
  if (righe.length < 2) {
    throw new Error('Il CSV deve contenere una riga di intestazione e almeno una transazione.');
  }

  const intestazione = righe[0].map((h) => ALIAS[normalizzaIntestazione(h)] ?? normalizzaIntestazione(h));
  const indice = (nome: string) => intestazione.indexOf(nome);

  for (const obbligatoria of ['simbolo', 'tipo', 'data']) {
    if (indice(obbligatoria) === -1) {
      throw new Error(
        `Colonna "${obbligatoria}" mancante. Intestazioni trovate: ${righe[0].join(', ')}`,
      );
    }
  }

  const esito: EsitoImport = { importate: 0, strumentiCreati: [], scartate: [] };

  const trovaStrumento = db.prepare('SELECT * FROM strumento WHERE simbolo = ?');
  const creaStrumento = db.prepare(
    `INSERT INTO strumento (simbolo, isin, nome, tipo, valuta, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const inserisciTransazione = db.prepare(
    `INSERT INTO transazione (strumento_id, tipo, data, quantita, prezzo,
                              commissioni, tasse, valuta, note, creato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (let i = 1; i < righe.length; i += 1) {
      const riga = righe[i];
      const valore = (nome: string): string => {
        const idx = indice(nome);
        return idx === -1 ? '' : (riga[idx] ?? '').trim();
      };

      try {
        const simbolo = valore('simbolo').toUpperCase();
        if (!simbolo) throw new Error('simbolo vuoto');

        const tipoGrezzo = valore('tipo').toLowerCase();
        const tipo =
          ALIAS_TIPO_TRANSAZIONE[tipoGrezzo] ??
          (TIPI_TRANSAZIONE.includes(tipoGrezzo.toUpperCase() as TipoTransazione)
            ? (tipoGrezzo.toUpperCase() as TipoTransazione)
            : null);
        if (!tipo) {
          throw new Error(`tipo "${valore('tipo')}" non riconosciuto (attesi: ${TIPI_TRANSAZIONE.join('/')})`);
        }

        const data = normalizzaData(valore('data'));
        const valutaTransazione = (valore('valuta') || valore('valuta_strumento') || 'EUR').toUpperCase();

        let strumento = trovaStrumento.get(simbolo) as RigaStrumento | undefined;
        if (!strumento) {
          const tipoStrumentoGrezzo = valore('tipo_strumento').toUpperCase();
          const tipoStrumento = TIPI_STRUMENTO.includes(tipoStrumentoGrezzo as TipoStrumento)
            ? (tipoStrumentoGrezzo as TipoStrumento)
            : 'AZIONE';
          const ora = adessoIso();
          creaStrumento.run(
            simbolo,
            valore('isin') || null,
            valore('nome') || simbolo,
            tipoStrumento,
            (valore('valuta_strumento') || valutaTransazione).toUpperCase(),
            ora,
            ora,
          );
          strumento = trovaStrumento.get(simbolo) as RigaStrumento;
          esito.strumentiCreati.push(simbolo);
        }

        inserisciTransazione.run(
          strumento.id,
          tipo,
          data,
          numeroDa(valore('quantita')),
          numeroDa(valore('prezzo')),
          numeroDa(valore('commissioni')),
          numeroDa(valore('tasse')),
          valutaTransazione,
          valore('note') || null,
          adessoIso(),
        );
        esito.importate += 1;
      } catch (e) {
        esito.scartate.push({
          riga: i + 1,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (esito.importate === 0) {
      throw new Error(
        `Nessuna riga importabile. Primo errore: ${esito.scartate[0]?.motivo ?? 'sconosciuto'}`,
      );
    }
  })();

  return esito;
}

function campoCsv(valore: unknown): string {
  const s = valore === null || valore === undefined ? '' : String(valore);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export di tutte le transazioni, reimportabile da questa stessa app. */
export function esportaTransazioniCsv(): string {
  const righe = db
    .prepare(
      `SELECT s.simbolo, s.nome, s.tipo AS tipo_strumento, s.isin,
              s.valuta AS valuta_strumento,
              t.tipo, t.data, t.quantita, t.prezzo, t.commissioni, t.tasse, t.valuta, t.note
         FROM transazione t
         JOIN strumento s ON s.id = t.strumento_id
        ORDER BY t.data ASC, t.id ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const linee = [COLONNE_EXPORT.join(',')];
  for (const r of righe) linee.push(COLONNE_EXPORT.map((c) => campoCsv(r[c])).join(','));
  return `${linee.join('\n')}\n`;
}

/** Export della situazione attuale del portafoglio (una riga per posizione). */
export function esportaPortafoglioCsv(
  righe: Array<{
    strumento: RigaStrumento;
    posizione: { quantita: number; prezzoMedio: number };
    prezzoCorrente: number | null;
    valoreMercato: number;
    costo: number;
    plNonRealizzato: number;
    plNonRealizzatoPercentuale: number;
    pesoPercentuale: number;
  }>,
  valutaBase: string,
): string {
  const intestazione = [
    'simbolo',
    'nome',
    'tipo',
    'isin',
    'valuta',
    'quantita',
    'prezzo_medio',
    'prezzo_corrente',
    `valore_${valutaBase.toLowerCase()}`,
    `costo_${valutaBase.toLowerCase()}`,
    `pl_${valutaBase.toLowerCase()}`,
    'pl_percentuale',
    'peso_percentuale',
  ];
  const linee = [intestazione.join(',')];
  for (const r of righe) {
    linee.push(
      [
        r.strumento.simbolo,
        r.strumento.nome,
        r.strumento.tipo,
        r.strumento.isin ?? '',
        r.strumento.valuta,
        r.posizione.quantita,
        r.posizione.prezzoMedio,
        r.prezzoCorrente ?? '',
        r.valoreMercato,
        r.costo,
        r.plNonRealizzato,
        r.plNonRealizzatoPercentuale,
        r.pesoPercentuale,
      ]
        .map(campoCsv)
        .join(','),
    );
  }
  return `${linee.join('\n')}\n`;
}
