import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import {
  classeSegno,
  daQuandoTesto,
  ETICHETTE_TIPO,
  percento,
  valuta,
} from '../lib/formato.ts';
import {
  Badge,
  Bottone,
  Campo,
  Card,
  Caricamento,
  Errore,
  Vuoto,
  classiInput,
} from '../components/Ui.tsx';
import { Modale } from '../components/Modale.tsx';
import { VariazioneGiorno } from '../components/Grafici.tsx';
import type { StrumentoConPosizione } from '../lib/tipi.ts';

export function Watchlist() {
  const [modaleAperta, setModaleAperta] = useState(false);
  const { dati, caricamento, errore, ricarica } = useApi(() => api.watchlist(), []);

  async function rimuovi(id: number, simbolo: string) {
    if (!window.confirm(`Togliere ${simbolo} dalla watchlist?`)) return;
    try {
      await api.rimuoviWatchlist(id);
      toast.success(`${simbolo} rimosso`);
      ricarica();
    } catch (e) {
      toast.error('Rimozione non riuscita', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function salvaTarget(id: number, valore: string) {
    const numero = valore.trim() === '' ? null : Number(valore);
    if (numero !== null && !Number.isFinite(numero)) {
      toast.error('Prezzo obiettivo non valido.');
      return;
    }
    try {
      await api.modificaWatchlist(id, { prezzo_target: numero });
      ricarica();
    } catch (e) {
      toast.error('Non salvato', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Watchlist</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Titoli che segui senza averli in portafoglio, con il prezzo a cui vorresti entrare.
          </p>
        </div>
        <Bottone onClick={() => setModaleAperta(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Aggiungi strumento
        </Bottone>
      </div>

      <Card>
        {caricamento ? (
          <Caricamento />
        ) : errore ? (
          <Errore messaggio={errore} onRiprova={ricarica} />
        ) : !dati || dati.length === 0 ? (
          <Vuoto
            titolo="Watchlist vuota"
            descrizione="Aggiungi uno strumento già in anagrafica per tenerlo d’occhio."
            azione={<Bottone onClick={() => setModaleAperta(true)}>Aggiungi strumento</Bottone>}
          />
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Strumenti in osservazione</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Strumento</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Tipo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Prezzo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Oggi</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Obiettivo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Distanza</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Nota</th>
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dati.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/strumenti/${v.strumento_id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {v.nome}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {v.simbolo}
                        {v.borsa && ` · ${v.borsa}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge valore={v.tipo} etichetta={ETICHETTE_TIPO[v.tipo]} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-900">
                      {valuta(v.prezzo, v.valuta)}
                      {v.quotazione_aggiornata_il && (
                        <p className="text-xs text-slate-400">
                          {daQuandoTesto(v.quotazione_aggiornata_il)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <VariazioneGiorno percentuale={v.variazione_percentuale} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        step="any"
                        defaultValue={v.prezzo_target ?? ''}
                        onBlur={(e) => {
                          const nuovo = e.target.value.trim() === '' ? null : Number(e.target.value);
                          if (nuovo !== v.prezzo_target) salvaTarget(v.id, e.target.value);
                        }}
                        aria-label={`Prezzo obiettivo per ${v.simbolo}`}
                        placeholder="—"
                        className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-sm tabular-nums whitespace-nowrap focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {v.distanza_target_percentuale === null ? (
                        <span className="text-slate-400">—</span>
                      ) : v.target_raggiunto ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <Target className="h-3 w-3" aria-hidden />
                          Obiettivo raggiunto
                        </span>
                      ) : (
                        <span className={`tabular-nums whitespace-nowrap ${classeSegno(-v.distanza_target_percentuale)}`}>
                          {percento(v.distanza_target_percentuale)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-50 px-3 py-2.5 truncate text-slate-500">{v.nota ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => rimuovi(v.id, v.simbolo)}
                        aria-label={`Togli ${v.simbolo} dalla watchlist`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        La distanza è quanto deve muoversi il prezzo per toccare l’obiettivo. Modifica l’obiettivo
        direttamente in tabella: si salva quando esci dal campo.
      </p>

      <ModaleAggiungiWatchlist
        aperto={modaleAperta}
        onChiudi={() => setModaleAperta(false)}
        onAggiunto={() => {
          setModaleAperta(false);
          ricarica();
        }}
      />
    </div>
  );
}

function ModaleAggiungiWatchlist({
  aperto,
  onChiudi,
  onAggiunto,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onAggiunto: () => void;
}) {
  const [strumenti, setStrumenti] = useState<StrumentoConPosizione[]>([]);
  const [strumentoId, setStrumentoId] = useState('');
  const [target, setTarget] = useState('');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!aperto) return;
    api.strumenti().then(setStrumenti).catch(() => setStrumenti([]));
  }, [aperto]);

  async function salva() {
    if (!strumentoId) {
      toast.error('Scegli uno strumento.');
      return;
    }
    try {
      await api.aggiungiWatchlist({
        strumento_id: Number(strumentoId),
        prezzo_target: target.trim() === '' ? null : Number(target),
        nota: nota.trim() || null,
      });
      toast.success('Aggiunto alla watchlist');
      setStrumentoId('');
      setTarget('');
      setNota('');
      onAggiunto();
    } catch (e) {
      toast.error('Non aggiunto', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Modale
      titolo="Aggiungi alla watchlist"
      descrizione="Puoi scegliere solo strumenti già presenti in anagrafica. Per uno nuovo, crealo prima dal Portafoglio."
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
        <Campo etichetta="Prezzo obiettivo" aiuto="Facoltativo: il prezzo a cui vorresti comprare">
          <input
            type="number"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="95,00"
            className={`${classiInput} w-full`}
          />
        </Campo>
        <Campo etichetta="Nota">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Entrare dopo la trimestrale"
            className={`${classiInput} w-full`}
          />
        </Campo>
        <div className="flex justify-end gap-2 pt-1">
          <Bottone variante="secondario" onClick={onChiudi}>
            Annulla
          </Bottone>
          <Bottone onClick={salva}>Aggiungi</Bottone>
        </div>
      </div>
    </Modale>
  );
}
