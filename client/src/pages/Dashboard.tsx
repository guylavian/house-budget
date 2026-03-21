import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from 'recharts';
import { Wallet, CreditCard, Home, PiggyBank, TrendingUp, Plus, Users } from 'lucide-react';
import BankImportButton from '../components/shared/BankImportButton';
import { useStore } from '../store/useStore';
import { dashboardApi } from '../services/api';
import KpiCard from '../components/shared/KpiCard';
import Modal from '../components/shared/Modal';
import { useCreateExpense } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useExpenses';
import { useByOwner } from '../hooks/useBank';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const PIE_COLORS = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626',
  '#7C3AED', '#DB2777', '#0891B2', '#65A30D',
];

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const QuickExpenseSchema = z.object({
  categoryId: z.string().min(1, 'בחר קטגוריה'),
  amount: z.string().min(1).transform(Number).pipe(z.number().positive('סכום חייב להיות חיובי')),
  description: z.string().min(1, 'הכנס תיאור'),
  date: z.string().min(1, 'בחר תאריך'),
  paymentType: z.enum(['credit', 'debit', 'cash']),
});

type QuickExpenseFormData = z.input<typeof QuickExpenseSchema>;

function QuickAddExpenseForm({ onClose }: { onClose: () => void }) {
  const { data: categories } = useCategories();
  const createExpense = useCreateExpense();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuickExpenseFormData>({
    resolver: zodResolver(QuickExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      paymentType: 'credit',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    await createExpense.mutateAsync({
      categoryId: data.categoryId,
      amount: Number(data.amount),
      description: data.description,
      date: data.date,
      paymentType: data.paymentType,
      isRecurring: false,
    });
    onClose();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">קטגוריה</label>
        <select {...register('categoryId')} className="input">
          <option value="">בחר קטגוריה</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="error-text">{errors.categoryId.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">סכום (₪)</label>
        <input type="number" step="0.01" min="0" {...register('amount')} className="input" placeholder="0.00" />
        {errors.amount && <p className="error-text">{errors.amount.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">תיאור</label>
        <input type="text" {...register('description')} className="input" placeholder="תיאור ההוצאה" />
        {errors.description && <p className="error-text">{errors.description.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">תאריך</label>
        <input type="date" {...register('date')} className="input" />
        {errors.date && <p className="error-text">{errors.date.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">אמצעי תשלום</label>
        <select {...register('paymentType')} className="input">
          <option value="credit">אשראי</option>
          <option value="debit">דביט</option>
          <option value="cash">מזומן</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
        <button type="submit" disabled={createExpense.isPending} className="btn-primary">
          {createExpense.isPending ? 'שומר...' : 'הוסף הוצאה'}
        </button>
      </div>
    </form>
  );
}

type DataSource = 'all' | 'manual' | 'bank';

const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  all: 'הכל',
  manual: 'ידני בלבד',
  bank: 'בנק בלבד',
};

export default function Dashboard() {
  const { selectedMonth, selectedYear } = useStore();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('all');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard', selectedMonth, selectedYear],
    queryFn: () => dashboardApi.getSummary(selectedMonth, selectedYear),
  });

  const { data: byOwnerData } = useByOwner(selectedMonth, selectedYear);
  const hasNamedOwners = (byOwnerData?.breakdown ?? []).some((r: { name: string }) => r.name !== 'לא ידוע');

  const trendData = summary
    ? summary.last6MonthsIncome.map((inc, i) => ({
        name: MONTH_NAMES[inc.month - 1],
        הכנסות: inc.total,
        הוצאות: summary.last6MonthsExpenses[i]?.total ?? 0,
      }))
    : [];

  const pieData = summary?.expensesByCategory
    .filter((c) => c.total > 0)
    .map((c) => ({ name: c.categoryName, value: c.total })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">לוח בקרה</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            className="input py-1.5 text-sm"
            value={dataSource}
            onChange={e => setDataSource(e.target.value as DataSource)}
          >
            {(Object.keys(DATA_SOURCE_LABELS) as DataSource[]).map(k => (
              <option key={k} value={k}>{DATA_SOURCE_LABELS[k]}</option>
            ))}
          </select>
          <BankImportButton />
          <button onClick={() => setShowQuickAdd(true)} className="btn-primary">
            <Plus size={16} />
            הוצאה מהירה
          </button>
        </div>
      </div>

      {/* Unclassified bank transactions warning */}
      {summary?.hasUnclassified && (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
          <span className="text-yellow-800">⚠️ יש תנועות בנק לא מסווגות שמשפיעות על הנתונים — עבור להוצאות לסיווג</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="סה״כ הכנסות"
          value={isLoading ? '...' : formatCurrency(summary?.totalIncome ?? 0)}
          icon={Wallet}
          color="blue"
        />
        <KpiCard
          title="סה״כ הוצאות"
          value={isLoading ? '...' : formatCurrency(summary?.totalExpenses ?? 0)}
          icon={CreditCard}
          color="red"
        />
        <KpiCard
          title="הוצאות בית"
          value={isLoading ? '...' : formatCurrency(summary?.houseTotal ?? 0)}
          icon={Home}
          color="orange"
        />
        <KpiCard
          title="חיסכון החודש"
          value={isLoading ? '...' : formatCurrency(summary?.savingsDeposited ?? 0)}
          subtitle={summary ? `${summary.savingsRate.toFixed(1)}% מההכנסה` : undefined}
          icon={PiggyBank}
          color="green"
        />
        <KpiCard
          title="יתרה נטו"
          value={isLoading ? '...' : formatCurrency(summary?.netBalance ?? 0)}
          icon={TrendingUp}
          color={(summary?.netBalance ?? 0) >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">הכנסות מול הוצאות - 6 חודשים אחרונים</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₪${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="הכנסות" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="הוצאות" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">הוצאות לפי קטגוריה</h3>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              אין נתונים לחודש זה
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <PieTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {pieData.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-600 truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Owner breakdown card */}
      {hasNamedOwners && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">הוצאות לפי בעלים</h3>
          </div>
          <div className="space-y-2.5">
            {(byOwnerData.breakdown as { name: string; total: number }[]).map((row) => {
              const pct = byOwnerData.total > 0 ? (row.total / byOwnerData.total) * 100 : 0;
              const isUnknown = row.name === 'לא ידוע';
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${isUnknown ? 'text-gray-400' : 'text-gray-800'}`}>
                      {isUnknown ? '❓ ' : '👤 '}{row.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className={`text-sm font-semibold ${isUnknown ? 'text-gray-400' : 'text-red-600'}`}>
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${isUnknown ? 'bg-gray-300' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        title="הוספת הוצאה מהירה"
        size="sm"
      >
        <QuickAddExpenseForm onClose={() => setShowQuickAdd(false)} />
      </Modal>
    </div>
  );
}
