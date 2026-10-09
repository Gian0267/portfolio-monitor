import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Dialogo centrato: chiusura con Esc o click sullo sfondo. */
export function Modale({
  titolo,
  descrizione,
  aperto,
  onChiudi,
  children,
  largo = false,
}: {
  titolo: string;
  descrizione?: string;
  aperto: boolean;
  onChiudi: () => void;
  children: ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    if (!aperto) return;
    const gestisci = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi();
    };
    document.addEventListener('keydown', gestisci);
    // Evita che la pagina sotto scorra mentre il dialogo e' aperto.
    const overflowPrecedente = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', gestisci);
      document.body.style.overflow = overflowPrecedente;
    };
  }, [aperto, onChiudi]);

  if (!aperto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onChiudi}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        className={`relative my-8 w-full rounded-xl bg-white shadow-xl ${largo ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titolo}</h2>
            {descrizione && <p className="mt-0.5 text-sm text-slate-500">{descrizione}</p>}
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
