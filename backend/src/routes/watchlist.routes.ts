import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adessoIso } from '../lib/date.js';
import { nonTrovato, richiestaNonValida } from '../lib/errori.js';
import { aggiornaQuotazione } from '../services/quotazioni.service.js';
import type { RigaStrumento } from '../tipi.js';

export const watchlistRouter = Router();

const schemaVoce = z.object({
  strumento_id: z.coerce.number().int().positive(),
  prezzo_target: z.coerce.number().optional().nullable(),
  nota: z.string().trim().optional().nullable(),
});

watchlistRouter.get('/', (_req, res) => {
  const righe = db
    .prepare(
      `SELECT w.id, w.prezzo_target, w.nota, w.creato_il,
              s.id AS strumento_id, s.simbolo, s.nome, s.tipo, s.valuta, s.borsa, s.isin,
              q.prezzo, q.variazione_percentuale, q.aggiornato_il AS quotazione_aggiornata_il,
              q.fonte
         FROM watchlist w
         JOIN strumento s ON s.id = w.strumento_id
         LEFT JOIN quotazione q ON q.strumento_id = s.id
        ORDER BY s.nome COLLATE NOCASE`,
    )
    .all() as Array<Record<string, unknown>>;

  res.json(
    righe.map((r) => {
      const prezzo = r.prezzo as number | null;
      const target = r.prezzo_target as number | null;
      return {
        ...r,
        // Quanto manca al prezzo obiettivo, in percentuale.
        distanza_target_percentuale:
          prezzo && target ? Math.round(((target - prezzo) / prezzo) * 10000) / 100 : null,
        target_raggiunto: prezzo && target ? prezzo <= target : null,
      };
    }),
  );
});

watchlistRouter.post('/', async (req, res, next) => {
  try {
    const dati = schemaVoce.parse(req.body);
    const strumento = db.prepare('SELECT * FROM strumento WHERE id = ?').get(dati.strumento_id) as
      | RigaStrumento
      | undefined;
    if (!strumento) throw nonTrovato(`Strumento ${dati.strumento_id}`);

    const giaPresente = db
      .prepare('SELECT id FROM watchlist WHERE strumento_id = ?')
      .get(dati.strumento_id);
    if (giaPresente) throw richiestaNonValida(`${strumento.simbolo} e gia nella watchlist.`);

    db.prepare(
      'INSERT INTO watchlist (strumento_id, prezzo_target, nota, creato_il) VALUES (?, ?, ?, ?)',
    ).run(dati.strumento_id, dati.prezzo_target ?? null, dati.nota ?? null, adessoIso());

    // Primo prezzo subito, cosi' la riga non appare vuota.
    try {
      await aggiornaQuotazione(strumento);
    } catch (e) {
      console.warn(`[watchlist] quotazione iniziale non disponibile: ${e}`);
    }

    res.status(201).json({ creato: true, strumento_id: dati.strumento_id });
  } catch (e) {
    next(e);
  }
});

watchlistRouter.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const esiste = db.prepare('SELECT id FROM watchlist WHERE id = ?').get(id);
    if (!esiste) throw nonTrovato(`Voce watchlist ${id}`);

    const dati = schemaVoce.partial().omit({ strumento_id: true }).parse(req.body);
    db.prepare('UPDATE watchlist SET prezzo_target = ?, nota = ? WHERE id = ?').run(
      dati.prezzo_target ?? null,
      dati.nota ?? null,
      id,
    );
    res.json({ aggiornato: id });
  } catch (e) {
    next(e);
  }
});

watchlistRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const esiste = db.prepare('SELECT id FROM watchlist WHERE id = ?').get(id);
    if (!esiste) throw nonTrovato(`Voce watchlist ${id}`);
    db.prepare('DELETE FROM watchlist WHERE id = ?').run(id);
    res.json({ eliminato: id });
  } catch (e) {
    next(e);
  }
});
