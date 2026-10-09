import { useEffect, useState } from 'react';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import { Avviso, Bottone, Campo, Card, Caricamento, Errore, classiInput } from '../components/Ui.tsx';

const VALUTE = ['EUR', 'USD', 'GBP', 'CHF'];

export function Impostazioni() {
  const { dati, caricamento, errore, ricarica } = useApi(() => api.impostazioni(), []);
  const [valutaBase, setValutaBase] = useState('');
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  useEffect(() => {
    if (dati) setValutaBase(dati.impostazioni.valuta_base ?? 'EUR');
  }, [dati]);

  async function salva() {
    setSalvataggioInCorso(true);
    try {
      await api.salvaImpostazioni({ valuta_base: valutaBase.toUpperCase() });
      toast.success('Impostazioni salvate', {
        description: 'I valori vengono riconvertiti al prossimo calcolo del portafoglio.',
      });
      ricarica();
    } catch (e) {
      toast.error('Non salvate', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSalvataggioInCorso(false);
    }
  }

  if (caricamento) return <Caricamento />;
  if (errore) return <Errore messaggio={errore} onRiprova={ricarica} />;
  if (!dati) return null;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Impostazioni</h1>

      <Card titolo="Valuta del portafoglio">
        <div className="space-y-3">
          <Campo
            etichetta="Valuta base"
            aiuto="Tutti i totali e i grafici sono espressi in questa valuta; i titoli esteri vengono convertiti al cambio corrente."
          >
            <select
              value={valutaBase}
              onChange={(e) => setValutaBase(e.target.value)}
              className={`${classiInput} w-full sm:w-48`}
            >
              {VALUTE.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Bottone onClick={salva} disabilitato={salvataggioInCorso}>
            <Save className="h-4 w-4" aria-hidden />
            Salva
          </Bottone>
        </div>
      </Card>

      <Card titolo="Fonti dei dati">
        <div className="space-y-4 text-sm">
          <Riga
            etichetta="Quotazioni e storico"
            valore={dati.provider.quotazioni.join(' → ') || 'nessuna fonte attiva'}
            nota="Provano in quest’ordine: il primo che risponde vince."
          />
          <Riga
            etichetta="Tassi di cambio"
            valore={dati.provider.cambi.join(' → ') || 'nessuna fonte attiva'}
            nota="frankfurter usa i cambi ufficiali BCE, senza chiave e senza limiti."
          />
          <div className="flex items-start gap-2">
            {dati.provider.twelvedataConfigurato ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            )}
            <div>
              <p className="font-medium text-slate-700">
                Twelve Data {dati.provider.twelvedataConfigurato ? 'configurato' : 'non configurato'}
              </p>
              <p className="text-slate-500">
                {dati.provider.twelvedataConfigurato
                  ? 'Attivo come riserva quando Yahoo Finance non risponde.'
                  : 'Senza chiave API resta attivo solo Yahoo Finance, che è un’interfaccia non ufficiale: se cambia, le quotazioni si fermano. Registra una chiave gratuita su twelvedata.com e mettila in TWELVEDATA_API_KEY nel file .env.'}
              </p>
            </div>
          </div>
          <Riga
            etichetta="Validità della cache"
            valore={`${Math.round(dati.quotazioneTtlSecondi / 60)} minuti`}
            nota="Entro questo intervallo le quotazioni vengono riusate senza richiamare il provider."
          />
          <Riga
            etichetta="Aggiornamento automatico"
            valore={dati.cronAggiornamento ?? 'disattivato'}
            nota={
              dati.cronAggiornamento
                ? 'Espressione cron del server. Vale solo mentre il processo è in esecuzione.'
                : 'Imposta CRON_AGGIORNAMENTO nel file .env per attivarlo.'
            }
          />
        </div>
      </Card>

      <Card titolo="Archivio dati">
        <Riga
          etichetta="File del database"
          valore={dati.percorsoDb}
          nota="SQLite: per un backup è sufficiente copiare questo file (e i suoi -wal/-shm se presenti) con l’app spenta."
        />
      </Card>

      <Avviso>
        <p className="font-medium">Le quotazioni sono indicative</p>
        <p className="mt-0.5">
          I prezzi arrivano da fonti pubbliche gratuite, possono essere differiti o incompleti e non
          sostituiscono la rendicontazione del tuo intermediario. Usa questa app per monitorare, non
          per adempimenti fiscali.
        </p>
      </Avviso>
    </div>
  );
}

function Riga({
  etichetta,
  valore,
  nota,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
}) {
  return (
    <div>
      <p className="font-medium text-slate-700">{etichetta}</p>
      <p className="font-mono text-xs break-all text-slate-900">{valore}</p>
      {nota && <p className="mt-0.5 text-slate-500">{nota}</p>}
    </div>
  );
}
