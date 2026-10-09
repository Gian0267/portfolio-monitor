import { config } from '../config.js';
import { CatenaProvider } from './catena.js';
import { FrankfurterProvider } from './frankfurter.provider.js';
import { TwelveDataProvider } from './twelvedata.provider.js';
import { YahooProvider } from './yahoo.provider.js';
import type { ProviderDatiMercato } from './tipi.js';

function costruisci(nome: string): ProviderDatiMercato | null {
  switch (nome) {
    case 'yahoo':
      return new YahooProvider();
    case 'twelvedata':
      return new TwelveDataProvider(config.twelveDataApiKey);
    case 'frankfurter':
      return new FrankfurterProvider();
    default:
      console.warn(`[provider] nome sconosciuto ignorato: "${nome}"`);
      return null;
  }
}

function catenaDa(ordine: string[]): CatenaProvider {
  const provider = ordine
    .map(costruisci)
    .filter((p): p is ProviderDatiMercato => p !== null);
  return new CatenaProvider(provider);
}

/** Catena per quotazioni, storico e ricerca strumenti. */
export const datiMercato = catenaDa(config.providerOrdine);

/**
 * Catena dedicata ai cambi: la BCE (frankfurter) e' in testa perche' e'
 * la fonte piu' affidabile e non ha limiti di chiamate.
 */
export const datiCambio = catenaDa(config.fxProviderOrdine);

export { CatenaProvider } from './catena.js';
export * from './tipi.js';
