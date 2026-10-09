import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { db, scriviImpostazione } from '../db/index.js';
import { datiCambio, datiMercato } from '../providers/index.js';

export const impostazioniRouter = Router();

impostazioniRouter.get('/', (_req, res) => {
  const righe = db.prepare('SELECT chiave, valore FROM impostazione ORDER BY chiave').all() as Array<{
    chiave: string;
    valore: string;
  }>;

  res.json({
    impostazioni: Object.fromEntries(righe.map((r) => [r.chiave, r.valore])),
    // Stato di sola lettura utile per diagnosticare "perche' non vedo i prezzi".
    provider: {
      quotazioni: datiMercato.nomi,
      cambi: datiCambio.nomi,
      twelvedataConfigurato: config.twelveDataApiKey.length > 0,
    },
    quotazioneTtlSecondi: config.quotazioneTtlSecondi,
    cronAggiornamento: config.cronAggiornamento || null,
    percorsoDb: config.percorsoDb,
  });
});

const schema = z.record(z.string(), z.string());

impostazioniRouter.put('/', (req, res, next) => {
  try {
    const dati = schema.parse(req.body);
    for (const [chiave, valore] of Object.entries(dati)) scriviImpostazione(chiave, valore);
    res.json({ aggiornate: Object.keys(dati).length });
  } catch (e) {
    next(e);
  }
});
