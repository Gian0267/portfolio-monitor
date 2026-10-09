import { Router } from 'express';
import { db, valutaBase } from '../db/index.js';
import { esportaPortafoglioCsv } from '../services/csv.service.js';
import {
  andamentoPortafoglio,
  salvaSnapshotOdierno,
  valutaPortafoglio,
} from '../services/portafoglio.service.js';
import { aggiornaTutteLeQuotazioni } from '../services/quotazioni.service.js';

export const portafoglioRouter = Router();

/** Valutazione completa: posizioni, totali, allocazioni, migliori e peggiori. */
portafoglioRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await valutaPortafoglio());
  } catch (e) {
    next(e);
  }
});

portafoglioRouter.get('/andamento', async (req, res, next) => {
  try {
    const giorni = Math.min(Math.max(Number(req.query.giorni ?? 365), 7), 3650);
    res.json(await andamentoPortafoglio(giorni));
  } catch (e) {
    next(e);
  }
});

portafoglioRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const p = await valutaPortafoglio();
    const aperte = p.righe.filter((r) => r.posizione.quantita > 0);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="portafoglio.csv"')
      .send(esportaPortafoglioCsv(aperte, p.totali.valutaBase));
  } catch (e) {
    next(e);
  }
});

/**
 * Riepilogo dei dividendi per anno e per strumento.
 * Gli importi restano nella valuta della transazione: il cambio storico di
 * ogni accredito e' quello registrato al momento dell'inserimento.
 */
portafoglioRouter.get('/dividendi', (_req, res) => {
  const base = valutaBase();
  const righe = db
    .prepare(
      `SELECT substr(t.data, 1, 4) AS anno,
              s.simbolo, s.nome,
              t.valuta,
              SUM(CASE WHEN t.quantita > 0 THEN t.quantita * t.prezzo ELSE t.prezzo END
                  - t.commissioni - t.tasse) AS netto,
              SUM(COALESCE(t.cambio, 1) *
                  (CASE WHEN t.quantita > 0 THEN t.quantita * t.prezzo ELSE t.prezzo END
                   - t.commissioni - t.tasse)) AS netto_base,
              COUNT(*) AS accrediti
         FROM transazione t
         JOIN strumento s ON s.id = t.strumento_id
        WHERE t.tipo = 'DIVIDENDO'
        GROUP BY anno, s.id
        ORDER BY anno DESC, netto_base DESC`,
    )
    .all() as Array<{ anno: string; netto_base: number }>;

  const perAnno = new Map<string, number>();
  for (const r of righe) perAnno.set(r.anno, (perAnno.get(r.anno) ?? 0) + (r.netto_base ?? 0));

  res.json({
    valutaBase: base,
    dettaglio: righe,
    perAnno: [...perAnno.entries()]
      .map(([anno, totale]) => ({ anno, totale: Math.round(totale * 100) / 100 }))
      .sort((a, b) => b.anno.localeCompare(a.anno)),
  });
});

/** Scarica i prezzi di tutti gli strumenti e aggiorna la fotografia odierna. */
portafoglioRouter.post('/aggiorna', async (req, res, next) => {
  try {
    const soloScadute = String(req.query.solo_scadute ?? 'false') === 'true';
    const esito = await aggiornaTutteLeQuotazioni(soloScadute);
    await salvaSnapshotOdierno();
    res.json(esito);
  } catch (e) {
    next(e);
  }
});
