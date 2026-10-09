import { ErroreProvider } from './tipi.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15_000;

/**
 * GET JSON con timeout e messaggi d'errore leggibili.
 * Yahoo rifiuta le richieste senza User-Agent da browser, da qui l'header fisso.
 */
export async function getJson<T>(
  provider: string,
  url: string,
  headerExtra: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const risposta = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headerExtra },
    });
    if (!risposta.ok) {
      throw new ErroreProvider(
        provider,
        `HTTP ${risposta.status} ${risposta.statusText} su ${nascondiChiavi(url)}`,
      );
    }
    return (await risposta.json()) as T;
  } catch (e) {
    if (e instanceof ErroreProvider) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const causa = msg.includes('abort') ? `timeout dopo ${TIMEOUT_MS} ms` : msg;
    throw new ErroreProvider(provider, `${causa} su ${nascondiChiavi(url)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Non far finire le API key nei log. */
function nascondiChiavi(url: string): string {
  return url.replace(/([?&](apikey|api_key|token)=)[^&]+/gi, '$1***');
}

/** Esegue i task a gruppi, per non martellare il provider con N richieste insieme. */
export async function inLotti<T, R>(
  elementi: T[],
  dimensioneLotto: number,
  fn: (e: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const risultati: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < elementi.length; i += dimensioneLotto) {
    const lotto = elementi.slice(i, i + dimensioneLotto);
    risultati.push(...(await Promise.allSettled(lotto.map(fn))));
  }
  return risultati;
}
