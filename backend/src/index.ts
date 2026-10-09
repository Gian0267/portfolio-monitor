/**
 * Entry point. Registra i gestori di crash PRIMA di importare l'app, cosi'
 * anche un errore in fase di import finisce nei log invece di morire in silenzio.
 * Si stampa su stdout perche' molti runtime gestiti non mostrano stderr.
 */
process.on('uncaughtException', (e) => {
  console.log('[FATAL] uncaughtException:', e instanceof Error ? e.stack : e);
});
process.on('unhandledRejection', (e) => {
  console.log('[FATAL] unhandledRejection:', e instanceof Error ? e.stack : e);
});

await import('./app.js');
