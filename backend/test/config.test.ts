/**
 * Test della lettura delle variabili d'ambiente.
 *
 * Nasce da un bug reale: `Number('')` vale 0 ed e' finito, quindi una
 * variabile assente sembrava valorizzata e il default non scattava.
 * Il backend partiva sulla porta 0 - una porta casuale assegnata dal sistema -
 * mentre il frontend lo cercava sulla 4000, e l'app rispondeva solo errori.
 *
 * Esecuzione: npm test --workspace=@pm/backend
 */
import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { envNum } from '../src/config.js';

const CHIAVE = 'PM_TEST_NUMERO';

afterEach(() => {
  delete process.env[CHIAVE];
});

test('variabile assente: usa il default', () => {
  delete process.env[CHIAVE];
  assert.equal(envNum(CHIAVE, 4000), 4000);
});

test('variabile vuota: usa il default (il caso che ruppe la porta)', () => {
  process.env[CHIAVE] = '';
  assert.equal(envNum(CHIAVE, 4000), 4000);
});

test('solo spazi: usa il default', () => {
  process.env[CHIAVE] = '   ';
  assert.equal(envNum(CHIAVE, 4000), 4000);
});

test('valore numerico valido: viene usato', () => {
  process.env[CHIAVE] = '8080';
  assert.equal(envNum(CHIAVE, 4000), 8080);
});

test('zero esplicito resta zero', () => {
  // "porta 0" e' legittimo se qualcuno lo scrive di proposito: significa
  // "assegnami una porta libera". Deve valere solo se richiesto davvero.
  process.env[CHIAVE] = '0';
  assert.equal(envNum(CHIAVE, 4000), 0);
});

test('testo non numerico: usa il default invece di propagare NaN', () => {
  process.env[CHIAVE] = 'quattromila';
  assert.equal(envNum(CHIAVE, 4000), 4000);
});
