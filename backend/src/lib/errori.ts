/** Errore con codice HTTP, gestito dal middleware finale di Express. */
export class ErroreHttp extends Error {
  constructor(
    readonly stato: number,
    message: string,
    readonly dettagli?: unknown,
  ) {
    super(message);
    this.name = 'ErroreHttp';
  }
}

export const nonTrovato = (cosa: string) => new ErroreHttp(404, `${cosa} non trovato`);
export const richiestaNonValida = (msg: string, dettagli?: unknown) =>
  new ErroreHttp(400, msg, dettagli);
