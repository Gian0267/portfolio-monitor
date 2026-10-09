-- ============================================================
-- Portfolio Monitor - schema SQLite
-- Tutti gli importi sono memorizzati nella valuta indicata dal
-- record stesso; la conversione nella valuta base avviene a runtime.
-- ============================================================

PRAGMA foreign_keys = ON;

-- Anagrafica strumenti (azioni, ETF, fondi, obbligazioni, crypto)
CREATE TABLE IF NOT EXISTS strumento (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  simbolo       TEXT    NOT NULL UNIQUE,   -- formato Yahoo: AAPL, ENI.MI, VWCE.DE
  isin          TEXT,
  nome          TEXT    NOT NULL,
  tipo          TEXT    NOT NULL DEFAULT 'AZIONE'
                        CHECK (tipo IN ('AZIONE','ETF','FONDO','OBBLIGAZIONE','CRYPTO','ALTRO')),
  valuta        TEXT    NOT NULL DEFAULT 'EUR',
  borsa         TEXT,
  paese         TEXT,
  settore       TEXT,
  note          TEXT,
  creato_il     TEXT    NOT NULL,
  aggiornato_il TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strumento_isin ON strumento(isin);
CREATE INDEX IF NOT EXISTS idx_strumento_tipo ON strumento(tipo);

-- Movimenti: le posizioni sono SEMPRE derivate da qui, non memorizzate.
CREATE TABLE IF NOT EXISTS transazione (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strumento_id  INTEGER NOT NULL REFERENCES strumento(id) ON DELETE CASCADE,
  tipo          TEXT    NOT NULL
                        CHECK (tipo IN ('ACQUISTO','VENDITA','DIVIDENDO','COMMISSIONE','SPLIT')),
  data          TEXT    NOT NULL,            -- YYYY-MM-DD
  quantita      REAL    NOT NULL DEFAULT 0,  -- per SPLIT = rapporto (es. 4 = 4:1)
  prezzo        REAL    NOT NULL DEFAULT 0,  -- prezzo unitario nella valuta della transazione
  commissioni   REAL    NOT NULL DEFAULT 0,
  tasse         REAL    NOT NULL DEFAULT 0,
  valuta        TEXT    NOT NULL DEFAULT 'EUR',
  cambio        REAL,                        -- cambio valuta->base al giorno dell'operazione
  note          TEXT,
  creato_il     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transazione_strumento ON transazione(strumento_id, data);
CREATE INDEX IF NOT EXISTS idx_transazione_data ON transazione(data);

-- Cache dell'ultima quotazione nota per strumento
CREATE TABLE IF NOT EXISTS quotazione (
  strumento_id           INTEGER PRIMARY KEY REFERENCES strumento(id) ON DELETE CASCADE,
  prezzo                 REAL NOT NULL,
  valuta                 TEXT NOT NULL,
  chiusura_precedente    REAL,
  variazione_assoluta    REAL,
  variazione_percentuale REAL,
  mercato_aperto         INTEGER NOT NULL DEFAULT 0,
  fonte                  TEXT NOT NULL,
  aggiornato_il          TEXT NOT NULL
);

-- Serie storica dei prezzi di chiusura (per i grafici e la ricostruzione storica)
CREATE TABLE IF NOT EXISTS prezzo_storico (
  strumento_id INTEGER NOT NULL REFERENCES strumento(id) ON DELETE CASCADE,
  data         TEXT    NOT NULL,
  chiusura     REAL    NOT NULL,
  PRIMARY KEY (strumento_id, data)
);

-- Tassi di cambio giornalieri (coppia: "USD/EUR")
CREATE TABLE IF NOT EXISTS cambio (
  coppia TEXT NOT NULL,
  data   TEXT NOT NULL,
  tasso  REAL NOT NULL,
  fonte  TEXT NOT NULL DEFAULT 'manuale',
  PRIMARY KEY (coppia, data)
);

-- Strumenti osservati ma non posseduti
CREATE TABLE IF NOT EXISTS watchlist (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strumento_id  INTEGER NOT NULL UNIQUE REFERENCES strumento(id) ON DELETE CASCADE,
  prezzo_target REAL,
  nota          TEXT,
  creato_il     TEXT NOT NULL
);

-- Soglie di prezzo
CREATE TABLE IF NOT EXISTS alert (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  strumento_id INTEGER NOT NULL REFERENCES strumento(id) ON DELETE CASCADE,
  condizione   TEXT    NOT NULL
                       CHECK (condizione IN ('SOPRA','SOTTO','VAR_PERC_SOPRA','VAR_PERC_SOTTO')),
  valore       REAL    NOT NULL,
  attivo       INTEGER NOT NULL DEFAULT 1,
  scattato_il  TEXT,
  prezzo_scatto REAL,
  creato_il    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_attivo ON alert(attivo);

-- Fotografia giornaliera del portafoglio, alimenta il grafico di andamento
CREATE TABLE IF NOT EXISTS snapshot_portafoglio (
  data              TEXT PRIMARY KEY,
  valore_mercato    REAL NOT NULL,
  costo             REAL NOT NULL,
  pl_non_realizzato REAL NOT NULL,
  valuta_base       TEXT NOT NULL,
  creato_il         TEXT NOT NULL
);

-- Preferenze applicative modificabili da UI
CREATE TABLE IF NOT EXISTS impostazione (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL
);
