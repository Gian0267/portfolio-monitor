/** Arrotonda a `decimali` cifre evitando gli artefatti del floating point. */
export function arrotonda(n: number, decimali = 2): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimali;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function percentuale(parte: number, totale: number): number {
  if (!totale) return 0;
  return arrotonda((parte / totale) * 100, 2);
}

/** Converte in numero accettando il formato italiano ("1.234,56"). */
export function numeroDa(valore: unknown): number {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : 0;
  if (valore === null || valore === undefined) return 0;
  let s = String(valore).trim().replace(/[\s €$£]/g, '');
  if (!s) return 0;
  const ultimaVirgola = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');
  if (ultimaVirgola > -1 && ultimoPunto > -1) {
    // Il separatore decimale e' l'ultimo dei due.
    if (ultimaVirgola > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaVirgola > -1) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
