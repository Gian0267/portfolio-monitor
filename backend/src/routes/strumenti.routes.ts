import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adessoIso } from '../lib/date.js';
import { nonTrovato, richiestaNonValida } from '../lib/errori.js';
import { datiMercato } from '../providers/index.js';
import { calcolaPosizione } from '../services/posizioni.service.js';
import {
  aggiornaQuotazione,
  quotazioneInCache,
  storicoStrumento,
} from '../services/quotazioni.service.js';
import type { RigaStrumento, RigaTransazione } from '../tipi.js';

export const strumentiRouter = Router();

const schemaStrumento = z.object({
  simbolo: z.string().trim().min(1, 'Il simbolo e obbligatorio').toUpperCase(),
  isin: z.string().trim().max(12).optional().nullable(),
  nome: z.string().trim().min(1, 'Il nome e obbligatorio'),
  tipo: z.enum(['AZIONE', 'ETF', 'FONDO', 'OBBLIGAZIONE', 'CRYPTO', 'ALTRO']).default('AZIONE'),
  valuta: z.string().trim().length(3).toUpperCase().default('EUR'),
  borsa: z.string().trim().optional().nullable(),
  paese: z.string().trim().optional().nullable(),
  settore: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

function leggiStrumento(id: number): RigaStrumento {
  const s = db.prepare('SELECT * FROM strumento WHERE id = ?').get(id) as
    | RigaStrumento
    | undefined;
  if (!s) throw nonTrovato(`Strumento ${id}`);
  return s;
}

/** Elenco completo con posizione e ultima quotazione in cache. */
strumentiRouter.get('/', (_req, res) => {
  const strumenti = db
    .prepare('SELECT * FROM strumento ORDER BY nome COLLATE NOCASE')
    .all() as RigaStrumento[];

  res.json(
    strumenti.map((s) => ({
      ...s,
      posizione: calcolaPosizione(s.id),
      quotazione: quotazioneInCache(s.id),
    })),
  );
});

/**
 * Ricerca simboli sui provider. Registrata prima di "/:id" perche' in Express
 * vince la prima rotta che combacia e "/ricerca" sarebbe catturata da ":id".
 */
strumentiRouter.get('/ricerca', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) throw richiestaNonValida('Inserisci almeno 2 caratteri da cercare.');
    res.json(await datiMercato.ricerca(q));
  } catch (e) {
    next(e);
  }
});

strumentiRouter.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const strumento = leggiStrumento(id);
    const transazioni = db
      .prepare('SELECT * FROM transazione WHERE strumento_id = ? ORDER BY data DESC, id DESC')
      .all(id) as RigaTransazione[];

    res.json({
      ...strumento,
      posizione: calcolaPosizione(id),
      quotazione: quotazioneInCache(id),
      transazioni,
    });
  } catch (e) {
    next(e);
  }
});

/** Serie storica dei prezzi (scarica dal provider e mette in cache). */
strumentiRouter.get('/:id/storico', async (req, res, next) => {
  try {
    const strumento = leggiStrumento(Number(req.params.id));
    const giorni = Math.min(Math.max(Number(req.query.giorni ?? 365), 7), 3650);
    res.json({
      simbolo: strumento.simbolo,
      valuta: strumento.valuta,
      punti: await storicoStrumento(strumento, giorni),
    });
  } catch (e) {
    next(e);
  }
});

strumentiRouter.post('/:id/aggiorna-quotazione', async (req, res, next) => {
  try {
    res.json(await aggiornaQuotazione(leggiStrumento(Number(req.params.id))));
  } catch (e) {
    next(e);
  }
});

strumentiRouter.post('/', (req, res, next) => {
  try {
    const dati = schemaStrumento.parse(req.body);
    const esistente = db
      .prepare('SELECT id FROM strumento WHERE simbolo = ?')
      .get(dati.simbolo) as { id: number } | undefined;
    if (esistente) {
      throw richiestaNonValida(
        `Il simbolo ${dati.simbolo} e gia presente in portafoglio (id ${esistente.id}).`,
      );
    }

    const ora = adessoIso();
    const info = db
      .prepare(
        `INSERT INTO strumento (simbolo, isin, nome, tipo, valuta, borsa, paese, settore, note, creato_il, aggiornato_il)
         VALUES (@simbolo, @isin, @nome, @tipo, @valuta, @borsa, @paese, @settore, @note, @creato_il, @aggiornato_il)`,
      )
      .run({
        ...dati,
        isin: dati.isin ?? null,
        borsa: dati.borsa ?? null,
        paese: dati.paese ?? null,
        settore: dati.settore ?? null,
        note: dati.note ?? null,
        creato_il: ora,
        aggiornato_il: ora,
      });

    res.status(201).json(leggiStrumento(Number(info.lastInsertRowid)));
  } catch (e) {
    next(e);
  }
});

strumentiRouter.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    leggiStrumento(id);
    const dati = schemaStrumento.partial().parse(req.body);

    const campi = Object.keys(dati) as Array<keyof typeof dati>;
    if (campi.length === 0) throw richiestaNonValida('Nessun campo da aggiornare.');

    const set = campi.map((c) => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE strumento SET ${set}, aggiornato_il = @aggiornato_il WHERE id = @id`).run({
      ...dati,
      id,
      aggiornato_il: adessoIso(),
    });

    res.json(leggiStrumento(id));
  } catch (e) {
    next(e);
  }
});

/** La cancellazione porta via transazioni, quotazioni e storico (ON DELETE CASCADE). */
strumentiRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    leggiStrumento(id);
    db.prepare('DELETE FROM strumento WHERE id = ?').run(id);
    res.json({ eliminato: id });
  } catch (e) {
    next(e);
  }
});
