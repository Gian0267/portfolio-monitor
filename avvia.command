#!/bin/bash
# ============================================================
#  Portfolio Monitor - avvio su macOS
#  Fai doppio clic su questo file. Non serve usare il Terminale:
#  al primo avvio installa quello che manca, poi apre il browser.
# ============================================================

# Lavora sempre nella cartella del progetto, non in quella da cui
# il Finder ha lanciato lo script.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Portfolio Monitor"
echo "  ─────────────────"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js non e' installato: e' il motore che fa girare l'app."
  echo ""
  echo "  Apro la pagina di download. Scarica la versione LTS,"
  echo "  installala, poi torna qui e rilancia questo file."
  echo ""
  open "https://nodejs.org/it/download"
  echo "  Premi Invio per chiudere."
  read -r
  exit 1
fi

versione=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$versione" -lt 20 ]; then
  echo "  Node.js $(node -v) e' troppo vecchio: serve la versione 20 o superiore."
  echo "  Aggiornalo da https://nodejs.org poi rilancia questo file."
  echo ""
  echo "  Premi Invio per chiudere."
  read -r
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Primo avvio: installo i componenti necessari."
  echo "  Ci vuole qualche minuto, succede una volta sola..."
  echo ""
  if ! npm install; then
    echo ""
    echo "  Installazione non riuscita. Controlla la connessione a internet."
    echo "  Premi Invio per chiudere."
    read -r
    exit 1
  fi
  echo ""
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Creato il file di configurazione .env"
fi

# Il browser si apre da solo quando il server e' pronto.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:5173"; then
      open "http://localhost:5173"
      exit 0
    fi
    sleep 1
  done
) &

echo "  Avvio in corso. Il browser si apre da solo tra qualche secondo."
echo ""
echo "  Per spegnere l'app: chiudi questa finestra, oppure premi Control+C."
echo ""

npm run dev
