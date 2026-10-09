/**
 * Test del parser CSV: separatori, virgolette e numeri in formato italiano.
 * `importaTransazioniCsv` tocca il DB ed e' coperto dai test manuali via API;
 * qui verifichiamo le funzioni pure.
 *
 * Esecuzione: npm test --workspace=@pm/backend
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { leggiCsv } from '../src/services/csv.service.js';
import { numeroDa } from '../src/lib/numeri.js';
import { normalizzaData } from '../src/lib/date.js';

test('CSV con virgole', () => {
  const r = leggiCsv('a,b,c\n1,2,3\n');
  assert.deepEqual(r, [
    ['a', 'b', 'c'],
    ['1', '2', '3'],
  ]);
});

test('CSV con punto e virgola (formato italiano)', () => {
  const r = leggiCsv('simbolo;prezzo\nENI.MI;14,12\n');
  assert.deepEqual(r, [
    ['simbolo', 'prezzo'],
    ['ENI.MI', '14,12'],
  ]);
});

test('CSV separato da tabulazione', () => {
  const r = leggiCsv('a\tb\n1\t2\n');
  assert.deepEqual(r, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('virgolette: separatori e newline interni al campo', () => {
  const r = leggiCsv('nome,note\n"Rossi, Mario","prima riga\nseconda riga"\n');
  assert.equal(r[1][0], 'Rossi, Mario');
  assert.equal(r[1][1], 'prima riga\nseconda riga');
});

test('virgolette raddoppiate diventano una virgoletta', () => {
  const r = leggiCsv('a\n"dice ""ciao"""\n');
  assert.equal(r[1][0], 'dice "ciao"');
});

test('BOM e CRLF vengono ignorati', () => {
  const r = leggiCsv('﻿a,b\r\n1,2\r\n');
  assert.deepEqual(r[0], ['a', 'b']);
  assert.deepEqual(r[1], ['1', '2']);
});

test('le righe interamente vuote sono scartate', () => {
  const r = leggiCsv('a,b\n1,2\n\n,\n3,4\n');
  assert.equal(r.length, 3);
});

test('numeroDa gestisce il formato italiano e quello inglese', () => {
  assert.equal(numeroDa('1.234,56'), 1234.56, 'migliaia con punto, decimali con virgola');
  assert.equal(numeroDa('1,234.56'), 1234.56, 'migliaia con virgola, decimali con punto');
  assert.equal(numeroDa('14,12'), 14.12);
  assert.equal(numeroDa('14.12'), 14.12);
  assert.equal(numeroDa('1 234,50'), 1234.5, 'spazio come separatore migliaia');
  assert.equal(numeroDa('€ 58,42'), 58.42, 'simbolo di valuta rimosso');
  assert.equal(numeroDa(''), 0);
  assert.equal(numeroDa('n/d'), 0, 'testo non numerico non deve propagare NaN');
  assert.equal(numeroDa(42), 42);
});

test('normalizzaData accetta ISO e formato italiano', () => {
  assert.equal(normalizzaData('2025-03-15'), '2025-03-15');
  assert.equal(normalizzaData('15/03/2025'), '2025-03-15');
  assert.equal(normalizzaData('5/3/2025'), '2025-03-05', 'cifre singole normalizzate');
  assert.equal(normalizzaData('15-03-2025'), '2025-03-15');
  assert.throws(() => normalizzaData('non una data'));
});
