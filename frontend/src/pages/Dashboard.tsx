import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CalendarClock,
  Coins,
  Percent,
  PieChart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import {
  classeSegno,
  data as formattaData,
  ETICHETTE_TIPO,
  percento,
  valuta,
} from '../lib/formato.ts';
import { Avviso, Card, CardKpi, Caricamento, Errore, Vuoto } from '../components/Ui.tsx';
import { BarreAllocazione, GraficoAndamento, GraficoDividendi } from '../components/Grafici.tsx';
import type { RigaPortafoglio, VoceAllocazione } from '../lib/tipi.ts';

type Dimensione = 'tipo' | 'valuta' | 'paese' | 'settore';

const DIMENSIONI: Array<{ chiave: Dimensione; etichetta: string }> = [
  { chiave: 'tipo', etichetta: 'Tipologia' },
  { chiave: 'valuta', etichetta: 'Valuta' },
  { chiave: 'paese', etichetta: 'Area' },
  { chiave: 'settore', etichetta: 'Settore' },
];

const PERIODI = [
  { giorni: 90, etichetta: '3 mesi' },
  { giorni: 180, etichetta: '6 mesi' },
  { giorni: 365, etichetta: '1 anno' },
  { giorni: 1095, etichetta: '3 anni' },
];

export function Dashboard() {
  const [dimensione, setDimensione] = useState<Dimensione>('tipo');
  const [giorni, setGiorni] = useState(365);

  const portafoglio = useApi(() => api.portafoglio(), []);
  const andamento = useApi(() => api.andamento(giorni), [giorni]);
  const dividendi = useApi(() => api.dividendi(), []);

  if (portafoglio.caricamento) return <Caricamento testo="Calcolo del portafoglio…" />;
  if (portafoglio.errore) {
    return <Errore messaggio={portafoglio.errore} onRiprova={portafoglio.ricarica} />;
  }
  if (!portafoglio.dati) return null;

  const { totali, righe, migliori, peggiori, avvisi } = portafoglio.dati;
  const divisa = totali.valutaBase;

  if (righe.length === 0) {
    return (
      <Card>
        <Vuoto
          titolo="Nessuna posizione in portafoglio"
          descrizione="Aggiungi uno strumento e la prima transazione: da quel momento la dashboard si popola da sola."
          azione={
            <Link
              to="/portafoglio"
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Vai al portafoglio
            </Link>
          }
        />
      </Card>
    );
  }

  const allocazioni: Record<Dimensione, VoceAllocazione[]> = {
    tipo: portafoglio.dati.allocazionePerTipo.map((v) => ({
      ...v,
      etichetta: ETICHETTE_TIPO[v.etichetta] ?? v.etichetta,
    })),
    valuta: portafoglio.dati.allocazionePerValuta,
    paese: portafoglio.dati.allocazionePerPaese,
    settore: portafoglio.dati.allocazionePerSettore,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-500">
          Aggiornato al {formattaData(portafoglio.dati.calcolatoIl.slice(0, 10))} ·{' '}
          {totali.numeroPosizioni} posizioni aperte su {totali.numeroStrumenti} strumenti
        </p>
      </div>

      {avvisi.length > 0 && (
        <Avviso>
          <p className="font-medium">
            {avvisi.length === 1 ? 'Un dato non è aggiornato' : `${avvisi.length} dati non sono aggiornati`}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {avvisi.slice(0, 5).map((a) => (
              <li key={a}>{a}</li>
            ))}
            {avvisi.length > 5 && <li>…e altri {avvisi.length - 5}.</li>}
          </ul>
          <p className="mt-1.5 text-xs">
            Premi «Aggiorna prezzi» in alto a destra per scaricare le quotazioni correnti.
          </p>
        </Avviso>
      )}

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardKpi
          etichetta="Valore di mercato"
          valore={valuta(totali.valoreMercato, divisa)}
          icona={<Wallet className="h-4 w-4" />}
          nota={`Capitale investito ${valuta(totali.costo, divisa)}`}
        />
        <CardKpi
          etichetta="Utile/perdita latente"
          valore={valuta(totali.plNonRealizzato, divisa)}
          variazionePercentuale={totali.plNonRealizzatoPercentuale}
          icona={totali.plNonRealizzato >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          nota="Sulle sole posizioni ancora aperte"
        />
        <CardKpi
          etichetta="Variazione di giornata"
          valore={valuta(totali.plGiorno, divisa)}
          variazionePercentuale={totali.plGiornoPercentuale}
          icona={<Percent className="h-4 w-4" />}
          nota="Rispetto alla chiusura precedente"
        />
        <CardKpi
          etichetta="Risultato complessivo"
          valore={valuta(totali.plTotale, divisa)}
          variazionePercentuale={totali.plTotalePercentuale}
          icona={<Coins className="h-4 w-4" />}
          nota="Latente + realizzato + dividendi"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CardKpi
          etichetta="Utile realizzato"
          valore={valuta(totali.plRealizzato, divisa)}
          icona={<Banknote className="h-4 w-4" />}
          nota="Incassato con le vendite"
        />
        <CardKpi
          etichetta="Dividendi incassati"
          valore={valuta(totali.dividendi, divisa)}
          icona={<CalendarClock className="h-4 w-4" />}
          nota="Al netto di tasse e oneri"
        />
        <CardKpi
          etichetta="Costi sostenuti"
          valore={valuta(totali.oneriTotali, divisa)}
          icona={<PieChart className="h-4 w-4" />}
          nota="Commissioni e imposte"
        />
      </div>

      {/* Andamento */}
      <Card
        titolo="Andamento del portafoglio"
        azione={
          <div className="flex gap-1" role="group" aria-label="Periodo">
            {PERIODI.map((p) => (
              <button
                key={p.giorni}
                type="button"
                onClick={() => setGiorni(p.giorni)}
                aria-pressed={giorni === p.giorni}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  giorni === p.giorni
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
        }
      >
        {andamento.caricamento ? (
          <Caricamento />
        ) : andamento.errore ? (
          <Errore messaggio={andamento.errore} onRiprova={andamento.ricarica} />
        ) : !andamento.dati || andamento.dati.length === 0 ? (
          <Vuoto
            titolo="Serie storica non disponibile"
            descrizione="Il grafico si costruisce dai prezzi storici in cache. Scaricali una volta con «npm run aggiorna-quotazioni -- --storico», poi comparirà qui."
          />
        ) : (
          <GraficoAndamento punti={andamento.dati} divisa={divisa} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Allocazione */}
        <Card
          titolo="Composizione"
          azione={
            <div className="flex flex-wrap gap-1" role="group" aria-label="Dimensione di analisi">
              {DIMENSIONI.map((d) => (
                <button
                  key={d.chiave}
                  type="button"
                  onClick={() => setDimensione(d.chiave)}
                  aria-pressed={dimensione === d.chiave}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    dimensione === d.chiave
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {d.etichetta}
                </button>
              ))}
            </div>
          }
        >
          <BarreAllocazione voci={allocazioni[dimensione]} divisa={divisa} />
        </Card>

        {/* Dividendi per anno */}
        <Card titolo="Dividendi per anno">
          {dividendi.caricamento ? (
            <Caricamento />
          ) : dividendi.dati && dividendi.dati.perAnno.length > 0 ? (
            <GraficoDividendi
              dati={[...dividendi.dati.perAnno].reverse()}
              divisa={dividendi.dati.valutaBase}
            />
          ) : (
            <Vuoto
              titolo="Nessun dividendo registrato"
              descrizione="Inserisci una transazione di tipo «Dividendo» per vedere qui il flusso incassato."
            />
          )}
        </Card>
      </div>

      {/* Migliori e peggiori */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card titolo="Migliori posizioni">
          <ClassificaPosizioni righe={migliori} divisa={divisa} />
        </Card>
        <Card titolo="Peggiori posizioni">
          <ClassificaPosizioni righe={peggiori} divisa={divisa} />
        </Card>
      </div>
    </div>
  );
}

function ClassificaPosizioni({ righe, divisa }: { righe: RigaPortafoglio[]; divisa: string }) {
  if (righe.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Serve almeno una posizione con quotazione aggiornata.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {righe.map((r) => (
        <li key={r.strumento.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <Link
              to={`/strumenti/${r.strumento.id}`}
              className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700"
            >
              {r.strumento.nome}
            </Link>
            <p className="truncate text-xs text-slate-500">
              {r.strumento.simbolo} · {valuta(r.valoreMercato, divisa, 0)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-sm font-semibold tabular-nums ${classeSegno(r.plNonRealizzato)}`}>
              {percento(r.plNonRealizzatoPercentuale)}
            </p>
            <p className={`text-xs tabular-nums ${classeSegno(r.plNonRealizzato)}`}>
              {valuta(r.plNonRealizzato, divisa, 0)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
