import { Router } from 'express';
import { z } from 'zod';
import { db, valutaBase } from '../db/index.js';
import { adessoIso, normalizzaData } from '../lib/date.js';
import { nonTrovato, richiestaNonValida } from '../lib/errori.js';
import { tassoAllaData } from '../services/cambi.service.js';
import { esportaTransazioniCsv, importaTransazioniCsv } from '../services/csv.service.js';
import type { RigaStrumento, RigaTransazione } from '../tipi.js';

export const transazioniRouter = Router();

const schemaTransazione = z.object({
  strumento_id: z.coerce.number().int().positive(),
  tipo: z.enum(['ACQUISTO', 'VENDITA', 'DIVIDENDO', 'COMMISSIONE', 'SPLIT']),
  // z.coerce.date() si rompe su oggetti Date lato server: normalizziamo a mano.
  data: z.union([z.string(), z.date()]).transform((v) => normalizzaData(v)),
  quantita: z.coerce.number().min(0).default(0),
  prezzo: z.coerce.number().default(0),
  commissioni: z.coerce.number().min(0).default(0),
  tasse: z.coerce.number().min(0).default(0),
  valuta: z.string().trim().length(3).toUpperCase().optional(),
  note: z.string().trim().optional().nullable(),
});

function leggiTransazione(id: number): RigaTransazione {
  const t = db.prepare('SELECT * FROM transazione WHERE id = ?').get(id) as
    | RigaTransazione
    | undefined;
  if (!t) throw nonTrovato(`Transazione ${id}`);
  return t;
}

/** Elenco con filtri opzionali: strumento, tipo, intervallo di date. */
transazioniRouter.get('/', (req, res) => {
  const condizioni: string[] = [];
  const parametri: unknown[] = [];

  if (req.query.strumento_id) {
    condizioni.push('t.strumento_id = ?');
    parametri.push(Number(req.query.strumento_id));
  }
  if (req.query.tipo) {
    condizioni.push('t.tipo = ?');
    parametri.push(String(req.query.tipo).toUpperCase());
  }
  if (req.query.da) {
    condizioni.push('t.data >= ?');
    parametri.push(normalizzaData(String(req.query.da)));
  }
  if (req.query.a) {
    condizioni.push('t.data <= ?');
    parametri.push(normalizzaData(String(req.query.a)));
  }

  const where = condizioni.length ? `WHERE ${condizioni.join(' AND ')}` : '';
  const righe = db
    .prepare(
      `SELECT t.*, s.simbolo, s.nome AS strumento_nome, s.tipo AS strumento_tipo
         FROM transazione t
         JOIN strumento s ON s.id = t.strumento_id
         ${where}
        ORDER BY t.data DESC, t.id DESC`,
    )
    .all(...parametri);

  res.json(righe);
});

transazioniRouter.get('/export.csv', (_req, res) => {
  res
    .status(200)
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader('Content-Disposition', 'attachment; filename="transazioni.csv"')
    .send(esportaTransazioniCsv());
});

/**
 * Import CSV. Il corpo arriva come testo grezzo (middleware text/csv in app.ts),
 * oppure come { contenuto: "..." } in JSON.
 */
transazioniRouter.post('/import', (req, res, next) => {
  try {
    const contenuto =
      typeof req.body === 'string'
        ? req.body
        : typeof req.body?.contenuto === 'string'
          ? req.body.contenuto
          : '';
    if (!contenuto.trim()) {
      throw richiestaNonValida(
        'Corpo della richiesta vuoto: invia il CSV come testo o come campo "contenuto".',
      );
    }
    res.json(importaTransazioniCsv(contenuto));
  } catch (e) {
    next(e);
  }
});

transazioniRouter.post('/', async (req, res, next) => {
  try {
    const dati = schemaTransazione.parse(req.body);

    const strumento = db.prepare('SELECT * FROM strumento WHERE id = ?').get(dati.strumento_id) as
      | RigaStrumento
      | undefined;
    if (!strumento) throw nonTrovato(`Strumento ${dati.strumento_id}`);

    if (dati.tipo === 'SPLIT' && dati.quantita <= 0) {
      throw richiestaNonValida(
        'Per uno SPLIT indica il rapporto nel campo quantita (es. 4 per 4:1, 0.1 per 1:10).',
      );
    }
    if ((dati.tipo === 'ACQUISTO' || dati.tipo === 'VENDITA') && dati.quantita <= 0) {
      throw richiestaNonValida('La quantita deve essere maggiore di zero.');
    }

    const valuta = dati.valuta ?? strumento.valuta;

    // Registriamo il cambio del giorno dell'operazione: serve per gli storici
    // e resta immutabile anche se i tassi cambiano in futuro.
    let cambio: number | null = null;
    try {
      cambio = await tassoAllaData(valuta, valutaBase(), dati.data);
    } catch {
      cambio = null; // nessuna rete: il campo resta vuoto, non blocchiamo l'inserimento
    }

    const info = db
      .prepare(
        `INSERT INTO transazione (strumento_id, tipo, data, quantita, prezzo,
                                  commissioni, tasse, valuta, cambio, note, creato_il)
         VALUES (@strumento_id, @tipo, @data, @quantita, @prezzo,
                 @commissioni, @tasse, @valuta, @cambio, @note, @creato_il)`,
      )
      .run({
        ...dati,
        valuta,
        cambio,
        note: dati.note ?? null,
        creato_il: adessoIso(),
      });

    res.status(201).json(leggiTransazione(Number(info.lastInsertRowid)));
  } catch (e) {
    next(e);
  }
});

transazioniRouter.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    leggiTransazione(id);
    const dati = schemaTransazione.partial().parse(req.body);

    const campi = Object.keys(dati) as Array<keyof typeof dati>;
    if (campi.length === 0) throw richiestaNonValida('Nessun campo da aggiornare.');

    const set = campi.map((c) => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE transazione SET ${set} WHERE id = @id`).run({ ...dati, id });

    res.json(leggiTransazione(id));
  } catch (e) {
    next(e);
  }
});

transazioniRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    leggiTransazione(id);
    db.prepare('DELETE FROM transazione WHERE id = ?').run(id);
    res.json({ eliminato: id });
  } catch (e) {
    next(e);
  }
});
