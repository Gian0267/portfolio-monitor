import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COLORE_ASSE,
  COLORE_GRIGLIA,
  COLORE_MAGNITUDINE,
  COLORI_SERIE,
  data as formattaData,
  percento,
  valuta,
  valutaCompatta,
} from '../lib/formato.ts';
import type { PuntoAndamento, VoceAllocazione } from '../lib/tipi.ts';

const ASSE = { fontSize: 11, fill: COLORE_ASSE } as const;

/** Tooltip condiviso: niente colore nel testo, l'identita' la porta il pallino. */
function TooltipPersonalizzato({
  active,
  payload,
  label,
  divisa,
  formattaEtichetta,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  divisa: string;
  formattaEtichetta?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">
        {formattaEtichetta ? formattaEtichetta(String(label)) : label}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-slate-600">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
            aria-hidden
          />
          <span>{p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {valuta(p.value, divisa)}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Andamento del portafoglio: valore di mercato contro capitale investito.
 * Due serie sulla STESSA scala (entrambe importi nella valuta base): mai due
 * assi y, che renderebbero il confronto arbitrario.
 */
export function GraficoAndamento({
  punti,
  divisa,
  altezza = 280,
}: {
  punti: PuntoAndamento[];
  divisa: string;
  altezza?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altezza}>
      <AreaChart data={punti} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="sfumaturaValore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORI_SERIE[0]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={COLORI_SERIE[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={COLORE_GRIGLIA} vertical={false} />
        <XAxis
          dataKey="data"
          tick={ASSE}
          tickFormatter={(v: string) => formattaData(v).slice(0, 5)}
          minTickGap={36}
          stroke={COLORE_GRIGLIA}
        />
        <YAxis
          tick={ASSE}
          tickFormatter={(v: number) => valutaCompatta(v, divisa)}
          width={78}
          stroke={COLORE_GRIGLIA}
        />
        <Tooltip
          content={<TooltipPersonalizzato divisa={divisa} formattaEtichetta={formattaData} />}
          cursor={{ stroke: COLORE_ASSE, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(v: string) => <span className="text-xs text-slate-600">{v}</span>}
        />
        <Area
          type="monotone"
          dataKey="valore"
          name="Valore di mercato"
          stroke={COLORI_SERIE[0]}
          strokeWidth={2}
          fill="url(#sfumaturaValore)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
        />
        <Area
          type="monotone"
          dataKey="costo"
          name="Capitale investito"
          stroke={COLORI_SERIE[1]}
          strokeWidth={2}
          strokeDasharray="4 3"
          fill="none"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Prezzo storico di un singolo strumento: una serie, nessuna legenda. */
export function GraficoPrezzo({
  punti,
  divisa,
  altezza = 240,
}: {
  punti: Array<{ data: string; chiusura: number }>;
  divisa: string;
  altezza?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altezza}>
      <LineChart data={punti} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={COLORE_GRIGLIA} vertical={false} />
        <XAxis
          dataKey="data"
          tick={ASSE}
          tickFormatter={(v: string) => formattaData(v).slice(0, 5)}
          minTickGap={36}
          stroke={COLORE_GRIGLIA}
        />
        <YAxis
          tick={ASSE}
          tickFormatter={(v: number) => valutaCompatta(v, divisa)}
          width={78}
          domain={['auto', 'auto']}
          stroke={COLORE_GRIGLIA}
        />
        <Tooltip
          content={<TooltipPersonalizzato divisa={divisa} formattaEtichetta={formattaData} />}
          cursor={{ stroke: COLORE_ASSE, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Line
          type="monotone"
          dataKey="chiusura"
          name="Chiusura"
          stroke={COLORI_SERIE[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Allocazione: barre orizzontali in tinta unica con percentuale a fianco.
 *
 * Volutamente NON una torta a spicchi colorati: le barre si leggono a colpo
 * d'occhio, si ordinano per peso e restano corrette con qualunque numero di
 * categorie, senza mai dover inventare colori nuovi.
 */
export function BarreAllocazione({
  voci,
  divisa,
  massimo = 8,
}: {
  voci: VoceAllocazione[];
  divisa: string;
  massimo?: number;
}) {
  if (voci.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Nessun dato da ripartire.</p>;
  }

  // Oltre `massimo` categorie accorpiamo la coda in "Altre": niente liste
  // infinite di barre minuscole.
  const principali = voci.slice(0, massimo);
  const coda = voci.slice(massimo);
  const elenco =
    coda.length > 0
      ? [
          ...principali,
          {
            etichetta: `Altre ${coda.length}`,
            valore: coda.reduce((a, v) => a + v.valore, 0),
            percentuale: coda.reduce((a, v) => a + v.percentuale, 0),
          },
        ]
      : principali;

  const massimoPeso = Math.max(...elenco.map((v) => v.percentuale), 1);

  return (
    <ul className="space-y-2.5">
      {elenco.map((v) => (
        <li key={v.etichetta}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{v.etichetta}</span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {valuta(v.valore, divisa, 0)}
              <span className="ml-2 font-medium text-slate-900">
                {v.percentuale.toLocaleString('it-IT', { maximumFractionDigits: 1 })} %
              </span>
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                // Larghezza relativa alla voce maggiore: differenze piu' leggibili.
                width: `${Math.max((v.percentuale / massimoPeso) * 100, 1.5)}%`,
                backgroundColor: COLORE_MAGNITUDINE,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Dividendi incassati per anno: una sola serie, tinta unica. */
export function GraficoDividendi({
  dati,
  divisa,
  altezza = 220,
}: {
  dati: Array<{ anno: string; totale: number }>;
  divisa: string;
  altezza?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={altezza}>
      <BarChart data={dati} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={COLORE_GRIGLIA} vertical={false} />
        <XAxis dataKey="anno" tick={ASSE} stroke={COLORE_GRIGLIA} />
        <YAxis
          tick={ASSE}
          tickFormatter={(v: number) => valutaCompatta(v, divisa)}
          width={78}
          stroke={COLORE_GRIGLIA}
        />
        <Tooltip
          content={<TooltipPersonalizzato divisa={divisa} />}
          cursor={{ fill: COLORE_GRIGLIA, fillOpacity: 0.5 }}
        />
        <Bar
          dataKey="totale"
          name="Dividendi netti"
          fill={COLORE_MAGNITUDINE}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mini riga di testo con la variazione del giorno, usata nelle tabelle. */
export function VariazioneGiorno({ percentuale }: { percentuale: number | null }) {
  if (percentuale === null) return <span className="text-slate-400">—</span>;
  const classe = percentuale > 0 ? 'text-emerald-600' : percentuale < 0 ? 'text-red-600' : 'text-slate-500';
  return <span className={`tabular-nums font-medium ${classe}`}>{percento(percentuale)}</span>;
}
