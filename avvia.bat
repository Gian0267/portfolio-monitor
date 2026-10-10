@echo off
REM ============================================================
REM   Portfolio Monitor - avvio su Windows
REM   Fai doppio clic su questo file. Non serve il Prompt dei comandi:
REM   al primo avvio installa quello che manca, poi apre il browser.
REM ============================================================

cd /d "%~dp0"

echo.
echo   Portfolio Monitor
echo   -----------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js non e' installato: e' il motore che fa girare l'app.
  echo.
  echo   Apro la pagina di download. Scarica la versione LTS,
  echo   installala, poi torna qui e rilancia questo file.
  echo.
  start "" "https://nodejs.org/it/download"
  pause
  exit /b 1
)

if not exist node_modules (
  echo   Primo avvio: installo i componenti necessari.
  echo   Ci vuole qualche minuto, succede una volta sola...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Installazione non riuscita. Controlla la connessione a internet.
    pause
    exit /b 1
  )
  echo.
)

if not exist .env (
  copy /y .env.example .env >nul
  echo   Creato il file di configurazione .env
)

echo   Avvio in corso. Il browser si apre fra qualche secondo.
echo.
echo   Per spegnere l'app: chiudi questa finestra, oppure premi Control+C.
echo.

REM Apre il browser con un po' di ritardo, il tempo che il server parta.
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start """" ""http://localhost:5173"""

call npm run dev
