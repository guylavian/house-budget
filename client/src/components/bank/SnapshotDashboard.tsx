import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { AlertCircle, AlertTriangle, X, Wallet, CreditCard, PiggyBank, TrendingUp, Users } from 'lucide-react';
import useBankByOwner, {useBankSnapshot} from '../../hooks/useBank';
import { useCategories } from '../../hooks/useConfig';
import KpiCard from '../shared/KpiCard';
import type { Snapshot, BankTransaction, Category } from '../../interfaces/bank';
import { formatILS, formatDate } from '../../utils/format';

interface Props {
  month: number;
  year: number;
  onShowUncategorized?: () => void;
}

function CircularProgress({ pct, color }: { pct: number; color: string }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PieCenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="font-bold" fontSize={13} fill="#111827">
      {formatILS(total)}
    </text>
  );
}

export default function SnapshotDashboard({ month, year, onShowUncategorized }: Props) {
  const { data: snapshotRaw, isLoading } = useBankSnapshot(month, year);
  const { data: byOwnerRaw } = useBankByOwner(month, year);
  const { data: categoriesRaw } = useCategories();
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);

  const snapshot: Snapshot | null = snapshotRaw ?? null;
  const categories: Category[] = categoriesRaw ?? [];

  const getCategoryForTx = (tx: BankTransaction) =>
    tx.categoryId ? categories.find(c => c._id === tx.categoryId) : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
        <div className="h-64 skeleton rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 skeleton rounded-xl" />
          <div className="h-72 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <TrendingUp size={32} className="text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">אין נתונים לחודש זה</p>
        <p className="text-gray-400 text-sm">ייבא קובץ מהבנק כדי לראות תמונת מצב</p>
      </div>
    );
  }

  const incomeDelta = snapshot.previousMonth.incomeDelta;
  const expenseDelta = snapshot.previousMonth.expenseDelta;

  // Bar chart data
  const barData = [
    {
      name: 'חודש קודם',
      הכנסות: snapshot.previousMonth.income,
      הוצאות: snapshot.previousMonth.expenses,
    },
    {
      name: 'חודש נוכחי',
      הכנסות: snapshot.income.total,
      הוצאות: snapshot.expenses.total,
    },
  ];

  const visibleAlerts = snapshot.alerts.filter((_, i) => !dismissedAlerts.includes(i));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="הכנסות"
          value={formatILS(snapshot.income.total)}
          icon={Wallet}
          color="green"
          trend={incomeDelta !== undefined ? { value: Math.abs(incomeDelta), positive: incomeDelta >= 0 } : undefined}
        />
        <KpiCard
          title="הוצאות"
          value={formatILS(snapshot.expenses.total)}
          icon={CreditCard}
          color="red"
          trend={expenseDelta !== undefined ? { value: Math.abs(expenseDelta), positive: expenseDelta <= 0 } : undefined}
        />
        <KpiCard
          title="חיסכון"
          value={formatILS(snapshot.savings.total)}
          subtitle={`${snapshot.savingsRate.toFixed(1)}% מההכנסות`}
          icon={PiggyBank}
          color="blue"
        />
        <KpiCard
          title="יתרה נטו"
          value={formatILS(snapshot.netBalance)}
          icon={TrendingUp}
          color={snapshot.netBalance >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Alerts */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {snapshot.alerts.map((alert, i) => {
            if (dismissedAlerts.includes(i)) return null;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  alert.severity === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                {alert.severity === 'error' ? (
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                )}
                <p className={`flex-1 text-sm font-medium ${alert.severity === 'error' ? 'text-red-800' : 'text-yellow-800'}`}>
                  {alert.message}
                </p>
                <button
                  onClick={() => setDismissedAlerts(prev => [...prev, i])}
                  className={`p-1 rounded-lg transition-colors ${
                    alert.severity === 'error' ? 'hover:bg-red-100 text-red-400' : 'hover:bg-yellow-100 text-yellow-400'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart — expenses by category */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">הוצאות לפי קטגוריה</h3>
          {snapshot.expenses.breakdown.length === 0 ? (
            <p className="text-gray-400 text-center py-8">אין נתונים</p>
          ) : (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={snapshot.expenses.breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="amount"
                    nameKey="name"
                  >
                    {snapshot.expenses.breakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                    {/* Center label using custom label position */}
                    <PieCenterLabel
                      cx={0}
                      cy={0}
                      total={snapshot.expenses.total}
                    />
                  </Pie>
                  <Tooltip formatter={(v: number) => formatILS(v)} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <ul className="mt-3 space-y-1.5" dir="rtl">
                {snapshot.expenses.breakdown.map((item) => (
                  <li key={item.categoryId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700">{item.name}</span>
                      {item.overBudget && <span className="text-yellow-500 text-xs">⚠️</span>}
                    </div>
                    <span className="font-medium text-gray-900">{formatILS(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bar chart — previous vs current month */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">הכנסות vs הוצאות — חודש קודם vs חודש נוכחי</h3>
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₪${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatILS(v)} />
                <Legend />
                <Bar dataKey="הכנסות" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="הוצאות" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Merchants */}
      {snapshot.topMerchants.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">חמשת המקומות המובילים</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b border-gray-100">
                <th className="pb-2 text-gray-500 font-medium">מקום</th>
                <th className="pb-2 text-gray-500 font-medium">סה&quot;כ</th>
                <th className="pb-2 text-gray-500 font-medium">עסקאות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {snapshot.topMerchants.slice(0, 5).map((m, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-gray-800">{m.description}</td>
                  <td className="py-2.5 font-medium text-red-600">{formatILS(m.total)}</td>
                  <td className="py-2.5 text-gray-500">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-person breakdown */}
      {byOwnerRaw?.breakdown?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">הוצאות לפי אדם</h3>
          </div>
          <div className="space-y-3">
            {byOwnerRaw.breakdown.map((row: { name: string; total: number }) => {
              const pct = byOwnerRaw.total > 0 ? (row.total / byOwnerRaw.total) * 100 : 0;
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{row.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-red-600">{formatILS(row.total)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-red-400 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Savings Goals */}
      {snapshot.savings.goals.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">יעדי חיסכון</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {snapshot.savings.goals.map(goal => (
              <div
                key={goal.id}
                className="flex-shrink-0 w-44 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 bg-gray-50"
              >
                <span className="text-2xl">{goal.icon}</span>
                <p className="text-sm font-medium text-gray-800 text-center">{goal.name}</p>
                <div className="relative flex items-center justify-center">
                  <CircularProgress pct={goal.progressPct} color={goal.color} />
                  <span className="absolute text-xs font-bold text-gray-800">
                    {Math.round(goal.progressPct)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {formatILS(goal.current)} מתוך {formatILS(goal.target)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncategorized panel */}
      {snapshot.uncategorized.count > 0 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">
                {snapshot.uncategorized.count} תנועות ממתינות לסיווג
              </h3>
            </div>
            {onShowUncategorized && (
              <button
                onClick={onShowUncategorized}
                className="text-sm text-yellow-700 hover:text-yellow-900 font-medium underline"
              >
                ראה הכל
              </button>
            )}
          </div>
          <div className="space-y-2">
            {snapshot.uncategorized.transactions.slice(0, 5).map(tx => {
              const cat = getCategoryForTx(tx);
              return (
                <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-yellow-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800">{tx.description}</span>
                    {tx.date && (
                      <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">{formatILS(Math.abs(tx.chargedAmount))}</span>
                    {cat && (
                      <span
                        className="badge text-xs"
                        style={{ backgroundColor: cat.color + '22', color: cat.color }}
                      >
                        {cat.icon} {cat.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
