import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import { dataOra, ETICHETTE_CONDIZIONE, percento, valuta } from '../lib/formato.ts';
import {
  Bottone,
  Campo,
  Card,
  Caricamento,
  Errore,
  Vuoto,
  classiInput,
} from '../components/Ui.tsx';
import { Modale } from '../components/Modale.tsx';
import type { CondizioneAlert, StrumentoConPosizione } from '../lib/tipi.ts';

export function Alert() {
  const [modaleAperta, setModaleAperta] = useState(false);
  const { dati, caricamento, errore, ricarica } = useApi(() => api.alert(false), []);

  const attivi = dati?.filter((a) => a.attivo === 1) ?? [];
  const scattati = dati?.filter((a) => a.attivo === 0) ?? [];

  async function elimina(id: number, simbolo: string) {
    if (!window.confirm(`Eliminare l’alert su ${simbolo}?`)) return;
    try {
      await api.eliminaAlert(id);
      toast.success('Alert eliminato');
      ricarica();
    } catch (e) {
      toast.error('Eliminazione non riuscita', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function riattiva(id: number) {
    try {
      await api.riattivaAlert(id);
      toast.success('Alert riattivato');
      ricarica();
    } catch (e) {
      toast.error('Non riattivato', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alert di prezzo</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Le soglie vengono verificate a ogni aggiornamento delle quotazioni.
          </p>
        </div>
        <Bottone onClick={() => setModaleAperta(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Nuovo alert
        </Bottone>
      </div>

      {caricamento ? (
        <Caricamento />
      ) : errore ? (
        <Errore messaggio={errore} onRiprova={ricarica} />
      ) : (
        <>
          <Card titolo={`In attesa (${attivi.length})`}>
            {attivi.length === 0 ? (
              <Vuoto
                titolo="Nessun alert attivo"
                descrizione="Imposta una soglia per essere avvisato quando un titolo la supera."
                azione={<Bottone onClick={() => setModaleAperta(true)}>Nuovo alert</Bottone>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {attivi.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/strumenti/${a.strumento_id}`}
                        className="text-sm font-medium text-slate-900 hover:text-blue-700"
                      >
                        {a.nome}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {a.simbolo} · {ETICHETTE_CONDIZIONE[a.condizione]}{' '}
                        {a.condizione.startsWith('VAR_')
                          ? percento(a.valore)
                          : valuta(a.valore, a.valuta)}
                      </p>
                    </div>
                    <p className="text-right text-sm tabular-nums text-slate-600">
                      {a.prezzo_attuale !== null ? (
                        <>
                          <span className="block text-xs text-slate-400">prezzo attuale</span>
                          {valuta(a.prezzo_attuale, a.valuta)}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">prezzo non disponibile</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => elimina(a.id, a.simbolo)}
                      aria-label={`Elimina alert su ${a.simbolo}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {scattati.length > 0 && (
            <Card titolo={`Già scattati (${scattati.length})`}>
              <ul className="divide-y divide-slate-100">
                {scattati.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <BellRing className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/strumenti/${a.strumento_id}`}
                        className="text-sm font-medium text-slate-900 hover:text-blue-700"
                      >
                        {a.nome}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {ETICHETTE_CONDIZIONE[a.condizione]}{' '}
                        {a.condizione.startsWith('VAR_') ? percento(a.valore) : valuta(a.valore, a.valuta)}
                        {' · scattato il '}
                        {dataOra(a.scattato_il)}
                        {a.prezzo_scatto !== null && ` a ${valuta(a.prezzo_scatto, a.valuta)}`}
                      </p>
                    </div>
                    <Bottone variante="secondario" onClick={() => riattiva(a.id)}>
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Riattiva
                    </Bottone>
                    <button
                      type="button"
                      onClick={() => elimina(a.id, a.simbolo)}
                      aria-label={`Elimina alert su ${a.simbolo}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <ModaleNuovoAlert
        aperto={modaleAperta}
        onChiudi={() => setModaleAperta(false)}
        onCreato={() => {
          setModaleAperta(false);
          ricarica();
        }}
      />
    </div>
  );
}

function ModaleNuovoAlert({
  aperto,
  onChiudi,
  onCreato,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onCreato: () => void;
}) {
  const [strumenti, setStrumenti] = useState<StrumentoConPosizione[]>([]);
  const [strumentoId, setStrumentoId] = useState('');
  const [condizione, setCondizione] = useState<CondizioneAlert>('SOTTO');
  const [valore, setValore] = useState('');

  useEffect(() => {
    if (!aperto) return;
    api.strumenti().then(setStrumenti).catch(() => setStrumenti([]));
  }, [aperto]);

  const scelto = strumenti.find((s) => String(s.id) === strumentoId);
  const inPercentuale = condizione.startsWith('VAR_');

  async function salva() {
    if (!strumentoId) {
      toast.error('Scegli uno strumento.');
      return;
    }
    if (!Number.isFinite(Number(valore)) || valore.trim() === '') {
      toast.error('Inserisci la soglia.');
      return;
    }
    try {
      await api.creaAlert({
        strumento_id: Number(strumentoId),
        condizione,
        valore: Number(valore),
      });
      toast.success('Alert creato');
      setStrumentoId('');
      setValore('');
      onCreato();
    } catch (e) {
      toast.error('Non creato', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Modale
      titolo="Nuovo alert"
      descrizione="La condizione viene valutata quando aggiorni le quotazioni; una volta scattata l’alert resta in elenco come promemoria."
      aperto={aperto}
      onChiudi={onChiudi}
    >
      <div className="space-y-3">
        <Campo etichetta="Strumento" obbligatorio>
          <select
            value={strumentoId}
            onChange={(e) => setStrumentoId(e.target.value)}
            className={`${classiInput} w-full`}
          >
            <option value="">Seleziona…</option>
            {strumenti.map((s) => (
              <option key={s.id} value={s.id}>
                {s.simbolo} — {s.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Condizione" obbligatorio>
          <select
            value={condizione}
            onChange={(e) => setCondizione(e.target.value as CondizioneAlert)}
            className={`${classiInput} w-full`}
          >
            {Object.entries(ETICHETTE_CONDIZIONE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          etichetta={inPercentuale ? 'Soglia in percentuale' : 'Soglia di prezzo'}
          obbligatorio
          aiuto={
            inPercentuale
              ? 'Variazione giornaliera, es. -5 per un calo del 5 %'
              : scelto
                ? `Prezzo in ${scelto.valuta}` +
                  (scelto.quotazione ? ` · attuale ${valuta(scelto.quotazione.prezzo, scelto.valuta)}` : '')
                : undefined
          }
        >
          <input
            type="number"
            step="any"
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            placeholder={inPercentuale ? '-5' : '95,00'}
            className={`${classiInput} w-full`}
          />
        </Campo>
        <div className="flex justify-end gap-2 pt-1">
          <Bottone variante="secondario" onClick={onChiudi}>
            Annulla
          </Bottone>
          <Bottone onClick={salva}>Crea alert</Bottone>
        </div>
      </div>
    </Modale>
  );
}
