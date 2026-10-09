import { db, valutaBase } from '../db/index.js';
import { arrotonda, percentuale } from '../lib/numeri.js';
import { adessoIso, intervalloGiorni, oggiIso } from '../lib/date.js';
import type { RigaStrumento, RigaTransazione } from '../tipi.js';
import { precaricaCambi } from './cambi.service.js';
import { calcolaTutteLePosizioni, quantitaAllaData, type Posizione } from './posizioni.service.js';
import { tutteLeQuotazioni } from './quotazioni.service.js';

export interface RigaPortafoglio {
  strumento: RigaStrumento;
  posizione: Posizione;
  /** Ultimo prezzo noto nella valuta dello strumento. */
  prezzoCorrente: number | null;
  variazioneGiornoPercentuale: number | null;
  /** Valori convertiti nella valuta base. */
  valoreMercato: number;
  costo: number;
  plNonRealizzato: number;
  plNonRealizzatoPercentuale: number;
  plGiorno: number;
  plRealizzato: number;
  dividendi: number;
  /** Rendimento complessivo: non realizzato + realizzato + dividendi. */
  plTotale: number;
  pesoPercentuale: number;
  cambioApplicato: number;
  quotazioneAggiornataIl: string | null;
  fonteQuotazione: string | null;
  /** true quando non esiste alcun prezzo: la riga va valorizzata al costo. */
  prezzoMancante: boolean;
}

export interface TotaliPortafoglio {
  valutaBase: string;
  valoreMercato: number;
  costo: number;
  plNonRealizzato: number;
  plNonRealizzatoPercentuale: number;
  plGiorno: number;
  plGiornoPercentuale: number;
  plRealizzato: number;
  dividendi: number;
  plTotale: number;
  plTotalePercentuale: number;
  numeroPosizioni: number;
  numeroStrumenti: number;
  oneriTotali: number;
}

export interface VoceAllocazione {
  etichetta: string;
  valore: number;
  percentuale: number;
}

export interface Portafoglio {
  totali: TotaliPortafoglio;
  righe: RigaPortafoglio[];
  allocazionePerTipo: VoceAllocazione[];
  allocazionePerValuta: VoceAllocazione[];
  allocazionePerPaese: VoceAllocazione[];
  allocazionePerSettore: VoceAllocazione[];
  migliori: RigaPortafoglio[];
  peggiori: RigaPortafoglio[];
  avvisi: string[];
  calcolatoIl: string;
}

/**
 * Valuta l'intero portafoglio convertendo tutto nella valuta base.
 * Le posizioni derivano dalle transazioni, i prezzi dalla cache quotazioni:
 * nessuna chiamata di rete qui, cosi' la dashboard risponde anche offline.
 * Per avere prezzi aggiornati si chiama prima `aggiornaTutteLeQuotazioni`.
 */
export async function valutaPortafoglio(): Promise<Portafoglio> {
  const base = valutaBase();
  const strumenti = db
    .prepare('SELECT * FROM strumento ORDER BY nome COLLATE NOCASE')
    .all() as RigaStrumento[];
  const posizioni = calcolaTutteLePosizioni();
  const quotazioni = tutteLeQuotazioni();

  const valute = strumenti.map((s) => quotazioni.get(s.id)?.valuta ?? s.valuta);
  const { tassi: cambi, nonConvertite } = await precaricaCambi(valute);

  const avvisi: string[] = [];
  if (nonConvertite.length > 0) {
    avvisi.push(
      `Cambio non disponibile per ${nonConvertite.join(', ')}: gli importi in queste valute ` +
        `sono sommati 1:1 e il totale in ${base} non e attendibile.`,
    );
  }
  const righe: RigaPortafoglio[] = [];

  for (const s of strumenti) {
    const pos = posizioni.get(s.id) ?? posizioneVuota(s.id);
    // Gli strumenti mai movimentati (solo watchlist) non sono posizioni.
    if (pos.quantita === 0 && pos.numeroOperazioni === 0) continue;

    const q = quotazioni.get(s.id);
    const valutaRiga = (q?.valuta ?? s.valuta).toUpperCase();
    const cambio = cambi.get(valutaRiga) ?? 1;

    const prezzoMancante = !q && pos.quantita > 0;
    if (prezzoMancante) {
      avvisi.push(
        `${s.simbolo}: nessuna quotazione disponibile, valorizzato al prezzo medio di carico.`,
      );
    }
    const prezzo = q?.prezzo ?? (pos.quantita > 0 ? pos.prezzoMedio : 0);

    const costo = pos.costoTotale * cambio;
    // Senza prezzo di mercato la riga vale esattamente il suo costo, e il P/L e'
    // zero: ricalcolarla come quantita x prezzoMedio introdurrebbe qualche
    // centesimo di scarto (il medio e' arrotondato) che l'interfaccia
    // mostrerebbe come una perdita mai avvenuta.
    const valoreMercato = q ? pos.quantita * prezzo * cambio : costo;
    const plNonRealizzato = valoreMercato - costo;
    const variazioneAssoluta = q?.variazione_assoluta ?? 0;
    const plGiorno = prezzoMancante ? 0 : pos.quantita * variazioneAssoluta * cambio;
    const plRealizzato = pos.plRealizzato * cambio;
    const dividendi = pos.dividendiIncassati * cambio;

    righe.push({
      strumento: s,
      posizione: pos,
      prezzoCorrente: q?.prezzo ?? null,
      variazioneGiornoPercentuale: q?.variazione_percentuale ?? null,
      valoreMercato: arrotonda(valoreMercato),
      costo: arrotonda(costo),
      plNonRealizzato: arrotonda(plNonRealizzato),
      plNonRealizzatoPercentuale: costo !== 0 ? percentuale(plNonRealizzato, Math.abs(costo)) : 0,
      plGiorno: arrotonda(plGiorno),
      plRealizzato: arrotonda(plRealizzato),
      dividendi: arrotonda(dividendi),
      plTotale: arrotonda(plNonRealizzato + plRealizzato + dividendi),
      pesoPercentuale: 0, // calcolato dopo, serve il totale
      cambioApplicato: arrotonda(cambio, 6),
      quotazioneAggiornataIl: q?.aggiornato_il ?? null,
      fonteQuotazione: q?.fonte ?? null,
      prezzoMancante,
    });
  }

  const aperte = righe.filter((r) => r.posizione.quantita > 0);
  const valoreMercato = somma(aperte.map((r) => r.valoreMercato));
  const costo = somma(aperte.map((r) => r.costo));
  const plNonRealizzato = somma(aperte.map((r) => r.plNonRealizzato));
  const plGiorno = somma(aperte.map((r) => r.plGiorno));
  // Realizzato e dividendi arrivano anche da posizioni chiuse: contiamo tutte le righe.
  const plRealizzato = somma(righe.map((r) => r.plRealizzato));
  const dividendi = somma(righe.map((r) => r.dividendi));
  const valorePrecedente = valoreMercato - plGiorno;

  for (const r of righe) r.pesoPercentuale = percentuale(r.valoreMercato, valoreMercato);

  const totali: TotaliPortafoglio = {
    valutaBase: base,
    valoreMercato: arrotonda(valoreMercato),
    costo: arrotonda(costo),
    plNonRealizzato: arrotonda(plNonRealizzato),
    plNonRealizzatoPercentuale: costo !== 0 ? percentuale(plNonRealizzato, Math.abs(costo)) : 0,
    plGiorno: arrotonda(plGiorno),
    plGiornoPercentuale: valorePrecedente !== 0 ? percentuale(plGiorno, Math.abs(valorePrecedente)) : 0,
    plRealizzato: arrotonda(plRealizzato),
    dividendi: arrotonda(dividendi),
    plTotale: arrotonda(plNonRealizzato + plRealizzato + dividendi),
    plTotalePercentuale:
      costo !== 0 ? percentuale(plNonRealizzato + plRealizzato + dividendi, Math.abs(costo)) : 0,
    numeroPosizioni: aperte.length,
    numeroStrumenti: strumenti.length,
    oneriTotali: arrotonda(somma(righe.map((r) => r.posizione.oneriTotali * r.cambioApplicato))),
  };

  const perRendimento = [...aperte]
    .filter((r) => !r.prezzoMancante)
    .sort((a, b) => b.plNonRealizzatoPercentuale - a.plNonRealizzatoPercentuale);

  return {
    totali,
    righe,
    allocazionePerTipo: raggruppa(aperte, (r) => r.strumento.tipo, valoreMercato),
    allocazionePerValuta: raggruppa(
      aperte,
      (r) => (r.strumento.valuta || 'n/d').toUpperCase(),
      valoreMercato,
    ),
    allocazionePerPaese: raggruppa(aperte, (r) => r.strumento.paese || 'Non indicato', valoreMercato),
    allocazionePerSettore: raggruppa(
      aperte,
      (r) => r.strumento.settore || 'Non indicato',
      valoreMercato,
    ),
    migliori: perRendimento.slice(0, 5),
    peggiori: perRendimento.slice(-5).reverse(),
    avvisi,
    calcolatoIl: adessoIso(),
  };
}

function posizioneVuota(strumentoId: number): Posizione {
  return {
    strumentoId,
    quantita: 0,
    prezzoMedio: 0,
    costoTotale: 0,
    plRealizzato: 0,
    dividendiIncassati: 0,
    oneriTotali: 0,
    quantitaAcquistata: 0,
    quantitaVenduta: 0,
    primaOperazione: null,
    ultimaOperazione: null,
    numeroOperazioni: 0,
  };
}

const somma = (n: number[]) => n.reduce((a, b) => a + b, 0);

function raggruppa(
  righe: RigaPortafoglio[],
  chiave: (r: RigaPortafoglio) => string,
  totale: number,
): VoceAllocazione[] {
  const mappa = new Map<string, number>();
  for (const r of righe) {
    const k = chiave(r);
    mappa.set(k, (mappa.get(k) ?? 0) + r.valoreMercato);
  }
  return [...mappa.entries()]
    .map(([etichetta, valore]) => ({
      etichetta,
      valore: arrotonda(valore),
      percentuale: percentuale(valore, totale),
    }))
    .sort((a, b) => b.valore - a.valore);
}

export interface PuntoAndamento {
  data: string;
  valore: number;
  costo: number;
  pl: number;
}

/**
 * Ricostruisce il valore del portafoglio giorno per giorno combinando le
 * quantita' detenute a ciascuna data con i prezzi storici in cache.
 *
 * I prezzi convertiti usano il cambio corrente, non quello storico: la curva
 * mostra l'andamento dei titoli, non l'effetto valutario giorno per giorno
 * (che richiederebbe lo storico completo dei cambi per ogni valuta).
 */
export async function andamentoPortafoglio(giorni: number): Promise<PuntoAndamento[]> {
  const strumenti = db.prepare('SELECT * FROM strumento').all() as RigaStrumento[];
  if (strumenti.length === 0) return [];

  const transazioni = db
    .prepare('SELECT * FROM transazione ORDER BY data ASC, id ASC')
    .all() as RigaTransazione[];
  if (transazioni.length === 0) return [];

  const perStrumento = new Map<number, RigaTransazione[]>();
  for (const t of transazioni) {
    const e = perStrumento.get(t.strumento_id);
    if (e) e.push(t);
    else perStrumento.set(t.strumento_id, [t]);
  }

  const { tassi: cambi } = await precaricaCambi(strumenti.map((s) => s.valuta));

  // Partiamo dalla prima operazione in assoluto, mai prima.
  const primaOperazione = transazioni[0].data;
  const inizioRichiesto = new Date();
  inizioRichiesto.setDate(inizioRichiesto.getDate() - giorni);
  const inizio =
    primaOperazione > inizioRichiesto.toISOString().slice(0, 10)
      ? primaOperazione
      : inizioRichiesto.toISOString().slice(0, 10);

  const prezzi = new Map<number, Map<string, number>>();
  for (const s of strumenti) {
    const righe = db
      .prepare(
        'SELECT data, chiusura FROM prezzo_storico WHERE strumento_id = ? AND data >= ? ORDER BY data ASC',
      )
      .all(s.id, inizio) as Array<{ data: string; chiusura: number }>;
    prezzi.set(s.id, new Map(righe.map((r) => [r.data, r.chiusura])));
  }

  const punti: PuntoAndamento[] = [];
  const ultimoPrezzoNoto = new Map<number, number>();

  for (const giorno of intervalloGiorni(inizio, oggiIso())) {
    let valore = 0;
    let costo = 0;
    let haDati = false;

    for (const s of strumenti) {
      const ts = perStrumento.get(s.id);
      if (!ts) continue;
      const q = quantitaAllaData(ts, giorno);

      const prezzoDelGiorno = prezzi.get(s.id)?.get(giorno);
      if (prezzoDelGiorno !== undefined) ultimoPrezzoNoto.set(s.id, prezzoDelGiorno);
      // Nei giorni di borsa chiusa riportiamo l'ultimo prezzo noto.
      const prezzo = prezzoDelGiorno ?? ultimoPrezzoNoto.get(s.id);
      if (q === 0 || prezzo === undefined) continue;

      const cambio = cambi.get((s.valuta || 'EUR').toUpperCase()) ?? 1;
      valore += q * prezzo * cambio;
      costo += q * costoMedioAllaData(ts, giorno) * cambio;
      haDati = true;
    }

    if (haDati) {
      punti.push({
        data: giorno,
        valore: arrotonda(valore),
        costo: arrotonda(costo),
        pl: arrotonda(valore - costo),
      });
    }
  }
  return punti;
}

/** Costo medio di carico alla data, con la stessa logica di `calcolaPosizione`. */
function costoMedioAllaData(transazioni: RigaTransazione[], dataIso: string): number {
  let q = 0;
  let costo = 0;
  for (const t of transazioni) {
    if (t.data > dataIso) break;
    const oneri = (t.commissioni ?? 0) + (t.tasse ?? 0);
    if (t.tipo === 'ACQUISTO') {
      costo += t.quantita * t.prezzo + oneri;
      q += t.quantita;
    } else if (t.tipo === 'VENDITA') {
      const venduta = Math.min(t.quantita, q);
      const medio = q > 0 ? costo / q : 0;
      costo -= venduta * medio;
      q -= venduta;
      if (q <= 1e-9) {
        q = 0;
        costo = 0;
      }
    } else if (t.tipo === 'SPLIT' && t.quantita > 0) {
      q *= t.quantita;
    }
  }
  return q > 0 ? costo / q : 0;
}

/** Fotografia odierna, per alimentare il grafico anche senza storico dai provider. */
export async function salvaSnapshotOdierno(): Promise<void> {
  const p = await valutaPortafoglio();
  db.prepare(
    `INSERT INTO snapshot_portafoglio (data, valore_mercato, costo, pl_non_realizzato, valuta_base, creato_il)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(data) DO UPDATE SET
       valore_mercato = excluded.valore_mercato,
       costo = excluded.costo,
       pl_non_realizzato = excluded.pl_non_realizzato`,
  ).run(
    oggiIso(),
    p.totali.valoreMercato,
    p.totali.costo,
    p.totali.plNonRealizzato,
    p.totali.valutaBase,
    adessoIso(),
  );
}
