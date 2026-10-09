import { Link } from 'react-router-dom';
import { Card } from '../components/Ui.tsx';

export function NonTrovato() {
  return (
    <Card>
      <div className="py-12 text-center">
        <p className="text-4xl font-semibold text-slate-300">404</p>
        <p className="mt-2 text-sm font-medium text-slate-700">Pagina non trovata</p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Torna alla dashboard
        </Link>
      </div>
    </Card>
  );
}
