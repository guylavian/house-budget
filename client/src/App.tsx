import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppShell from './components/layout/AppShell';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const HousePage = lazy(() => import('./pages/HousePage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/salary" element={<SalaryPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/house" element={<HousePage />} />
          <Route path="/savings" element={<SavingsPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
