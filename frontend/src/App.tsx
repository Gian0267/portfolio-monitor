import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Portafoglio } from './pages/Portafoglio.tsx';
import { DettaglioStrumento } from './pages/DettaglioStrumento.tsx';
import { Transazioni } from './pages/Transazioni.tsx';
import { Watchlist } from './pages/Watchlist.tsx';
import { Alert } from './pages/Alert.tsx';
import { Impostazioni } from './pages/Impostazioni.tsx';
import { NonTrovato } from './pages/NonTrovato.tsx';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="portafoglio" element={<Portafoglio />} />
        <Route path="strumenti/:id" element={<DettaglioStrumento />} />
        <Route path="transazioni" element={<Transazioni />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="alert" element={<Alert />} />
        <Route path="impostazioni" element={<Impostazioni />} />
        <Route path="*" element={<NonTrovato />} />
      </Route>
    </Routes>
  );
}
