import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import {
  classeSegno,
  daQuandoTesto,
  data as formattaData,
  ETICHETTE_TIPO,
  ETICHETTE_TRANSAZIONE,
  percento,
  quantita as formattaQuantita,
  valuta,
} from '../lib/formato.ts';
import { Badge, Bottone, Card, Caricamento, Errore, Vuoto } from '../components/Ui.tsx';
import { GraficoPrezzo } from '../components/Grafici.tsx';
import { ModaleTransazione } from '../components/ModaleTransazione.tsx';

const PERIODI = [
  { giorni: 30, etichetta: '1 mese' },
  { giorni: 180, etichetta: '6 mesi' },
  { giorni: 365, etichetta: '1 anno' },
  { giorni: 1825, etichetta: '5 anni' },
];

export function DettaglioStrumento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idNumerico = Number(id);

  const [giorni, setGiorni] = useState(365);
  const [modaleAperta, setModaleAperta] = useState(false);

  // Dipendenze primitive: passare oggetti qui innescherebbe fetch a ciclo.
  const strumento = useApi(() => api.strumento(idNumerico), [idNumerico]);
  const storico = useApi(() => api.storico(idNumerico, giorni), [idNumerico, giorni]);

  if (strumento.caricamento) return <Caricamento />;
  if (strumento.errore) return <Errore messaggio={strumento.errore} onRiprova={strumento.ricarica} />;
  if (!strumento.dati) return null;

  const s = strumento.dati;
  const pos = s.posizione;
  const q = s.quotazione;

  const valoreCorrente = q ? pos.quantita * q.prezzo : null;
  const plLatente = valoreCorrente !== null ? valoreCorrente - pos.costoTotale : null;
  const plPercentuale =
    plLatente !== null && pos.costoTotale > 0 ? (plLatente / pos.costoTotale) * 100 : null;

  async function aggiornaPrezzo() {
    try {
      await api.aggiornaQuotazione(idNumerico);
      toast.success('Quotazione aggiornata');
      strumento.ricarica();
    } catch (e) {
      toast.error('Quotazione non disponibile', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function aggiungiAWatchlist() {
    try {
      await api.aggiungiWatchlist({ strumento_id: idNumerico });
      toast.success(`${s.simbolo} aggiunto alla watchlist`);
    } catch (e) {
      toast.error('Non aggiunto', { description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function elimina() {
    const conferma = window.confirm(
      `Eliminare ${s.simbolo} (${s.nome})?\n\n` +
        `Verranno eliminate anche le sue ${pos.numeroOperazioni} transazioni, lo storico prezzi ` +
        'e le eventuali voci di watchlist e alert. L’operazione non è reversibile.',
    );
    if (!conferma) return;
    try {
      await api.eliminaStrumento(idNumerico);
      toast.success(`${s.simbolo} eliminato`);
      navigate('/portafoglio');
    } catch (e) {
      toast.error('Eliminazione non riuscita', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/portafoglio"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Torna al portafoglio
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{s.nome}</h1>
            <Badge valore={s.tipo} etichetta={ETICHETTE_TIPO[s.tipo]} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {s.simbolo}
            {s.isin && ` · ISIN ${s.isin}`}
            {s.borsa && ` · ${s.borsa}`}
            {` · ${s.valuta}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bottone variante="secondario" onClick={aggiornaPrezzo}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Aggiorna prezzo
          </Bottone>
          <Bottone variante="secondario" onClick={aggiungiAWatchlist}>
            <Eye className="h-4 w-4" aria-hidden />
            Watchlist
          </Bottone>
          <Bottone onClick={() => setModaleAperta(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Transazione
          </Bottone>
        </div>
      </div>

      {/* Prezzo corrente */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Ultimo prezzo
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums whitespace-nowrap text-slate-900">
              {valuta(q?.prezzo, s.valuta)}
            </p>
            {q && (
              <p className={`mt-0.5 text-sm font-medium tabular-nums whitespace-nowrap ${classeSegno(q.variazione_assoluta)}`}>
                {q.variazione_assoluta !== null && (
                  <>
                    {q.variazione_assoluta > 0 ? '+' : ''}
                    {valuta(q.variazione_assoluta, s.valuta)}{' '}
                  </>
                )}
                {percento(q.variazione_percentuale)} oggi
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {q
              ? `Fonte ${q.fonte} · ${daQuandoTesto(q.aggiornato_il)}`
              : 'Nessuna quotazione in cache: premi «Aggiorna prezzo».'}
          </p>
        </div>
      </Card>

      {/* Posizione */}
      {pos.quantita > 0 || pos.numeroOperazioni > 0 ? (
        <Card titolo="La tua posizione">
          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Voce etichetta="Quantità" valore={formattaQuantita(pos.quantita)} />
            <Voce etichetta="Prezzo medio di carico" valore={valuta(pos.prezzoMedio, s.valuta)} />
            <Voce etichetta="Capitale investito" valore={valuta(pos.costoTotale, s.valuta)} />
            <Voce
              etichetta="Valore attuale"
              valore={valoreCorrente !== null ? valuta(valoreCorrente, s.valuta) : '—'}
            />
            <Voce
              etichetta="Utile/perdita latente"
              valore={plLatente !== null ? valuta(plLatente, s.valuta) : '—'}
              nota={plPercentuale !== null ? percento(plPercentuale) : undefined}
              classe={classeSegno(plLatente)}
            />
            <Voce
              etichetta="Utile realizzato"
              valore={valuta(pos.plRealizzato, s.valuta)}
              classe={classeSegno(pos.plRealizzato)}
            />
            <Voce etichetta="Dividendi incassati" valore={valuta(pos.dividendiIncassati, s.valuta)} />
            <Voce etichetta="Commissioni e imposte" valore={valuta(pos.oneriTotali, s.valuta)} />
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            {pos.numeroOperazioni} operazioni
            {pos.primaOperazione && ` dal ${formattaData(pos.primaOperazione)}`}
            {pos.ultimaOperazione && ` al ${formattaData(pos.ultimaOperazione)}`}
            {pos.quantitaVenduta > 0 && ` · ${formattaQuantita(pos.quantitaVenduta)} pezzi venduti`}
          </p>
        </Card>
      ) : (
        <Card>
          <Vuoto
            titolo="Nessuna operazione su questo strumento"
            descrizione="È solo in osservazione. Registra una transazione per farlo entrare in portafoglio."
            azione={<Bottone onClick={() => setModaleAperta(true)}>Registra transazione</Bottone>}
          />
        </Card>
      )}

      {/* Grafico prezzi */}
      <Card
        titolo="Andamento del prezzo"
        azione={
          <div className="flex gap-1" role="group" aria-label="Periodo">
            {PERIODI.map((p) => (
              <button
                key={p.giorni}
                type="button"
                onClick={() => setGiorni(p.giorni)}
                aria-pressed={giorni === p.giorni}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  giorni === p.giorni ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
        }
      >
        {storico.caricamento ? (
          <Caricamento />
        ) : storico.errore ? (
          <Errore messaggio={storico.errore} onRiprova={storico.ricarica} />
        ) : storico.dati && storico.dati.punti.length > 1 ? (
          <GraficoPrezzo punti={storico.dati.punti} divisa={s.valuta} />
        ) : (
          <Vuoto
            titolo="Storico non disponibile"
            descrizione="Il provider non ha restituito prezzi per questo periodo e la cache locale è vuota."
          />
        )}
      </Card>

      {/* Transazioni */}
      <Card titolo={`Transazioni (${s.transazioni.length})`}>
        {s.transazioni.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nessuna transazione registrata.</p>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Transazioni su {s.simbolo}</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Data</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Movimento</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Quantità</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Prezzo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Oneri</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.transazioni.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{formattaData(t.data)}</td>
                    <td className="px-3 py-2.5">
                      <Badge valore={t.tipo} etichetta={ETICHETTE_TRANSAZIONE[t.tipo]} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {t.tipo === 'SPLIT' ? `${formattaQuantita(t.quantita)}:1` : formattaQuantita(t.quantita)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {t.tipo === 'SPLIT' ? '—' : valuta(t.prezzo, t.valuta, t.prezzo < 1 ? 4 : 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-500">
                      {t.commissioni + t.tasse > 0 ? valuta(t.commissioni + t.tasse, t.valuta) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{t.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Zona pericolosa */}
      <Card titolo="Elimina strumento">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-slate-600">
            Rimuove lo strumento con tutte le sue transazioni, lo storico prezzi, gli alert e la voce
            di watchlist. Se vuoi solo chiudere la posizione, registra invece una vendita.
          </p>
          <Bottone variante="pericolo" onClick={elimina}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Elimina
          </Bottone>
        </div>
      </Card>

      <ModaleTransazione
        aperto={modaleAperta}
        strumentoPrecompilato={idNumerico}
        onChiudi={() => setModaleAperta(false)}
        onSalvato={() => {
          setModaleAperta(false);
          strumento.ricarica();
        }}
      />

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        Puoi impostare una soglia di prezzo per questo titolo dalla pagina Alert.
      </p>
    </div>
  );
}

function Voce({
  etichetta,
  valore,
  nota,
  classe = 'text-slate-900',
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  classe?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{etichetta}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums whitespace-nowrap ${classe}`}>
        {valore}
        {nota && <span className="ml-2 text-sm font-medium">{nota}</span>}
      </dd>
    </div>
  );
}
