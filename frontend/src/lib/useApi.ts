import { useCallback, useEffect, useState } from 'react';

interface StatoApi<T> {
  dati: T | null;
  caricamento: boolean;
  errore: string | null;
}

/**
 * Carica dati da una funzione asincrona e ne espone stato e `ricarica`.
 *
 * `deps` deve contenere SOLO valori primitivi: passare oggetti creati a ogni
 * render innesca un ciclo infinito di fetch.
 */
export function useApi<T>(
  carica: () => Promise<T>,
  deps: ReadonlyArray<string | number | boolean | null | undefined> = [],
): StatoApi<T> & { ricarica: () => void } {
  const [stato, setStato] = useState<StatoApi<T>>({
    dati: null,
    caricamento: true,
    errore: null,
  });
  const [contatore, setContatore] = useState(0);

  const ricarica = useCallback(() => setContatore((n) => n + 1), []);

  useEffect(() => {
    let annullato = false;
    setStato((s) => ({ ...s, caricamento: true, errore: null }));

    carica()
      .then((dati) => {
        if (!annullato) setStato({ dati, caricamento: false, errore: null });
      })
      .catch((e: unknown) => {
        if (!annullato) {
          setStato({
            dati: null,
            caricamento: false,
            errore: e instanceof Error ? e.message : String(e),
          });
        }
      });

    return () => {
      annullato = true;
    };
    // `carica` e' volutamente fuori: e' una closure nuova a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, contatore]);

  return { ...stato, ricarica };
}
