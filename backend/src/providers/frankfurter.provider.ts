import { getJson } from './http.js';
import { ErroreProvider, type ProviderDatiMercato } from './tipi.js';

const BASE = 'https://api.frankfurter.app';

interface RispostaCambi {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/**
 * Tassi di cambio ufficiali BCE via frankfurter.app: gratuito, senza chiave,
 * aggiornato ogni giorno lavorativo intorno alle 16:00 CET.
 * Copre solo cambi (nessuna quotazione titoli) ed e' il fallback preferito
 * per le valute perche' e' la fonte piu' stabile delle tre.
 */
export class FrankfurterProvider implements ProviderDatiMercato {
  readonly nome = 'frankfurter';

  disponibile(): boolean {
    return true;
  }

  async cambio(da: string, a: string): Promise<number> {
    return this.cambioAllaData(da, a);
  }

  /** Cambio a una data specifica; senza data usa l'ultimo disponibile. */
  async cambioAllaData(da: string, a: string, dataIso?: string): Promise<number> {
    if (da === a) return 1;
    const percorso = dataIso ?? 'latest';
    const url = `${BASE}/${percorso}?from=${encodeURIComponent(da)}&to=${encodeURIComponent(a)}`;
    const dati = await getJson<RispostaCambi>(this.nome, url);
    const tasso = dati.rates?.[a.toUpperCase()];
    if (typeof tasso !== 'number' || !Number.isFinite(tasso)) {
      throw new ErroreProvider(this.nome, `cambio ${da}/${a} non disponibile`);
    }
    return tasso;
  }
}
