/**
 * Scarica le quotazioni correnti di tutti gli strumenti e salva la fotografia
 * giornaliera del portafoglio. Pensato per essere richiamato da cron/Utilita'
 * di pianificazione quando il server non e' sempre acceso.
 *
 * Uso: npm run aggiorna-quotazioni [-- --storico]
 *      --storico scarica anche 2 anni di prezzi storici (serve una volta sola,
 *      per avere subito il grafico di andamento popolato).
 */
import { db } from '../src/db/index.js';
import {
  aggiornaTutteLeQuotazioni,
  storicoStrumento,
} from '../src/services/quotazioni.service.js';
import { salvaSnapshotOdierno } from '../src/services/portafoglio.service.js';
import type { RigaStrumento } from '../src/tipi.js';

const conStorico = process.argv.includes('--storico');

const esito = await aggiornaTutteLeQuotazioni();
console.log(`Quotazioni aggiornate: ${esito.aggiornati} (in ${esito.durataMs} ms)`);
for (const f of esito.falliti) console.log(`  ! ${f.simbolo}: ${f.errore}`);

if (conStorico) {
  const strumenti = db.prepare('SELECT * FROM strumento ORDER BY simbolo').all() as RigaStrumento[];
  console.log(`\nScarico lo storico di ${strumenti.length} strumenti (2 anni)...`);
  for (const s of strumenti) {
    const punti = await storicoStrumento(s, 730);
    console.log(`  ${s.simbolo}: ${punti.length} giorni in cache`);
  }
}

await salvaSnapshotOdierno();
console.log('\nFotografia odierna del portafoglio salvata.');

if (esito.falliti.length > 0) {
  console.log(
    '\nSuggerimento: se tutti i simboli falliscono, controlla la connessione o ' +
      'imposta TWELVEDATA_API_KEY nel file .env per attivare il fallback.',
  );
}
