import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, urlExport } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import {
  data as formattaData,
  ETICHETTE_TRANSAZIONE,
  quantita as formattaQuantita,
  valuta,
} from '../lib/formato.ts';
import { Badge, Bottone, Card, Caricamento, Errore, Vuoto, classiInput } from '../components/Ui.tsx';
import { ModaleTransazione } from '../components/ModaleTransazione.tsx';
import type { Transazione } from '../lib/tipi.ts';

export function Transazioni() {
  const [tipo, setTipo] = useState('');
  const [da, setDa] = useState('');
  const [a, setA] = useState('');
  const [modaleAperta, setModaleAperta] = useState(false);
  const [inModifica, setInModifica] = useState<Transazione | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);

  const { dati, caricamento, errore, ricarica } = useApi(
    () => api.transazioni({ tipo: tipo || undefined, da: da || undefined, a: a || undefined }),
    [tipo, da, a],
  );

  async function elimina(t: Transazione) {
    const conferma = window.confirm(
      `Eliminare ${ETICHETTE_TRANSAZIONE[t.tipo].toLowerCase()} di ${t.simbolo} del ${formattaData(t.data)}?\n\n` +
        'Le posizioni vengono ricalcolate dalle transazioni, quindi quantità, prezzo medio e utile cambieranno.',
    );
    if (!conferma) return;
    try {
      await api.eliminaTransazione(t.id);
      toast.success('Transazione eliminata');
      ricarica();
    } catch (e) {
      toast.error('Eliminazione non riuscita', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function importa(file: File) {
    try {
      const esito = await api.importaCsv(await file.text());
      const dettagli = [
        esito.strumentiCreati.length > 0
          ? `${esito.strumentiCreati.length} nuovi strumenti: ${esito.strumentiCreati.join(', ')}`
          : null,
        esito.scartate.length > 0
          ? `${esito.scartate.length} righe scartate (riga ${esito.scartate.map((s) => s.riga).join(', ')})`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

      if (esito.scartate.length > 0) {
        toast.warning(`${esito.importate} transazioni importate`, {
          description: dettagli || esito.scartate[0]?.motivo,
          duration: 10000,
        });
      } else {
        toast.success(`${esito.importate} transazioni importate`, { description: dettagli });
      }
      ricarica();
    } catch (e) {
      toast.error('Import non riuscito', {
        description: e instanceof Error ? e.message : String(e),
        duration: 10000,
      });
    } finally {
      if (inputFile.current) inputFile.current.value = '';
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Transazioni</h1>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputFile}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importa(file);
            }}
          />
          <Bottone variante="secondario" onClick={() => inputFile.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Importa CSV
          </Bottone>
          <a
            href={urlExport.transazioni}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Esporta CSV
          </a>
          <Bottone
            onClick={() => {
              setInModifica(null);
              setModaleAperta(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nuova transazione
          </Bottone>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${classiInput} w-auto`}>
            <option value="">Tutti</option>
            {Object.entries(ETICHETTE_TRANSAZIONE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Dal</span>
          <input type="date" value={da} onChange={(e) => setDa(e.target.value)} className={`${classiInput} w-auto`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Al</span>
          <input type="date" value={a} onChange={(e) => setA(e.target.value)} className={`${classiInput} w-auto`} />
        </label>
        {(tipo || da || a) && (
          <Bottone
            variante="fantasma"
            onClick={() => {
              setTipo('');
              setDa('');
              setA('');
            }}
          >
            Azzera filtri
          </Bottone>
        )}
      </div>

      <Card>
        {caricamento ? (
          <Caricamento />
        ) : errore ? (
          <Errore messaggio={errore} onRiprova={ricarica} />
        ) : !dati || dati.length === 0 ? (
          <Vuoto
            titolo="Nessuna transazione"
            descrizione="Registra un acquisto o importa il tracciato CSV del tuo intermediario. Le colonne riconosciute sono descritte nel README."
          />
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Elenco delle transazioni registrate</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Data</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Strumento</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Movimento</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Quantità</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Prezzo</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Oneri</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">Totale</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-slate-600">Note</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium text-slate-600">
                    <span className="sr-only">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dati.map((t) => {
                  const oneri = t.commissioni + t.tasse;
                  const lordo = t.quantita > 0 ? t.quantita * t.prezzo : t.prezzo;
                  // Un acquisto costa di più con gli oneri; una vendita incassa di meno.
                  const totale = t.tipo === 'ACQUISTO' ? lordo + oneri : lordo - oneri;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formattaData(t.data)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/strumenti/${t.strumento_id}`}
                          className="font-medium text-slate-900 hover:text-blue-700"
                        >
                          {t.simbolo}
                        </Link>
                        <p className="max-w-50 truncate text-xs text-slate-500">{t.strumento_nome}</p>
                      </td>
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
                        {oneri > 0 ? valuta(oneri, t.valuta) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums whitespace-nowrap text-slate-900">
                        {t.tipo === 'SPLIT' ? '—' : valuta(totale, t.valuta)}
                      </td>
                      <td className="max-w-40 px-3 py-2.5 truncate text-slate-500">{t.note ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setInModifica(t);
                              setModaleAperta(true);
                            }}
                            aria-label={`Modifica transazione del ${formattaData(t.data)}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => elimina(t)}
                            aria-label={`Elimina transazione del ${formattaData(t.data)}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModaleTransazione
        aperto={modaleAperta}
        transazione={inModifica}
        onChiudi={() => {
          setModaleAperta(false);
          setInModifica(null);
        }}
        onSalvato={() => {
          setModaleAperta(false);
          setInModifica(null);
          ricarica();
        }}
      />
    </div>
  );
}
