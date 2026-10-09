import {
  ErroreProvider,
  type ProviderDatiMercato,
  type Quotazione,
  type RisultatoRicerca,
  type SeriePrezzi,
} from './tipi.js';

type Metodo = 'quotazione' | 'storico' | 'ricerca' | 'cambio';

/**
 * Prova i provider nell'ordine configurato e restituisce la prima risposta
 * valida. Salta i provider non disponibili (credenziali mancanti) e quelli
 * che non implementano il metodo richiesto.
 *
 * Se tutti falliscono solleva un errore che elenca il motivo di ciascuno:
 * e' l'unico modo per capire, da un log, se il problema e' la rete, una
 * chiave scaduta o un simbolo sbagliato.
 */
export class CatenaProvider {
  constructor(private readonly provider: ProviderDatiMercato[]) {}

  get nomi(): string[] {
    return this.provider.filter((p) => p.disponibile()).map((p) => p.nome);
  }

  quotazione(simbolo: string): Promise<Quotazione> {
    return this.prova('quotazione', (p) => p.quotazione!(simbolo), `quotazione di "${simbolo}"`);
  }

  storico(simbolo: string, daIso: string, aIso: string): Promise<SeriePrezzi> {
    return this.prova(
      'storico',
      (p) => p.storico!(simbolo, daIso, aIso),
      `storico di "${simbolo}"`,
    );
  }

  ricerca(query: string): Promise<RisultatoRicerca[]> {
    return this.prova('ricerca', (p) => p.ricerca!(query), `ricerca "${query}"`);
  }

  cambio(da: string, a: string): Promise<number> {
    return this.prova('cambio', (p) => p.cambio!(da, a), `cambio ${da}/${a}`);
  }

  private async prova<R>(
    metodo: Metodo,
    esegui: (p: ProviderDatiMercato) => Promise<R>,
    descrizione: string,
  ): Promise<R> {
    const candidati = this.provider.filter((p) => p.disponibile() && typeof p[metodo] === 'function');
    if (candidati.length === 0) {
      throw new ErroreProvider(
        'catena',
        `nessun provider disponibile per ${metodo} (${descrizione}). ` +
          `Controlla PROVIDER_ORDINE e le API key nel file .env.`,
      );
    }

    const motivi: string[] = [];
    for (const p of candidati) {
      try {
        return await esegui(p);
      } catch (e) {
        motivi.push(`${p.nome}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new ErroreProvider(
      'catena',
      `${descrizione} non recuperabile da nessun provider. ${motivi.join(' | ')}`,
    );
  }
}
