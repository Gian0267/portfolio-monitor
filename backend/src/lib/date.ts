/** Data odierna in formato ISO YYYY-MM-DD (fuso locale del server). */
export function oggiIso(): string {
  return isoDa(new Date());
}

export function isoDa(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}

export function adessoIso(): string {
  return new Date().toISOString();
}

/**
 * Accetta YYYY-MM-DD oppure DD/MM/YYYY (formato italiano) e normalizza in ISO.
 * `new Date("17/06/2023")` in JS e' invalido, da qui il parser esplicito.
 */
export function normalizzaData(valore: string | Date): string {
  if (valore instanceof Date) return isoDa(valore);
  const grezzo = String(valore).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(grezzo);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const ita = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(grezzo);
  if (ita) {
    const g = ita[1].padStart(2, '0');
    const m = ita[2].padStart(2, '0');
    return `${ita[3]}-${m}-${g}`;
  }
  throw new Error(`Data non valida: "${grezzo}" (usa YYYY-MM-DD o DD/MM/YYYY)`);
}

export function giorniIndietro(giorni: number, da = new Date()): string {
  const d = new Date(da);
  d.setDate(d.getDate() - giorni);
  return isoDa(d);
}

export function timestampUnix(dataIso: string): number {
  return Math.floor(new Date(`${dataIso}T00:00:00Z`).getTime() / 1000);
}

/** Elenco di date ISO (giorni di calendario) fra due estremi inclusi. */
export function intervalloGiorni(daIso: string, aIso: string): string[] {
  const out: string[] = [];
  const cursore = new Date(`${daIso}T00:00:00Z`);
  const fine = new Date(`${aIso}T00:00:00Z`);
  while (cursore.getTime() <= fine.getTime()) {
    out.push(cursore.toISOString().slice(0, 10));
    cursore.setUTCDate(cursore.getUTCDate() + 1);
  }
  return out;
}
