import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adessoIso } from '../lib/date.js';
import { nonTrovato } from '../lib/errori.js';
import { valutaAlert } from '../services/quotazioni.service.js';

export const alertRouter = Router();

const schemaAlert = z.object({
  strumento_id: z.coerce.number().int().positive(),
  condizione: z.enum(['SOPRA', 'SOTTO', 'VAR_PERC_SOPRA', 'VAR_PERC_SOTTO']),
  valore: z.coerce.number(),
});

alertRouter.get('/', (req, res) => {
  const soloAttivi = String(req.query.solo_attivi ?? 'false') === 'true';
  const righe = db
    .prepare(
      `SELECT a.*, s.simbolo, s.nome, s.valuta, q.prezzo AS prezzo_attuale
         FROM alert a
         JOIN strumento s ON s.id = a.strumento_id
         LEFT JOIN quotazione q ON q.strumento_id = s.id
        ${soloAttivi ? 'WHERE a.attivo = 1' : ''}
        ORDER BY a.attivo DESC, a.creato_il DESC`,
    )
    .all();
  res.json(righe);
});

alertRouter.post('/', (req, res, next) => {
  try {
    const dati = schemaAlert.parse(req.body);
    const strumento = db.prepare('SELECT id FROM strumento WHERE id = ?').get(dati.strumento_id);
    if (!strumento) throw nonTrovato(`Strumento ${dati.strumento_id}`);

    const info = db
      .prepare(
        `INSERT INTO alert (strumento_id, condizione, valore, attivo, creato_il)
         VALUES (?, ?, ?, 1, ?)`,
      )
      .run(dati.strumento_id, dati.condizione, dati.valore, adessoIso());

    // Puo' essere gia' vero al momento della creazione.
    valutaAlert();
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    next(e);
  }
});

alertRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const esiste = db.prepare('SELECT id FROM alert WHERE id = ?').get(id);
    if (!esiste) throw nonTrovato(`Alert ${id}`);
    db.prepare('DELETE FROM alert WHERE id = ?').run(id);
    res.json({ eliminato: id });
  } catch (e) {
    next(e);
  }
});

/** Riattiva un alert gia' scattato. */
alertRouter.post('/:id/riattiva', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const esiste = db.prepare('SELECT id FROM alert WHERE id = ?').get(id);
    if (!esiste) throw nonTrovato(`Alert ${id}`);
    db.prepare('UPDATE alert SET attivo = 1, scattato_il = NULL, prezzo_scatto = NULL WHERE id = ?').run(id);
    res.json({ riattivato: id });
  } catch (e) {
    next(e);
  }
});
