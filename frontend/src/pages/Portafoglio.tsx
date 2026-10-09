import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Plus, Search } from 'lucide-react';
import { api, urlExport } from '../lib/api.ts';
import { useApi } from '../lib/useApi.ts';
import {
  classeSegno,
  daQuandoTesto,
  ETICHETTE_TIPO,
  percento,
  quantita as formattaQuantita,
  valuta,
} from '../lib/formato.ts';
import { Badge, Bottone, Card, Caricamento, Errore, Vuoto, classiInput } from '../components/Ui.tsx';
import { VariazioneGiorno } from '../components/Grafici.tsx';
import { ModaleNuovoStrumento } from '../components/ModaleNuovoStrumento.tsx';
import type { RigaPortafoglio } from '../lib/tipi.ts';

type Colonna =
  | 'nome'
  | 'tipo'
  | 'quantita'
  | 'prezzoMedio'
  | 'prezzoCorrente'
  | 'variazione'
  | 'valore'
  | 'pl'
  | 'plPercentuale'
  | 'peso';

const COLONNE: Array<{ chiave: Colonna; etichetta: string; numerica: boolean }> = [
  { chiave: 'nome', etichetta: 'Strumento', numerica: false },
  { chiave: 'tipo', etichetta: 'Tipo', numerica: false },
  { chiave: 'quantita', etichetta: 'Quantità', numerica: true },
  { chiave: 'prezzoMedio', etichetta: 'Prezzo medio', numerica: true },
  { chiave: 'prezzoCorrente', etichetta: 'Prezzo', numerica: true },
  { chiave: 'variazione', etichetta: 'Oggi', numerica: true },
  { chiave: 'valore', etichetta: 'Valore', numerica: true },
  { chiave: 'pl', etichetta: 'U/P', numerica: true },
  { chiave: 'plPercentuale', etichetta: 'U/P %', numerica: true },
  { chiave: 'peso', etichetta: 'Peso', numerica: true },
];

function valorePerOrdinamento(r: RigaPortafoglio, c: Colonna): string | number {
  switch (c) {
    case 'nome':
      return r.strumento.nome.toLowerCase();
    case 'tipo':
      return r.strumento.tipo;
    case 'quantita':
      return r.posizione.quantita;
    case 'prezzoMedio':
      return r.posizione.prezzoMedio;
    case 'prezzoCorrente':
      return r.prezzoCorrente ?? -Infinity;
    case 'variazione':
      return r.variazioneGiornoPercentuale ?? -Infinity;
    case 'valore':
      return r.valoreMercato;
    case 'pl':
      return r.plNonRealizzato;
    case 'plPercentuale':
      return r.plNonRealizzatoPercentuale;
    case 'peso':
      return r.pesoPercentuale;
  }
}

export function Portafoglio() {
  const [cerca, setCerca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [mostraChiuse, setMostraChiuse] = useState(false);
  const [ordina, setOrdina] = useState<{ colonna: Colonna; crescente: boolean }>({
    colonna: 'valore',
    crescente: false,
  });
  const [modaleAperta, setModaleAperta] = useState(false);

  const { dati, caricamento, errore, ricarica } = useApi(() => api.portafoglio(), []);

  const righeVisibili = useMemo(() => {
    if (!dati) return [];
    const testo = cerca.trim().toLowerCase();

    const filtrate = dati.righe.filter((r) => {
      if (!mostraChiuse && r.posizione.quantita === 0) return false;
      if (tipoFiltro && r.strumento.tipo !== tipoFiltro) return false;
      if (!testo) return true;
      return (
        r.strumento.nome.toLowerCase().includes(testo) ||
        r.strumento.simbolo.toLowerCase().includes(testo) ||
        (r.strumento.isin ?? '').toLowerCase().includes(testo)
      );
    });

    return [...filtrate].sort((a, b) => {
      const va = valorePerOrdinamento(a, ordina.colonna);
      const vb = valorePerOrdinamento(b, ordina.colonna);
      const confronto =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, 'it')
          : Number(va) - Number(vb);
      return ordina.crescente ? confronto : -confronto;
    });
  }, [dati, cerca, tipoFiltro, mostraChiuse, ordina]);

  function cambiaOrdine(colonna: Colonna) {
    setOrdina((o) =>
      o.colonna === colonna ? { colonna, crescente: !o.crescente } : { colonna, crescente: false },
    );
  }

  if (caricamento) return <Caricamento testo="Calcolo delle posizioni…" />;
  if (errore) return <Errore messaggio={errore} onRiprova={ricarica} />;
  if (!dati) return null;

  const divisa = dati.totali.valutaBase;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Portafoglio</h1>
        <div className="flex gap-2">
          <a
            href={urlExport.portafoglio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Esporta CSV
          </a>
          <Bottone onClick={() => setModaleAperta(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuovo strumento
          </Bottone>
        </div>
      </div>

      {/* Filtri su una riga sola, sopra la tabella */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-55 flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca nome, simbolo o ISIN…"
            aria-label="Cerca strumento"
            className={`${classiInput} w-full pl-9`}
          />
        </div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          aria-label="Filtra per tipo"
          className={`${classiInput} w-auto`}
        >
          <option value="">Tutti i tipi</option>
          {Object.entries(ETICHETTE_TIPO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mostraChiuse}
            onChange={(e) => setMostraChiuse(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          Mostra posizioni chiuse
        </label>
      </div>

      <Card className="overflow-hidden" >
        {righeVisibili.length === 0 ? (
          <Vuoto
            titolo="Nessuna posizione trovata"
            descrizione={
              dati.righe.length === 0
                ? 'Aggiungi uno strumento e la sua prima transazione per iniziare.'
                : 'Nessun risultato con i filtri attivi.'
            }
          />
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Posizioni in portafoglio, valori in {divisa}
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {COLONNE.map((c) => (
                    <th
                      key={c.chiave}
                      scope="col"
                      className={`px-3 py-2.5 font-medium text-slate-600 ${c.numerica ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        type="button"
                        onClick={() => cambiaOrdine(c.chiave)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${c.numerica ? 'flex-row-reverse' : ''}`}
                      >
                        {c.etichetta}
                        {ordina.colonna === c.chiave &&
                          (ordina.crescente ? (
                            <ArrowUp className="h-3 w-3" aria-label="crescente" />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-label="decrescente" />
                          ))}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {righeVisibili.map((r) => (
                  <tr key={r.strumento.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/strumenti/${r.strumento.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {r.strumento.nome}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {r.strumento.simbolo}
                        {r.strumento.borsa && ` · ${r.strumento.borsa}`}
                        {r.prezzoMancante && (
                          <span className="ml-1.5 text-amber-600">· prezzo non disponibile</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge valore={r.strumento.tipo} etichetta={ETICHETTE_TIPO[r.strumento.tipo]} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {formattaQuantita(r.posizione.quantita)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {valuta(r.posizione.prezzoMedio, r.strumento.valuta)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {valuta(r.prezzoCorrente, r.strumento.valuta)}
                      {r.quotazioneAggiornataIl && (
                        <p className="text-xs text-slate-400">
                          {daQuandoTesto(r.quotazioneAggiornataIl)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <VariazioneGiorno percentuale={r.variazioneGiornoPercentuale} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums whitespace-nowrap text-slate-900">
                      {valuta(r.valoreMercato, divisa)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium ${classeSegno(r.plNonRealizzato)}`}>
                      {valuta(r.plNonRealizzato, divisa)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium ${classeSegno(r.plNonRealizzato)}`}>
                      {percento(r.plNonRealizzatoPercentuale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-500">
                      {r.pesoPercentuale.toLocaleString('it-IT', { maximumFractionDigits: 1 })} %
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-3 text-slate-900" colSpan={6}>
                    Totale ({righeVisibili.length}{' '}
                    {righeVisibili.length === 1 ? 'posizione' : 'posizioni'})
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-slate-900">
                    {valuta(righeVisibili.reduce((a, r) => a + r.valoreMercato, 0), divisa)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${classeSegno(
                      righeVisibili.reduce((a, r) => a + r.plNonRealizzato, 0),
                    )}`}
                  >
                    {valuta(righeVisibili.reduce((a, r) => a + r.plNonRealizzato, 0), divisa)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <ModaleNuovoStrumento
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
