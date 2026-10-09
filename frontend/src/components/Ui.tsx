import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { classeSegno, percento, valuta } from '../lib/formato.ts';

export function Card({
  titolo,
  azione,
  children,
  className = '',
}: {
  titolo?: string;
  azione?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titolo || azione) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {titolo && <h2 className="text-sm font-semibold text-slate-700">{titolo}</h2>}
          {azione}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Riquadro KPI: valore grande, variazione colorata, nota di contesto. */
export function CardKpi({
  etichetta,
  valore,
  variazione,
  variazionePercentuale,
  divisa,
  nota,
  icona,
}: {
  etichetta: string;
  valore: string;
  variazione?: number | null;
  variazionePercentuale?: number | null;
  divisa?: string;
  nota?: string;
  icona?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etichetta}</p>
        {icona && <span className="text-slate-400">{icona}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{valore}</p>
      {(variazione !== undefined || variazionePercentuale !== undefined) && (
        <p className={`mt-1 text-sm font-medium tabular-nums ${classeSegno(variazione ?? variazionePercentuale)}`}>
          {variazione !== undefined && variazione !== null && (
            <span>
              {variazione > 0 ? '+' : ''}
              {valuta(variazione, divisa ?? 'EUR')}
            </span>
          )}
          {variazione !== undefined && variazionePercentuale !== undefined && ' · '}
          {variazionePercentuale !== undefined && percento(variazionePercentuale)}
        </p>
      )}
      {nota && <p className="mt-1 text-xs text-slate-400">{nota}</p>}
    </div>
  );
}

export function Caricamento({ testo = 'Caricamento…' }: { testo?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {testo}
    </div>
  );
}

export function Vuoto({
  titolo,
  descrizione,
  azione,
}: {
  titolo: string;
  descrizione?: string;
  azione?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-medium text-slate-700">{titolo}</p>
      {descrizione && <p className="max-w-md text-sm text-slate-500">{descrizione}</p>}
      {azione && <div className="mt-2">{azione}</div>}
    </div>
  );
}

export function Errore({ messaggio, onRiprova }: { messaggio: string; onRiprova?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Qualcosa non ha funzionato</p>
        <p className="mt-0.5 break-words text-red-700">{messaggio}</p>
        {onRiprova && (
          <button
            type="button"
            onClick={onRiprova}
            className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}

export function Avviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const STILI_BADGE: Record<string, string> = {
  AZIONE: 'bg-blue-50 text-blue-700 ring-blue-200',
  ETF: 'bg-teal-50 text-teal-700 ring-teal-200',
  FONDO: 'bg-violet-50 text-violet-700 ring-violet-200',
  OBBLIGAZIONE: 'bg-amber-50 text-amber-700 ring-amber-200',
  CRYPTO: 'bg-orange-50 text-orange-700 ring-orange-200',
  ALTRO: 'bg-slate-100 text-slate-600 ring-slate-200',
  ACQUISTO: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VENDITA: 'bg-red-50 text-red-700 ring-red-200',
  DIVIDENDO: 'bg-sky-50 text-sky-700 ring-sky-200',
  COMMISSIONE: 'bg-slate-100 text-slate-600 ring-slate-200',
  SPLIT: 'bg-purple-50 text-purple-700 ring-purple-200',
};

export function Badge({ valore, etichetta }: { valore: string; etichetta?: string }) {
  const stile = STILI_BADGE[valore] ?? STILI_BADGE.ALTRO;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${stile}`}>
      {etichetta ?? valore}
    </span>
  );
}

export function Bottone({
  children,
  onClick,
  tipo = 'button',
  variante = 'primario',
  disabilitato = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: 'button' | 'submit';
  variante?: 'primario' | 'secondario' | 'pericolo' | 'fantasma';
  disabilitato?: boolean;
  className?: string;
}) {
  const varianti = {
    primario: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondario:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    pericolo: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300',
    fantasma: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  };
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabilitato}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${varianti[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  etichetta,
  children,
  aiuto,
  obbligatorio = false,
}: {
  etichetta: string;
  children: ReactNode;
  aiuto?: string;
  obbligatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {etichetta}
        {obbligatorio && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {aiuto && <span className="mt-1 block text-xs text-slate-400">{aiuto}</span>}
    </label>
  );
}

/**
 * Stile base degli input. NON include la larghezza: va messa dove si usa.
 * Mettere qui `w-full` renderebbe inefficace un `w-auto` aggiunto dopo, perche'
 * fra utility di pari specificita' decide l'ordine nel CSS, non nell'attributo.
 */
export const classiInput =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none';
