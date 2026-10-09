import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { ETICHETTE_TRANSAZIONE } from '../lib/formato.ts';
import { Bottone, Campo, classiInput } from './Ui.tsx';
import { Modale } from './Modale.tsx';
import type { StrumentoConPosizione, TipoTransazione, Transazione } from '../lib/tipi.ts';

function oggi(): string {
  return new Date().toISOString().slice(0, 10);
}

const VUOTO = {
  strumento_id: '',
  tipo: 'ACQUISTO' as TipoTransazione,
  data: oggi(),
  quantita: '',
  prezzo: '',
  commissioni: '',
  tasse: '',
  note: '',
};

/** Testo d'aiuto specifico per tipo: ogni movimento usa i campi in modo diverso. */
const AIUTO_PER_TIPO: Record<TipoTransazione, string> = {
  ACQUISTO: 'Quantità e prezzo unitario pagato. Le commissioni entrano nel prezzo medio di carico.',
  VENDITA: 'Quantità venduta e prezzo incassato. L’utile si calcola sul prezzo medio di carico.',
  DIVIDENDO:
    'Dividendo per azione nel campo prezzo, con la quantità che lo ha percepito. Per un importo unico, lascia quantità a 0 e mettilo in prezzo.',
  COMMISSIONE: 'Costo non legato a un’operazione (canone, bollo): inseriscilo nel campo commissioni.',
  SPLIT:
    'Rapporto nel campo quantità: 4 per uno split 4:1, 0.1 per un raggruppamento 1:10. Il prezzo non serve.',
};

export function ModaleTransazione({
  aperto,
  onChiudi,
  onSalvato,
  strumentoPrecompilato,
  transazione,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onSalvato: () => void;
  strumentoPrecompilato?: number;
  /** Se presente, la modale modifica una transazione esistente. */
  transazione?: Transazione | null;
}) {
  const [campi, setCampi] = useState(VUOTO);
  const [strumenti, setStrumenti] = useState<StrumentoConPosizione[]>([]);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    api
      .strumenti()
      .then(setStrumenti)
      .catch((e: unknown) =>
        toast.error('Elenco strumenti non caricato', {
          description: e instanceof Error ? e.message : String(e),
        }),
      );
  }, [aperto]);

  // Precompila i campi all'apertura: modifica di una transazione esistente
  // oppure nuovo inserimento sullo strumento corrente.
  useEffect(() => {
    if (!aperto) return;
    if (transazione) {
      setCampi({
        strumento_id: String(transazione.strumento_id),
        tipo: transazione.tipo,
        data: transazione.data,
        quantita: String(transazione.quantita),
        prezzo: String(transazione.prezzo),
        commissioni: String(transazione.commissioni),
        tasse: String(transazione.tasse),
        note: transazione.note ?? '',
      });
    } else {
      setCampi({ ...VUOTO, data: oggi(), strumento_id: strumentoPrecompilato ? String(strumentoPrecompilato) : '' });
    }
  }, [aperto, transazione, strumentoPrecompilato]);

  function aggiorna<K extends keyof typeof VUOTO>(chiave: K, valore: (typeof VUOTO)[K]) {
    setCampi((c) => ({ ...c, [chiave]: valore }));
  }

  const strumentoScelto = strumenti.find((s) => String(s.id) === campi.strumento_id);
  const serveQuantita = campi.tipo === 'ACQUISTO' || campi.tipo === 'VENDITA' || campi.tipo === 'SPLIT';

  async function salva() {
    if (!campi.strumento_id) {
      toast.error('Scegli uno strumento.');
      return;
    }
    if (serveQuantita && !(Number(campi.quantita) > 0)) {
      toast.error(
        campi.tipo === 'SPLIT'
          ? 'Indica il rapporto dello split (es. 4).'
          : 'La quantità deve essere maggiore di zero.',
      );
      return;
    }

    setSalvataggioInCorso(true);
    try {
      const corpo = {
        strumento_id: Number(campi.strumento_id),
        tipo: campi.tipo,
        data: campi.data,
        quantita: Number(campi.quantita) || 0,
        prezzo: Number(campi.prezzo) || 0,
        commissioni: Number(campi.commissioni) || 0,
        tasse: Number(campi.tasse) || 0,
        note: campi.note.trim() || null,
      };

      if (transazione) {
        await api.modificaTransazione(transazione.id, corpo);
        toast.success('Transazione aggiornata');
      } else {
        await api.creaTransazione(corpo);
        toast.success('Transazione registrata');
      }
      onSalvato();
    } catch (e) {
      toast.error('Non è stato possibile salvare', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSalvataggioInCorso(false);
    }
  }

  return (
    <Modale
      titolo={transazione ? 'Modifica transazione' : 'Nuova transazione'}
      descrizione={AIUTO_PER_TIPO[campi.tipo]}
      aperto={aperto}
      onChiudi={onChiudi}
    >
      <div className="space-y-3">
        <Campo etichetta="Strumento" obbligatorio>
          <select
            value={campi.strumento_id}
            onChange={(e) => aggiorna('strumento_id', e.target.value)}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etichetta="Tipo di movimento" obbligatorio>
            <select
              value={campi.tipo}
              onChange={(e) => aggiorna('tipo', e.target.value as TipoTransazione)}
              className={`${classiInput} w-full`}
            >
              {Object.entries(ETICHETTE_TRANSAZIONE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Data" obbligatorio>
            <input
              type="date"
              value={campi.data}
              onChange={(e) => aggiorna('data', e.target.value)}
              className={`${classiInput} w-full`}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etichetta={campi.tipo === 'SPLIT' ? 'Rapporto' : 'Quantità'}
            obbligatorio={serveQuantita}
          >
            <input
              type="number"
              step="any"
              min="0"
              value={campi.quantita}
              onChange={(e) => aggiorna('quantita', e.target.value)}
              placeholder={campi.tipo === 'SPLIT' ? '4' : '100'}
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo
            etichetta={
              campi.tipo === 'DIVIDENDO'
                ? 'Dividendo per azione'
                : campi.tipo === 'SPLIT'
                  ? 'Prezzo (non usato)'
                  : 'Prezzo unitario'
            }
            aiuto={strumentoScelto ? `In ${strumentoScelto.valuta}` : undefined}
          >
            <input
              type="number"
              step="any"
              value={campi.prezzo}
              onChange={(e) => aggiorna('prezzo', e.target.value)}
              placeholder="0,00"
              disabled={campi.tipo === 'SPLIT'}
              className={`${classiInput} w-full disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etichetta="Commissioni">
            <input
              type="number"
              step="any"
              min="0"
              value={campi.commissioni}
              onChange={(e) => aggiorna('commissioni', e.target.value)}
              placeholder="0,00"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Imposte">
            <input
              type="number"
              step="any"
              min="0"
              value={campi.tasse}
              onChange={(e) => aggiorna('tasse', e.target.value)}
              placeholder="0,00"
              className={`${classiInput} w-full`}
            />
          </Campo>
        </div>

        <Campo etichetta="Note">
          <input
            value={campi.note}
            onChange={(e) => aggiorna('note', e.target.value)}
            placeholder="Facoltativo"
            className={`${classiInput} w-full`}
          />
        </Campo>

        <div className="flex justify-end gap-2 pt-1">
          <Bottone variante="secondario" onClick={onChiudi}>
            Annulla
          </Bottone>
          <Bottone onClick={salva} disabilitato={salvataggioInCorso}>
            {salvataggioInCorso && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {transazione ? 'Salva modifiche' : 'Registra'}
          </Bottone>
        </div>
      </div>
    </Modale>
  );
}
