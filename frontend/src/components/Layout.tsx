import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  Eye,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';

const VOCI = [
  { a: '/', etichetta: 'Dashboard', icona: LayoutDashboard },
  { a: '/portafoglio', etichetta: 'Portafoglio', icona: Wallet },
  { a: '/transazioni', etichetta: 'Transazioni', icona: ArrowLeftRight },
  { a: '/watchlist', etichetta: 'Watchlist', icona: Eye },
  { a: '/alert', etichetta: 'Alert', icona: Bell },
  { a: '/impostazioni', etichetta: 'Impostazioni', icona: Settings },
];

export function Layout() {
  const [menuAperto, setMenuAperto] = useState(false);
  const [aggiornamentoInCorso, setAggiornamentoInCorso] = useState(false);

  /**
   * Aggiorna i prezzi e ricarica la pagina: la ricarica e' voluta, cosi'
   * ogni vista riflette i nuovi dati senza gestione di stato globale.
   */
  async function aggiornaQuotazioni() {
    setAggiornamentoInCorso(true);
    const attesa = toast.loading('Aggiornamento quotazioni in corso…');
    try {
      const esito = await api.aggiornaTutto();
      toast.dismiss(attesa);
      if (esito.falliti.length === 0) {
        toast.success(`${esito.aggiornati} quotazioni aggiornate`);
      } else {
        toast.warning(
          `${esito.aggiornati} aggiornate, ${esito.falliti.length} non disponibili`,
          { description: esito.falliti.map((f) => f.simbolo).join(', ') },
        );
      }
      window.location.reload();
    } catch (e) {
      toast.dismiss(attesa);
      toast.error('Aggiornamento non riuscito', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAggiornamentoInCorso(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra superiore */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setMenuAperto((v) => !v)}
            aria-label={menuAperto ? 'Chiudi menu' : 'Apri menu'}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            {menuAperto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" aria-hidden />
            <span className="font-semibold text-slate-900">Portfolio Monitor</span>
          </div>

          <button
            type="button"
            onClick={aggiornaQuotazioni}
            disabled={aggiornamentoInCorso}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${aggiornamentoInCorso ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">Aggiorna prezzi</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Menu laterale: fisso da lg, a comparsa sotto */}
        <nav
          className={`fixed inset-y-14 left-0 z-20 w-60 border-r border-slate-200 bg-white p-3 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 ${
            menuAperto ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <ul className="space-y-1">
            {VOCI.map((v) => (
              <li key={v.a}>
                <NavLink
                  to={v.a}
                  end={v.a === '/'}
                  onClick={() => setMenuAperto(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <v.icona className="h-4 w-4" aria-hidden />
                  {v.etichetta}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {menuAperto && (
          <div
            className="fixed inset-0 top-14 z-10 bg-slate-900/20 lg:hidden"
            onClick={() => setMenuAperto(false)}
            aria-hidden
          />
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
