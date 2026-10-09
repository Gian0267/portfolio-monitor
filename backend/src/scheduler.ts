import cron from 'node-cron';
import { config } from './config.js';
import { salvaSnapshotOdierno } from './services/portafoglio.service.js';
import { aggiornaTutteLeQuotazioni } from './services/quotazioni.service.js';

/**
 * Aggiornamento automatico quotazioni + fotografia giornaliera.
 * Di default gira alle 19:00 nei giorni lavorativi, a mercati europei chiusi.
 * Si disattiva lasciando CRON_AGGIORNAMENTO vuoto.
 */
export function avviaScheduler(): void {
  const espressione = config.cronAggiornamento.trim();
  if (!espressione) {
    console.log('[scheduler] disattivato (CRON_AGGIORNAMENTO vuoto).');
    return;
  }
  if (!cron.validate(espressione)) {
    console.log(`[scheduler] espressione cron non valida, scheduler disattivato: "${espressione}"`);
    return;
  }

  cron.schedule(espressione, async () => {
    console.log('[scheduler] aggiornamento quotazioni in corso...');
    try {
      const esito = await aggiornaTutteLeQuotazioni();
      await salvaSnapshotOdierno();
      console.log(
        `[scheduler] completato: ${esito.aggiornati} aggiornati, ` +
          `${esito.falliti.length} falliti in ${esito.durataMs} ms`,
      );
      for (const f of esito.falliti) console.log(`[scheduler] fallito ${f.simbolo}: ${f.errore}`);
    } catch (e) {
      console.log(`[scheduler] errore: ${e instanceof Error ? e.message : e}`);
    }
  });

  console.log(`[scheduler] attivo con cron "${espressione}"`);
}
