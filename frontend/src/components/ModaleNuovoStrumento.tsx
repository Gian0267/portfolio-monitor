import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { ETICHETTE_TIPO } from '../lib/formato.ts';
import { Bottone, Campo, classiInput } from './Ui.tsx';
import { Modale } from './Modale.tsx';
import type { RisultatoRicerca, TipoStrumento } from '../lib/tipi.ts';

const VUOTO = {
  simbolo: '',
  nome: '',
  isin: '',
  tipo: 'AZIONE' as TipoStrumento,
  valuta: 'EUR',
  borsa: '',
  paese: '',
  settore: '',
};

/**
 * Creazione di uno strumento. La ricerca sul provider e' facoltativa: se la
 * rete non e' disponibile si compila tutto a mano, cosi' l'app resta usabile.
 */
export function ModaleNuovoStrumento({
  aperto,
  onChiudi,
  onCreato,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onCreato: (id: number) => void;
}) {
  const [campi, setCampi] = useState(VUOTO);
  const [query, setQuery] = useState('');
  const [risultati, setRisultati] = useState<RisultatoRicerca[] | null>(null);
  const [ricercaInCorso, setRicercaInCorso] = useState(false);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  function aggiorna<K extends keyof typeof VUOTO>(chiave: K, valore: (typeof VUOTO)[K]) {
    setCampi((c) => ({ ...c, [chiave]: valore }));
  }

  function chiudiEResetta() {
    setCampi(VUOTO);
    setQuery('');
    setRisultati(null);
    onChiudi();
  }

  async function cerca() {
    if (query.trim().length < 2) {
      toast.error('Inserisci almeno 2 caratteri da cercare.');
      return;
    }
    setRicercaInCorso(true);
    try {
      setRisultati(await api.ricerca(query));
    } catch (e) {
      setRisultati([]);
      toast.error('Ricerca non disponibile', {
        description:
          (e instanceof Error ? e.message : String(e)) +
          ' — puoi comunque inserire lo strumento a mano.',
      });
    } finally {
      setRicercaInCorso(false);
    }
  }

  function selezionaRisultato(r: RisultatoRicerca) {
    setCampi((c) => ({
      ...c,
      simbolo: r.simbolo,
      nome: r.nome,
      tipo: (r.tipo in ETICHETTE_TIPO ? r.tipo : 'ALTRO') as TipoStrumento,
      valuta: r.valuta ?? c.valuta,
      borsa: r.borsa ?? c.borsa,
    }));
    setRisultati(null);
  }

  async function salva() {
    if (!campi.simbolo.trim() || !campi.nome.trim()) {
      toast.error('Simbolo e nome sono obbligatori.');
      return;
    }
    setSalvataggioInCorso(true);
    try {
      const creato = await api.creaStrumento({
        ...campi,
        isin: campi.isin.trim() || null,
        borsa: campi.borsa.trim() || null,
        paese: campi.paese.trim() || null,
        settore: campi.settore.trim() || null,
      });
      toast.success(`${creato.simbolo} aggiunto`);
      // Primo prezzo subito: non blocchiamo se la rete non risponde.
      api.aggiornaQuotazione(creato.id).catch(() => undefined);
      setCampi(VUOTO);
      setQuery('');
      setRisultati(null);
      onCreato(creato.id);
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
      titolo="Nuovo strumento"
      descrizione="Cerca il titolo sui provider oppure compila i campi a mano."
      aperto={aperto}
      onChiudi={chiudiEResetta}
      largo
    >
      <div className="space-y-4">
        {/* Ricerca assistita */}
        <div>
          <Campo
            etichetta="Cerca per nome, ticker o ISIN"
            aiuto="Esempi: Apple, VWCE, IE00BK5BQT80. Il simbolo usa il formato Yahoo (ENI.MI, SAP.DE, AAPL)."
          >
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    cerca();
                  }
                }}
                placeholder="Vanguard FTSE All-World"
                className={`${classiInput} w-full`}
              />
              <Bottone variante="secondario" onClick={cerca} disabilitato={ricercaInCorso}>
                {ricercaInCorso ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                Cerca
              </Bottone>
            </div>
          </Campo>

          {risultati && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              {risultati.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">
                  Nessun risultato. Compila i campi qui sotto a mano.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {risultati.map((r) => (
                    <li key={`${r.simbolo}-${r.borsa ?? ''}`}>
                      <button
                        type="button"
                        onClick={() => selezionaRisultato(r)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {r.nome}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {r.simbolo}
                            {r.borsa && ` · ${r.borsa}`}
                            {r.valuta && ` · ${r.valuta}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {ETICHETTE_TIPO[r.tipo] ?? r.tipo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etichetta="Simbolo" obbligatorio aiuto="Formato Yahoo Finance">
            <input
              value={campi.simbolo}
              onChange={(e) => aggiorna('simbolo', e.target.value.toUpperCase())}
              placeholder="VWCE.DE"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Nome" obbligatorio>
            <input
              value={campi.nome}
              onChange={(e) => aggiorna('nome', e.target.value)}
              placeholder="Vanguard FTSE All-World UCITS ETF"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Tipo">
            <select
              value={campi.tipo}
              onChange={(e) => aggiorna('tipo', e.target.value as TipoStrumento)}
              className={`${classiInput} w-full`}
            >
              {Object.entries(ETICHETTE_TIPO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Valuta" aiuto="Codice ISO a 3 lettere">
            <input
              value={campi.valuta}
              onChange={(e) => aggiorna('valuta', e.target.value.toUpperCase().slice(0, 3))}
              placeholder="EUR"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="ISIN">
            <input
              value={campi.isin}
              onChange={(e) => aggiorna('isin', e.target.value.toUpperCase())}
              placeholder="IE00BK5BQT80"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Borsa">
            <input
              value={campi.borsa}
              onChange={(e) => aggiorna('borsa', e.target.value)}
              placeholder="Xetra"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Area geografica" aiuto="Usata nella composizione del portafoglio">
            <input
              value={campi.paese}
              onChange={(e) => aggiorna('paese', e.target.value)}
              placeholder="Globale"
              className={`${classiInput} w-full`}
            />
          </Campo>
          <Campo etichetta="Settore">
            <input
              value={campi.settore}
              onChange={(e) => aggiorna('settore', e.target.value)}
              placeholder="Azionario globale"
              className={`${classiInput} w-full`}
            />
          </Campo>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Bottone variante="secondario" onClick={chiudiEResetta}>
            Annulla
          </Bottone>
          <Bottone onClick={salva} disabilitato={salvataggioInCorso}>
            {salvataggioInCorso && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Salva strumento
          </Bottone>
        </div>
      </div>
    </Modale>
  );
}
