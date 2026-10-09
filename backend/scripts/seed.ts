/**
 * Popola il database con un portafoglio di esempio (azioni USA ed europee,
 * ETF e un fondo) per provare l'app senza inserire dati a mano.
 * Non richiede connessione: i prezzi si scaricano poi con `npm run aggiorna-quotazioni`.
 *
 * Uso: npm run seed              (aggiunge ai dati esistenti)
 *      npm run seed -- --reset   (svuota prima tutto)
 */
import { db } from '../src/db/index.js';
import { adessoIso } from '../src/lib/date.js';

interface Esempio {
  simbolo: string;
  nome: string;
  tipo: 'AZIONE' | 'ETF' | 'FONDO' | 'OBBLIGAZIONE' | 'CRYPTO' | 'ALTRO';
  isin?: string;
  valuta: string;
  borsa: string;
  paese: string;
  settore?: string;
  operazioni: Array<{
    tipo: 'ACQUISTO' | 'VENDITA' | 'DIVIDENDO';
    data: string;
    quantita: number;
    prezzo: number;
    commissioni?: number;
  }>;
  watchlist?: { prezzo_target: number; nota: string };
}

const ESEMPI: Esempio[] = [
  {
    simbolo: 'AAPL',
    nome: 'Apple Inc.',
    tipo: 'AZIONE',
    isin: 'US0378331005',
    valuta: 'USD',
    borsa: 'NASDAQ',
    paese: 'Stati Uniti',
    settore: 'Tecnologia',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2024-03-12', quantita: 25, prezzo: 172.4, commissioni: 7 },
      { tipo: 'ACQUISTO', data: '2024-11-05', quantita: 15, prezzo: 221.8, commissioni: 7 },
      { tipo: 'DIVIDENDO', data: '2025-02-13', quantita: 40, prezzo: 0.25 },
      { tipo: 'VENDITA', data: '2025-06-18', quantita: 10, prezzo: 198.3, commissioni: 7 },
    ],
  },
  {
    simbolo: 'MSFT',
    nome: 'Microsoft Corporation',
    tipo: 'AZIONE',
    isin: 'US5949181045',
    valuta: 'USD',
    borsa: 'NASDAQ',
    paese: 'Stati Uniti',
    settore: 'Tecnologia',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2023-09-21', quantita: 12, prezzo: 320.5, commissioni: 7 },
      { tipo: 'DIVIDENDO', data: '2025-03-13', quantita: 12, prezzo: 0.83 },
    ],
  },
  {
    simbolo: 'ENI.MI',
    nome: 'Eni S.p.A.',
    tipo: 'AZIONE',
    isin: 'IT0003132476',
    valuta: 'EUR',
    borsa: 'Borsa Italiana',
    paese: 'Italia',
    settore: 'Energia',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2024-01-18', quantita: 400, prezzo: 14.12, commissioni: 5 },
      { tipo: 'DIVIDENDO', data: '2024-09-25', quantita: 400, prezzo: 0.25 },
      { tipo: 'DIVIDENDO', data: '2025-03-24', quantita: 400, prezzo: 0.25 },
    ],
  },
  {
    simbolo: 'ISP.MI',
    nome: 'Intesa Sanpaolo S.p.A.',
    tipo: 'AZIONE',
    isin: 'IT0000072618',
    valuta: 'EUR',
    borsa: 'Borsa Italiana',
    paese: 'Italia',
    settore: 'Finanza',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2023-11-07', quantita: 1500, prezzo: 2.52, commissioni: 5 },
      { tipo: 'DIVIDENDO', data: '2024-05-22', quantita: 1500, prezzo: 0.1444 },
    ],
  },
  {
    simbolo: 'ASML.AS',
    nome: 'ASML Holding N.V.',
    tipo: 'AZIONE',
    isin: 'NL0010273215',
    valuta: 'EUR',
    borsa: 'Euronext Amsterdam',
    paese: 'Paesi Bassi',
    settore: 'Tecnologia',
    operazioni: [{ tipo: 'ACQUISTO', data: '2024-08-06', quantita: 6, prezzo: 812.5, commissioni: 9 }],
  },
  {
    simbolo: 'SAP.DE',
    nome: 'SAP SE',
    tipo: 'AZIONE',
    isin: 'DE0007164600',
    valuta: 'EUR',
    borsa: 'Xetra',
    paese: 'Germania',
    settore: 'Tecnologia',
    operazioni: [{ tipo: 'ACQUISTO', data: '2025-01-15', quantita: 20, prezzo: 237.9, commissioni: 9 }],
  },
  {
    simbolo: 'VWCE.DE',
    nome: 'Vanguard FTSE All-World UCITS ETF Acc',
    tipo: 'ETF',
    isin: 'IE00BK5BQT80',
    valuta: 'EUR',
    borsa: 'Xetra',
    paese: 'Globale',
    settore: 'Azionario globale',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2023-05-10', quantita: 60, prezzo: 97.4, commissioni: 5 },
      { tipo: 'ACQUISTO', data: '2024-02-14', quantita: 40, prezzo: 110.2, commissioni: 5 },
      { tipo: 'ACQUISTO', data: '2025-02-12', quantita: 35, prezzo: 128.6, commissioni: 5 },
    ],
  },
  {
    simbolo: 'SWDA.MI',
    nome: 'iShares Core MSCI World UCITS ETF',
    tipo: 'ETF',
    isin: 'IE00B4L5Y983',
    valuta: 'EUR',
    borsa: 'Borsa Italiana',
    paese: 'Globale',
    settore: 'Azionario sviluppati',
    operazioni: [{ tipo: 'ACQUISTO', data: '2024-06-03', quantita: 120, prezzo: 89.15, commissioni: 5 }],
  },
  {
    simbolo: 'VOO',
    nome: 'Vanguard S&P 500 ETF',
    tipo: 'ETF',
    isin: 'US9229087690',
    valuta: 'USD',
    borsa: 'NYSE Arca',
    paese: 'Stati Uniti',
    settore: 'Azionario USA',
    operazioni: [
      { tipo: 'ACQUISTO', data: '2024-04-22', quantita: 18, prezzo: 462.3, commissioni: 0 },
      { tipo: 'DIVIDENDO', data: '2025-03-28', quantita: 18, prezzo: 1.81 },
    ],
  },
  {
    simbolo: 'AGGH.MI',
    nome: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged',
    tipo: 'OBBLIGAZIONE',
    isin: 'IE00BDBRDM35',
    valuta: 'EUR',
    borsa: 'Borsa Italiana',
    paese: 'Globale',
    settore: 'Obbligazionario',
    operazioni: [{ tipo: 'ACQUISTO', data: '2024-10-09', quantita: 300, prezzo: 4.86, commissioni: 5 }],
  },
  {
    simbolo: '0P0000KSPA.F',
    nome: 'Fondo esempio - Azionario Europa',
    tipo: 'FONDO',
    isin: 'LU0119891520',
    valuta: 'EUR',
    borsa: 'Fondo comune',
    paese: 'Europa',
    settore: 'Azionario Europa',
    operazioni: [{ tipo: 'ACQUISTO', data: '2023-02-20', quantita: 85, prezzo: 58.4, commissioni: 0 }],
  },
  {
    simbolo: 'NVDA',
    nome: 'NVIDIA Corporation',
    tipo: 'AZIONE',
    isin: 'US67066G1040',
    valuta: 'USD',
    borsa: 'NASDAQ',
    paese: 'Stati Uniti',
    settore: 'Tecnologia',
    operazioni: [],
    watchlist: { prezzo_target: 95, nota: 'Entrare sotto i 95 USD' },
  },
  {
    simbolo: 'AIR.PA',
    nome: 'Airbus SE',
    tipo: 'AZIONE',
    isin: 'NL0000235190',
    valuta: 'EUR',
    borsa: 'Euronext Parigi',
    paese: 'Francia',
    settore: 'Industriali',
    operazioni: [],
    watchlist: { prezzo_target: 150, nota: 'Monitorare dopo i conti trimestrali' },
  },
];

function reset(): void {
  db.exec(`
    DELETE FROM transazione;
    DELETE FROM quotazione;
    DELETE FROM prezzo_storico;
    DELETE FROM watchlist;
    DELETE FROM alert;
    DELETE FROM snapshot_portafoglio;
    DELETE FROM strumento;
  `);
  console.log('Dati operativi azzerati.');
}

function seed(): void {
  const ora = adessoIso();
  const trova = db.prepare('SELECT id FROM strumento WHERE simbolo = ?');
  const creaStrumento = db.prepare(
    `INSERT INTO strumento (simbolo, isin, nome, tipo, valuta, borsa, paese, settore, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const creaTransazione = db.prepare(
    `INSERT INTO transazione (strumento_id, tipo, data, quantita, prezzo, commissioni, tasse, valuta, creato_il)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  );
  const creaWatchlist = db.prepare(
    'INSERT INTO watchlist (strumento_id, prezzo_target, nota, creato_il) VALUES (?, ?, ?, ?)',
  );

  let strumenti = 0;
  let operazioni = 0;

  db.transaction(() => {
    for (const e of ESEMPI) {
      if (trova.get(e.simbolo)) {
        console.log(`  - ${e.simbolo} gia presente, salto`);
        continue;
      }
      const info = creaStrumento.run(
        e.simbolo,
        e.isin ?? null,
        e.nome,
        e.tipo,
        e.valuta,
        e.borsa,
        e.paese,
        e.settore ?? null,
        ora,
        ora,
      );
      const id = Number(info.lastInsertRowid);
      strumenti += 1;

      for (const op of e.operazioni) {
        creaTransazione.run(
          id,
          op.tipo,
          op.data,
          op.quantita,
          op.prezzo,
          op.commissioni ?? 0,
          e.valuta,
          ora,
        );
        operazioni += 1;
      }
      if (e.watchlist) {
        creaWatchlist.run(id, e.watchlist.prezzo_target, e.watchlist.nota, ora);
      }
    }
  })();

  console.log(`\nInseriti ${strumenti} strumenti e ${operazioni} transazioni.`);
  console.log('Prossimo passo: npm run aggiorna-quotazioni (scarica i prezzi correnti).');
}

if (process.argv.includes('--reset')) reset();
seed();
