import { useState } from 'react';
import { Home, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useHouseData } from '../hooks/useHouse';
import { houseApi } from '../services/api';
import ExportButton from '../components/shared/ExportButton';
import KpiCard from '../components/shared/KpiCard';
import type { HouseBankTransaction } from '../interfaces/models';

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const SOURCE_LABELS: Record<string, string> = {
  otsar_hahayal: 'אוצר החייל',
  isracard: 'ישראכרט',
  diners: 'כאל/דיינרס',
};

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export default function HousePage() {
  const { selectedMonth, selectedYear } = useStore();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useHouseData(selectedMonth, selectedYear);

  const transactions: HouseBankTransaction[] = data?.transactions ?? [];
  const byCategory = data?.byCategory ?? [];
  const total = data?.total ?? 0;

  const visibleTransactions = selectedCategory
    ? transactions.filter(t => t.category?.name === selectedCategory)
    : transactions;

  const noData = !isLoading && transactions.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">תקציב בית</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        <ExportButton onExport={houseApi.export} />
      </div>

      {/* KPI */}
      <KpiCard
        title="סה״כ הוצאות בית החודש"
        value={formatCurrency(total)}
        icon={Home}
        color="blue"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
          <div className="lg:col-span-2 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        </div>
      ) : noData ? (
        <div className="card text-center py-14 text-gray-400 space-y-4">
          <Home size={44} className="mx-auto opacity-25" />
          <p className="text-base font-medium">אין נתוני בית לחודש זה</p>
          <p className="text-sm">ייבא קובץ מהבנק כדי לראות הוצאות בית</p>
          <button
            onClick={() => navigate('/bank')}
            className="btn-primary mx-auto"
          >
            <Upload size={16} />
            ייבוא מהבנק
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left — category breakdown */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">לפי קטגוריה</h3>
            {byCategory.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(prev => prev === cat.name ? null : cat.name)}
                className={`w-full text-right p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedCategory === cat.name
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.count} תנועות</p>
                </div>
                <span className="text-sm font-bold" style={{ color: cat.color }}>
                  {formatCurrency(cat.total)}
                </span>
              </button>
            ))}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-blue-600 hover:underline w-full text-center pt-1"
              >
                הצג הכל
              </button>
            )}
          </div>

          {/* Right — transaction list */}
          <div className="lg:col-span-2 card p-0">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {selectedCategory ? `${selectedCategory} — ` : ''}רשימת תנועות ({visibleTransactions.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl flex-shrink-0">
                    {tx.category?.icon ?? '🏠'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                      <span className="badge bg-gray-100 text-gray-600 text-xs">
                        {SOURCE_LABELS[tx.source] ?? tx.source}
                      </span>
                      {tx.category && (
                        <span
                          className="badge text-xs"
                          style={{ backgroundColor: tx.category.color + '22', color: tx.category.color }}
                        >
                          {tx.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600 flex-shrink-0">
                    {formatCurrency(Math.abs(tx.chargedAmount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
