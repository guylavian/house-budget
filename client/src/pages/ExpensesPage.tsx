import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Tag, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { useBulkReclassify, useUpdateTransaction, useByOwner, useAiClassifyBatch, useAiApproveAll } from '../hooks/useBank';
import { useCardOwners } from '../hooks/useConfig';
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCreateCategory,
  useDeleteCategory,
} from '../hooks/useExpenses';
import { useCategories } from '../hooks/useConfig';
import type { Category } from '../interfaces/bank';
import { expensesApi } from '../services/api';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import ExportButton from '../components/shared/ExportButton';
import KpiCard from '../components/shared/KpiCard';
import BankImportButton from '../components/shared/BankImportButton';
import type { Expense, ExpenseRow, BankExpenseRow } from '../interfaces/models';
import { SOURCE_LABELS, SOURCE_COLORS } from '../utils/format';
import { CreditCard } from 'lucide-react';

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
}

const ExpenseSchema = z.object({
  categoryId: z.string().min(1, 'בחר קטגוריה'),
  amount: z.string().min(1).transform(Number).pipe(z.number().positive('סכום חייב להיות חיובי')),
  date: z.string().min(1, 'בחר תאריך'),
  description: z.string().min(1, 'הכנס תיאור'),
  isRecurring: z.boolean().default(false),
  paymentType: z.enum(['credit', 'debit', 'cash']),
  cardLast4: z.string().length(4).optional().or(z.literal('')),
});

type ExpenseFormData = z.input<typeof ExpenseSchema>;

const CategorySchema = z.object({
  name: z.string().min(1, 'הכנס שם קטגוריה'),
  icon: z.string().optional(),
});

type CategoryFormData = z.infer<typeof CategorySchema>;

function ExpenseForm({
  defaultValues,
  onSubmit,
  onClose,
  isPending,
}: {
  defaultValues?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const { data: categoriesData } = useCategories();
  const categories = (categoriesData ?? []) as Category[];
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: defaultValues ?? {
      date: new Date().toISOString().split('T')[0],
      paymentType: 'credit',
      isRecurring: false,
    },
  });

  const paymentType = watch('paymentType');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-group">
        <label className="label">קטגוריה</label>
        <select {...register('categoryId')} className="input">
          <option value="">בחר קטגוריה</option>
          {categories?.map((c) => (
            <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="error-text">{errors.categoryId.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">תיאור</label>
        <input type="text" {...register('description')} className="input" placeholder="תיאור ההוצאה" />
        {errors.description && <p className="error-text">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">סכום (₪)</label>
          <input type="number" step="0.01" min="0" {...register('amount')} className="input" placeholder="0.00" />
          {errors.amount && <p className="error-text">{errors.amount.message}</p>}
        </div>
        <div className="form-group">
          <label className="label">תאריך</label>
          <input type="date" {...register('date')} className="input" />
          {errors.date && <p className="error-text">{errors.date.message}</p>}
        </div>
      </div>

      <div className="form-group">
        <label className="label">אמצעי תשלום</label>
        <select {...register('paymentType')} className="input">
          <option value="credit">אשראי</option>
          <option value="debit">דביט</option>
          <option value="cash">מזומן</option>
        </select>
      </div>

      {paymentType === 'credit' && (
        <div className="form-group">
          <label className="label">4 ספרות כרטיס (אופציונלי)</label>
          <input type="text" maxLength={4} {...register('cardLast4')} className="input" placeholder="1234" />
          {errors.cardLast4 && <p className="error-text">{errors.cardLast4.message}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input type="checkbox" id="isRecurring" {...register('isRecurring')} className="w-4 h-4 text-blue-600 rounded" />
        <label htmlFor="isRecurring" className="text-sm text-gray-700">הוצאה חוזרת</label>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </form>
  );
}

export default function ExpensesPage() {
  const { selectedMonth, selectedYear } = useStore();
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterPayment, setFilterPayment] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showReclassifyConfirm, setShowReclassifyConfirm] = useState(false);
  const reclassifyBtnRef = useRef<HTMLButtonElement>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState('');

  const { data, isLoading } = useExpenses(selectedMonth, selectedYear, filterCategory);
  const { data: categoriesRaw } = useCategories();
  const { data: byOwnerData } = useByOwner(selectedMonth, selectedYear);
  const { data: cardOwners = [] } = useCardOwners();
  const categories = (categoriesRaw ?? []) as Category[];
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const qc = useQueryClient();
  const reclassify = useBulkReclassify();
  const updateTransaction = useUpdateTransaction();
  const aiClassifyBatch = useAiClassifyBatch();
  const aiApproveAll = useAiApproveAll();

  const startBankEdit = (e: BankExpenseRow) => {
    setEditingBankId(e.id as string);
    setPendingCategoryId(e.categoryId ?? '');
  };

  const handleBankSave = () => {
    if (!editingBankId) return;
    updateTransaction.mutate(
      { id: editingBankId, categoryId: pendingCategoryId },
      {
        onSuccess: () => {
          toast.success('קטגוריה עודכנה');
          qc.invalidateQueries({ queryKey: ['expenses'] });
          setEditingBankId(null);
        },
        onError: () => toast.error('שגיאה בעדכון קטגוריה'),
      }
    );
  };

  const handleReclassify = () => {
    reclassify.mutate(
      { reclassifyAll: true, month: selectedMonth, year: selectedYear },
      {
        onSuccess: (data: { updated: number }) => {
          toast.success(data.updated > 0
            ? `עודכנו ${data.updated} תנועות`
            : 'לא נמצאו תנועות לסיווג מחדש'
          );
          qc.invalidateQueries({ queryKey: ['expenses'] });
          setShowReclassifyConfirm(false);
        },
        onError: () => toast.error('שגיאה בסיווג מחדש'),
      }
    );
  };

  const {
    register: regCat,
    handleSubmit: handleCatSubmit,
    formState: { errors: catErrors },
    reset: resetCat,
  } = useForm<CategoryFormData>({ resolver: zodResolver(CategorySchema) });

  const handleExpenseSubmit = async (formData: ExpenseFormData) => {
    const payload = {
      categoryId: formData.categoryId,
      amount: Number(formData.amount),
      date: formData.date,
      description: formData.description,
      isRecurring: formData.isRecurring ?? false,
      paymentType: formData.paymentType as 'credit' | 'debit' | 'cash',
      cardLast4: formData.cardLast4 || null,
    };

    if (editingExpense) {
      await updateExpense.mutateAsync({ id: editingExpense.id, data: payload });
      setEditingExpense(null);
    } else {
      await createExpense.mutateAsync(payload);
      setShowAddModal(false);
    }
  };

  const handleAddCategory = handleCatSubmit(async (data) => {
    await createCategory.mutateAsync(data);
    resetCat();
    setShowCategoryModal(false);
  });

  // Build source → single-owner map for client-side owner resolution
  const sourceToOwner = new Map<string, string>();
  const sourceCardCounts = new Map<string, Set<string>>();
  for (const o of cardOwners) {
    if (!sourceCardCounts.has(o.source)) sourceCardCounts.set(o.source, new Set());
    sourceCardCounts.get(o.source)!.add(o.cardLast4);
  }
  for (const o of cardOwners) {
    const cardSet = sourceCardCounts.get(o.source)!;
    if (cardSet.size === 1) sourceToOwner.set(o.source, o.ownerName);
  }
  const cardOwnerMap = new Map(cardOwners.map(o => [`${o.source}:${o.cardLast4}`, o.ownerName]));

  const getRowOwner = (e: ExpenseRow): string | null => {
    const bank = e as BankExpenseRow;
    if (bank._type !== 'bank') return null;
    if (bank.cardLast4) return cardOwnerMap.get(`${bank.source}:${bank.cardLast4}`) ?? null;
    return sourceToOwner.get(bank.source) ?? null;
  };

  const filteredExpenses = (data?.expenses ?? []).filter((e) => {
    if (filterPayment && (e as BankExpenseRow)._type !== 'bank' && e.paymentType !== filterPayment) return false;
    if (filterOwner !== 'all') {
      const owner = getRowOwner(e);
      if (owner !== filterOwner) return false;
    }
    return true;
  });

  const hasNamedOwners = (byOwnerData?.breakdown ?? []).some((r: { name: string }) => r.name !== 'לא ידוע');

  const paymentLabel = (type: string) => {
    if (type === 'credit') return 'אשראי';
    if (type === 'debit') return 'דביט';
    return 'מזומן';
  };

  const columns = [
    {
      key: 'date',
      header: 'תאריך',
      render: (e: ExpenseRow) => format(new Date(e.date), 'dd/MM/yyyy'),
    },
    {
      key: 'category',
      header: 'קטגוריה',
      render: (e: ExpenseRow) => {
        if ((e as BankExpenseRow)._type === 'bank' && editingBankId === (e.id as string)) {
          return (
            <div className="flex items-center gap-1">
              <select
                value={pendingCategoryId}
                onChange={ev => setPendingCategoryId(ev.target.value)}
                className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                autoFocus
              >
                <option value="">ללא קטגוריה</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <button
                onClick={handleBankSave}
                disabled={updateTransaction.isPending}
                className="text-green-600 hover:text-green-800 font-bold text-sm leading-none"
                title="שמור"
              >✓</button>
              <button
                onClick={() => setEditingBankId(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none"
                title="בטל"
              >✗</button>
            </div>
          );
        }
        if ((e as BankExpenseRow)._type === 'bank') {
          return (
            <button
              onClick={() => startBankEdit(e as BankExpenseRow)}
              className="group flex items-center gap-1"
            >
              <span className="text-sm text-gray-700">
                {e.category ? `${(e.category as { icon?: string }).icon ?? ''} ${e.category.name}` : '❓ לא מסווג'}
              </span>
              <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
            </button>
          );
        }
        return e.category ? `${(e.category as { icon?: string }).icon ?? ''} ${e.category.name}` : '—';
      },
    },
    { key: 'description', header: 'תיאור', render: (e: ExpenseRow) => e.description },
    { key: 'amount', header: 'סכום', render: (e: ExpenseRow) => formatCurrency(Number(e.amount)) },
    {
      key: 'owner',
      header: 'בעלים',
      render: (e: ExpenseRow) => {
        const owner = getRowOwner(e);
        return owner
          ? <span className="text-sm font-medium text-gray-700">{owner}</span>
          : <span className="text-xs text-gray-300">—</span>;
      },
    },
    {
      key: 'source',
      header: 'מקור / תשלום',
      render: (e: ExpenseRow) => {
        if ((e as BankExpenseRow)._type === 'bank') {
          const bank = e as BankExpenseRow;
          return (
            <span className={`badge ${SOURCE_COLORS[bank.source] ?? 'bg-gray-100 text-gray-700'}`}>
              {SOURCE_LABELS[bank.source] ?? bank.source}
            </span>
          );
        }
        const manual = e as Expense;
        return (
          <span className={`badge ${manual.paymentType === 'credit' ? 'badge-blue' : manual.paymentType === 'debit' ? 'badge-yellow' : 'badge-green'}`}>
            {paymentLabel(manual.paymentType)}
          </span>
        );
      },
    },
    {
      key: 'confidence',
      header: 'סיווג',
      render: (e: ExpenseRow) => {
        if ((e as BankExpenseRow)._type === 'bank') {
          const bank = e as BankExpenseRow;
          if (bank.confidence === 'auto') return <span className="badge badge-green">אוטו</span>;
          if (bank.confidence === 'ai_suggested') return <span className="badge" style={{ backgroundColor: '#7C3AED22', color: '#7C3AED' }}>🤖 AI</span>;
          return <span className="badge badge-yellow">ידני</span>;
        }
        return <span className="badge badge-blue">ידני</span>;
      },
    },
    {
      key: 'actions',
      header: 'פעולות',
      render: (e: ExpenseRow) => {
        if ((e as BankExpenseRow)._type === 'bank') {
          return (
            <button
              onClick={() => startBankEdit(e as BankExpenseRow)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Pencil size={15} />
            </button>
          );
        }
        const manual = e as Expense;
        return (
          <div className="flex gap-2">
            <button onClick={() => setEditingExpense(manual)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={() => setDeletingId(manual.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  const barData = (data?.byCategory ?? []).map((c) => ({
    name: c.categoryName,
    סכום: c.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">הוצאות</h2>
          <p className="text-sm text-gray-500 mt-0.5">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BankImportButton />
          <div className="relative">
            <button
              ref={reclassifyBtnRef}
              onClick={() => setShowReclassifyConfirm(v => !v)}
              disabled={reclassify.isPending}
              className="btn-secondary"
            >
              <RefreshCw size={16} className={reclassify.isPending ? 'animate-spin' : ''} />
              {reclassify.isPending ? 'מסווג...' : 'סווג מחדש'}
            </button>
            {showReclassifyConfirm && (
              <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  סווג מחדש את כל התנועות הלא מסווגות של{' '}
                  <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowReclassifyConfirm(false)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleReclassify}
                    disabled={reclassify.isPending}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    סווג מחדש
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowCategoryModal(true)} className="btn-secondary">
            <Tag size={16} />
            קטגוריות
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={16} />
            הוסף הוצאה
          </button>
          <ExportButton onExport={expensesApi.export} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="סה״כ הוצאות"
          value={formatCurrency(data?.total ?? 0)}
          subtitle={
            data?.bankTotal
              ? `ידני: ${formatCurrency(data.manualTotal)} | בנק: ${formatCurrency(data.bankTotal)}`
              : undefined
          }
          icon={CreditCard}
          color="red"
        />
        {(data?.byCategory ?? []).slice(0, 3).map((cat, i) => (
          <KpiCard
            key={cat.categoryName}
            title={cat.categoryName}
            value={formatCurrency(cat.total)}
            icon={CreditCard}
            color={(['blue', 'orange', 'purple'] as const)[i % 3]}
          />
        ))}
      </div>

      {/* Owner breakdown widget */}
      {hasNamedOwners && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            הוצאות לפי בעלים — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h3>
          <div className="space-y-2.5">
            {(byOwnerData.breakdown as { name: string; total: number }[]).map((row) => {
              const pct = byOwnerData.total > 0 ? (row.total / byOwnerData.total) * 100 : 0;
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{row.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(row.total)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="label">סנן לפי קטגוריה</label>
            <select
              className="input"
              value={filterCategory ?? ''}
              onChange={(e) => setFilterCategory(e.target.value || undefined)}
            >
              <option value="">כל הקטגוריות</option>
              {categories?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="label">אמצעי תשלום</label>
            <select
              className="input"
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
            >
              <option value="">הכל</option>
              <option value="credit">אשראי</option>
              <option value="debit">דביט</option>
              <option value="cash">מזומן</option>
            </select>
          </div>
          {hasNamedOwners && (
            <div className="flex-1 min-w-[160px]">
              <label className="label">בעלים</label>
              <select
                className="input"
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
              >
                <option value="all">כולם</option>
                {(byOwnerData.breakdown as { name: string }[])
                  .filter((r) => r.name !== 'לא ידוע')
                  .map((r) => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      {barData.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">הוצאות לפי קטגוריה</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₪${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="סכום" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI action bar */}
      <div className="card bg-purple-50 border-purple-200">
        <div className="flex gap-3 flex-wrap items-center">
          <span className="text-sm font-medium text-purple-700">🤖 סיווג AI</span>
          <button
            onClick={() => aiClassifyBatch.mutate(
              { month: selectedMonth, year: selectedYear },
              { onSuccess: (d) => toast.success(`AI סיווג ${d.updated} תנועות`), onError: () => toast.error('שגיאה בסיווג AI') }
            )}
            disabled={aiClassifyBatch.isPending || aiApproveAll.isPending}
            className="btn-secondary text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
          >
            {aiClassifyBatch.isPending ? 'מסווג...' : 'סווג ללא סיווג עם AI'}
          </button>
          <button
            onClick={() => aiApproveAll.mutate(
              { month: selectedMonth, year: selectedYear },
              { onSuccess: (d) => toast.success(`אושרו ${d.approved} הצעות AI`), onError: () => toast.error('שגיאה באישור') }
            )}
            disabled={aiClassifyBatch.isPending || aiApproveAll.isPending}
            className="btn-primary text-xs bg-purple-600 hover:bg-purple-700 border-purple-600"
          >
            {aiApproveAll.isPending ? 'מאשר...' : 'אשר הכל'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">רשימת הוצאות ({filteredExpenses.length})</h3>
        </div>
        <div className="p-4">
          <DataTable
            data={filteredExpenses}
            columns={columns}
            loading={isLoading}
            emptyMessage="אין הוצאות לתקופה זו"
          />
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingExpense !== null}
        onClose={() => { setShowAddModal(false); setEditingExpense(null); }}
        title={editingExpense ? 'עריכת הוצאה' : 'הוספת הוצאה'}
      >
        <ExpenseForm
          defaultValues={
            editingExpense
              ? ({
                  categoryId: String(editingExpense.categoryId),
                  amount: String(editingExpense.amount),
                  date: editingExpense.date.split('T')[0],
                  description: editingExpense.description,
                  isRecurring: editingExpense.isRecurring,
                  paymentType: editingExpense.paymentType,
                  cardLast4: editingExpense.cardLast4 ?? '',
                } as Partial<ExpenseFormData>)
              : undefined
          }
          onSubmit={handleExpenseSubmit}
          onClose={() => { setShowAddModal(false); setEditingExpense(null); }}
          isPending={createExpense.isPending || updateExpense.isPending}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={deletingId !== null} onClose={() => setDeletingId(null)} title="מחיקת הוצאה" size="sm">
        <p className="text-gray-600 mb-5">האם אתה בטוח שברצונך למחוק הוצאה זו?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeletingId(null)} className="btn-secondary">ביטול</button>
          <button
            onClick={async () => { await deleteExpense.mutateAsync(deletingId!); setDeletingId(null); }}
            disabled={deleteExpense.isPending}
            className="btn-danger"
          >
            {deleteExpense.isPending ? 'מוחק...' : 'מחק'}
          </button>
        </div>
      </Modal>

      {/* Category Management Modal */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="ניהול קטגוריות">
        <div className="space-y-4">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input type="text" {...regCat('name')} className="input flex-1" placeholder="שם קטגוריה חדשה" />
            <input type="text" {...regCat('icon')} className="input w-16" placeholder="🏠" />
            <button type="submit" disabled={createCategory.isPending} className="btn-primary">
              <Plus size={16} />
            </button>
          </form>
          {catErrors.name && <p className="error-text">{catErrors.name.message}</p>}

          <div className="divide-y divide-gray-100">
            {categories?.map((c) => (
              <div key={c._id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700">{c.icon} {c.name}</span>
                <button
                  onClick={() => deleteCategory.mutate(c._id as unknown as number)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
