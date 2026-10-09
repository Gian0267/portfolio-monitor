/**
 * Test del calcolo posizioni: e' il cuore contabile dell'app, un errore qui
 * falsa ogni numero mostrato in dashboard.
 *
 * Si passano le transazioni direttamente a `calcolaPosizione`, quindi questi
 * test non toccano il database.
 *
 * Esecuzione: npm test --workspace=@pm/backend
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calcolaPosizione, quantitaAllaData } from '../src/services/posizioni.service.js';
import type { RigaTransazione, TipoTransazione } from '../src/tipi.js';

let contatore = 0;
function op(
  tipo: TipoTransazione,
  data: string,
  quantita: number,
  prezzo: number,
  commissioni = 0,
  tasse = 0,
): RigaTransazione {
  contatore += 1;
  return {
    id: contatore,
    strumento_id: 1,
    tipo,
    data,
    quantita,
    prezzo,
    commissioni,
    tasse,
    valuta: 'EUR',
    cambio: 1,
    note: null,
    creato_il: '2026-01-01T00:00:00.000Z',
  };
}

test('posizione vuota senza transazioni', () => {
  const p = calcolaPosizione(1, []);
  assert.equal(p.quantita, 0);
  assert.equal(p.prezzoMedio, 0);
  assert.equal(p.costoTotale, 0);
  assert.equal(p.numeroOperazioni, 0);
});

test('acquisto singolo: le commissioni entrano nel prezzo medio', () => {
  // 10 x 100 = 1000, piu' 10 di commissioni => costo 1010, medio 101.
  const p = calcolaPosizione(1, [op('ACQUISTO', '2025-01-10', 10, 100, 10)]);
  assert.equal(p.quantita, 10);
  assert.equal(p.costoTotale, 1010);
  assert.equal(p.prezzoMedio, 101);
  assert.equal(p.oneriTotali, 10);
});

test('due acquisti: prezzo medio ponderato sulle quantita', () => {
  // 10 x 100 + 30 x 200 = 7000 su 40 pezzi => 175.
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('ACQUISTO', '2025-02-10', 30, 200),
  ]);
  assert.equal(p.quantita, 40);
  assert.equal(p.prezzoMedio, 175);
  assert.equal(p.costoTotale, 7000);
});

test('vendita parziale: realizza utile e NON muove il prezzo medio', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 100, 10), // costo 1000, medio 10
    op('VENDITA', '2025-06-10', 40, 15, 5), // ricavo 600 - 5 = 595, costo 400
  ]);
  assert.equal(p.quantita, 60);
  assert.equal(p.prezzoMedio, 10, 'il medio di carico resta quello degli acquisti');
  assert.equal(p.costoTotale, 600);
  assert.equal(p.plRealizzato, 195); // 595 - 400
  assert.equal(p.quantitaVenduta, 40);
});

test('vendita totale: azzera quantita e costo, lascia il realizzato', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 50, 20),
    op('VENDITA', '2025-09-10', 50, 25),
  ]);
  assert.equal(p.quantita, 0);
  assert.equal(p.costoTotale, 0);
  assert.equal(p.prezzoMedio, 0);
  assert.equal(p.plRealizzato, 250);
});

test('vendita in perdita: realizzato negativo', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('VENDITA', '2025-03-10', 10, 80),
  ]);
  assert.equal(p.plRealizzato, -200);
});

test('vendita oltre il posseduto: limitata alla quantita disponibile', () => {
  // Capita importando un CSV incompleto: non deve generare quantita negative.
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('VENDITA', '2025-03-10', 25, 120),
  ]);
  assert.equal(p.quantita, 0);
  assert.equal(p.plRealizzato, 200, 'realizzato calcolato sui soli 10 pezzi effettivi');
});

test('split 4:1: quadruplica i pezzi, quarta il medio, costo invariato', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 400), // costo 4000, medio 400
    op('SPLIT', '2025-06-01', 4, 0),
  ]);
  assert.equal(p.quantita, 40);
  assert.equal(p.prezzoMedio, 100);
  assert.equal(p.costoTotale, 4000);
});

test('raggruppamento 1:10 (rapporto 0.1)', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 100, 5), // costo 500
    op('SPLIT', '2025-06-01', 0.1, 0),
  ]);
  assert.equal(p.quantita, 10);
  assert.equal(p.prezzoMedio, 50);
  assert.equal(p.costoTotale, 500);
});

test('vendita dopo split: usa il medio rettificato', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 400),
    op('SPLIT', '2025-06-01', 4, 0),
    op('VENDITA', '2025-07-01', 20, 150), // medio post-split 100 => utile 1000
  ]);
  assert.equal(p.quantita, 20);
  assert.equal(p.plRealizzato, 1000);
  assert.equal(p.costoTotale, 2000);
});

test('dividendo con quantita: importo = quantita x prezzo, al netto delle tasse', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 100, 10),
    op('DIVIDENDO', '2025-05-10', 100, 0.5, 0, 13), // lordo 50, tasse 13 => 37
  ]);
  assert.equal(p.dividendiIncassati, 37);
  assert.equal(p.quantita, 100, 'il dividendo non tocca la quantita');
  assert.equal(p.costoTotale, 1000, 'il dividendo non tocca il costo');
});

test('dividendo come importo unico: usa il solo campo prezzo', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 100, 10),
    op('DIVIDENDO', '2025-05-10', 0, 42),
  ]);
  assert.equal(p.dividendiIncassati, 42);
});

test('commissione autonoma: riduce il realizzato, non il costo di carico', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('COMMISSIONE', '2025-12-31', 0, 0, 25), // bollo/canone annuo
  ]);
  assert.equal(p.costoTotale, 1000);
  assert.equal(p.plRealizzato, -25);
  assert.equal(p.oneriTotali, 25);
});

test('ordine cronologico: FIFO di inserimento non altera il medio ponderato', () => {
  const crescente = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('ACQUISTO', '2025-02-10', 10, 200),
    op('VENDITA', '2025-03-10', 5, 300),
  ]);
  assert.equal(crescente.prezzoMedio, 150);
  assert.equal(crescente.plRealizzato, 750); // 1500 ricavo - 750 costo
  assert.equal(crescente.quantita, 15);
});

test('date prima e ultima operazione', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2024-05-02', 1, 10),
    op('ACQUISTO', '2025-11-20', 1, 10),
    op('DIVIDENDO', '2025-01-15', 2, 1),
  ]);
  assert.equal(p.primaOperazione, '2024-05-02');
  assert.equal(p.ultimaOperazione, '2025-11-20');
  assert.equal(p.numeroOperazioni, 3);
});

test('quantitaAllaData ricostruisce lo storico delle quantita', () => {
  const ts = [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('ACQUISTO', '2025-03-10', 10, 100),
    op('SPLIT', '2025-04-01', 2, 0),
    op('VENDITA', '2025-06-10', 15, 100),
  ];
  assert.equal(quantitaAllaData(ts, '2025-01-01'), 0, 'prima di ogni operazione');
  assert.equal(quantitaAllaData(ts, '2025-01-10'), 10, 'il giorno stesso conta');
  assert.equal(quantitaAllaData(ts, '2025-03-15'), 20);
  assert.equal(quantitaAllaData(ts, '2025-04-05'), 40, 'dopo lo split');
  assert.equal(quantitaAllaData(ts, '2025-12-31'), 25, 'dopo la vendita');
});

test('posizione chiusa e riaperta', () => {
  const p = calcolaPosizione(1, [
    op('ACQUISTO', '2025-01-10', 10, 100),
    op('VENDITA', '2025-02-10', 10, 120), // +200
    op('ACQUISTO', '2025-05-10', 5, 90), // nuovo carico pulito
  ]);
  assert.equal(p.quantita, 5);
  assert.equal(p.prezzoMedio, 90, 'il nuovo carico non eredita il vecchio medio');
  assert.equal(p.plRealizzato, 200);
});
