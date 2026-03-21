import { useState } from 'react';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import {
  useSalaries,
  useCreateSalary,
  useUpdateSalary,
  useDeleteSalary,
  useCreateMember,
} from '../hooks/useSalary';
import { useMembers, useCategories } from '../hooks/useConfig';
import { useUpdateTransaction } from '../hooks/useBank';
import { salaryApi } from '../services/api';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import ExportButton from '../components/shared/ExportButton';
import KpiCard from '../components/shared/KpiCard';
import BankImportButton from '../components/shared/BankImportButton';
import type { Salary, SalaryRow, BankSalaryRow } from '../interfaces/models';
import { SOURCE_LABELS, SOURCE_COLORS } from '../utils/format';
import { Wallet } from 'lucide-react';

interface ConfigMember { _id: string; name: string; role: string; }

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
}

const SalarySchema = z.object({
  memberId: z.string().min(1, 'בחר חבר').transform(Number),
  amount: z.string().min(1).transform(Number).pipe(z.number().positive('סכום חייב להיות חיובי')),
  month: z.string().transform(Number).pipe(z.number().int().min(1).max(12)),
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)),
  type: z.enum(['gross', 'net']),
  notes: z.string().optional(),
});

type SalaryFormData = z.input<typeof SalarySchema>;

const MemberSchema = z.object({
  name: z.string().min(1, 'הכנס שם'),
  role: z.string().min(1, 'הכנס תפקיד'),
});

type MemberFormData = z.infer<typeof MemberSchema>;

function SalaryForm({
  defaultValues,
  onSubmit,
  onClose,
  isPending,
  month,
  year,
}: {
  defaultValues?: Partial<SalaryFormData>;
  onSubmit: (data: SalaryFormData) => void;
  onClose: () => void;
  isPending: boolean;
  month: number;
  year: number;
}) {
  const { data: membersData } = useMembers();
  const members = (membersData ?? []) as ConfigMember[];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalaryFormData>({
    resolver: zodResolver(SalarySchema),
    defaultValues: (defaultValues ?? {
      month: String(month),
      year: String(year),
      type: 'gross',
    }) as Partial<SalaryFormData>,
  });

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
      <div className="form-group">
        <label className="label">חבר משק בית</label>
        <select {...register('memberId')} className="input">
          <option value="">בחר חבר</option>
          {members?.map((m) => (
            <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
          ))}
        </select>
        {errors.memberId && <p className="error-text">{errors.memberId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">חודש</label>
          <select {...register('month')} className="input">
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          {errors.month && <p className="error-text">{errors.month.message}</p>}
        </div>
        <div className="form-group">
          <label className="label">שנה</label>
          <input type="number" {...register('year')} className="input" />
          {errors.year && <p className="error-text">{errors.year.message}</p>}
        </div>
      </div>

      <div className="form-group">
        <label className="label">סוג</label>
        <select {...register('type')} className="input">
          <option value="gross">ברוטו</option>
          <option value="net">נטו</option>
        </select>
      </div>

      <div className="form-group">
        <label className="label">סכום (₪)</label>
        <input type="number" step="0.01" min="0" {...register('amount')} className="input" placeholder="0.00" />
        {errors.amount && <p className="error-text">{errors.amount.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">הערות</label>
        <input type="text" {...register('notes')} className="input" placeholder="הערות אופציונליות" />
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

export default function SalaryPage() {
  const { selectedMonth, selectedYear } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState<Salary | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Inline edit state for bank rows
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState('');
  const [pendingType, setPendingType] = useState('');

  const { data, isLoading } = useSalaries(selectedMonth, selectedYear);
  const createSalary = useCreateSalary();
  const updateSalary = useUpdateSalary();
  const deleteSalary = useDeleteSalary();
  const createMember = useCreateMember();
  const updateTransaction = useUpdateTransaction();
  const queryClient = useQueryClient();

  const { data: categoriesRaw } = useCategories();
  const incomeCategories = (categoriesRaw ?? []).filter((c: { type: string }) => c.type === 'income');
  const transferCategories = (categoriesRaw ?? []).filter((c: { type: string }) => c.type === 'transfer');

  function startBankEdit(row: BankSalaryRow) {
    setEditingBankId(row.id);
    setPendingCategoryId(row.categoryId ?? '');
    setPendingType('income');
  }

  function handleBankCancel() {
    setEditingBankId(null);
  }

  function handleBankSave() {
    if (!editingBankId) return;
    updateTransaction.mutate(
      { id: editingBankId, categoryId: pendingCategoryId, type: pendingType },
      {
        onSuccess: () => {
          setEditingBankId(null);
          queryClient.invalidateQueries({ queryKey: ['salary'] });
          if (pendingType === 'transfer') {
            toast.success('התנועה הועברה לקטגוריית העברות');
          } else {
            toast.success('הסיווג עודכן');
          }
        },
        onError: () => toast.error('שגיאה בעדכון'),
      }
    );
  }

  const {
    register: regMember,
    handleSubmit: handleMemberSubmit,
    formState: { errors: memberErrors },
    reset: resetMember,
  } = useForm<MemberFormData>({ resolver: zodResolver(MemberSchema) });

  const handleSalarySubmit = async (formData: SalaryFormData) => {
    const payload = {
      memberId: Number(formData.memberId),
      amount: Number(formData.amount),
      month: Number(formData.month),
      year: Number(formData.year),
      type: formData.type as 'gross' | 'net',
      notes: formData.notes ?? null,
    };

    if (editingSalary) {
      await updateSalary.mutateAsync({ id: editingSalary.id, data: payload });
      setEditingSalary(null);
    } else {
      await createSalary.mutateAsync(payload);
      setShowAddModal(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingId !== null) {
      await deleteSalary.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  const handleAddMember = handleMemberSubmit(async (data) => {
    await createMember.mutateAsync(data);
    resetMember();
    setShowMemberModal(false);
  });

  const columns = [
    {
      key: 'source',
      header: 'מקור',
      render: (s: SalaryRow) => {
        if (s._type === 'bank') {
          const bank = s as BankSalaryRow;
          return (
            <span className={`badge ${SOURCE_COLORS[bank.source] ?? 'bg-gray-100 text-gray-700'}`}>
              {SOURCE_LABELS[bank.source] ?? bank.source}
            </span>
          );
        }
        const manual = s as Salary;
        return <span className="text-sm text-gray-700">{manual.member?.name ?? '—'}</span>;
      },
    },
    {
      key: 'type',
      header: 'סוג',
      render: (s: SalaryRow) => {
        if (s._type === 'bank') {
          return <span className="badge badge-green">נטו</span>;
        }
        const manual = s as Salary;
        return (
          <span className={`badge ${manual.type === 'gross' ? 'badge-blue' : 'badge-green'}`}>
            {manual.type === 'gross' ? 'ברוטו' : 'נטו'}
          </span>
        );
      },
    },
    { key: 'amount', header: 'סכום', render: (s: SalaryRow) => formatCurrency(Number(s.amount)) },
    {
      key: 'month',
      header: 'חודש',
      render: (s: SalaryRow) => {
        if (s._type === 'bank') {
          return `${MONTH_NAMES[s.month - 1]} ${s.year}`;
        }
        const manual = s as Salary;
        return `${MONTH_NAMES[manual.month - 1]} ${manual.year}`;
      },
    },
    {
      key: 'notes',
      header: 'הערות / תיאור',
      render: (s: SalaryRow) => (
        <span className="text-xs text-gray-500 truncate max-w-[180px] block">
          {s.notes ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'פעולות',
      render: (s: SalaryRow) => {
        if (s._type === 'bank') {
          const bank = s as BankSalaryRow;
          if (editingBankId === bank.id) {
            return (
              <div className="flex items-center gap-1 flex-wrap">
                <select
                  value={pendingCategoryId}
                  onChange={e => setPendingCategoryId(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                  autoFocus
                >
                  <option value="">ללא קטגוריה</option>
                  <optgroup label="הכנסה">
                    {incomeCategories.map((c: { _id: string; icon: string; name: string }) => (
                      <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="העברה">
                    {transferCategories.map((c: { _id: string; icon: string; name: string }) => (
                      <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                </select>
                <select
                  value={pendingType}
                  onChange={e => setPendingType(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                >
                  <option value="income">הכנסה</option>
                  <option value="transfer">העברה ניטרלית</option>
                  <option value="savings">חיסכון</option>
                </select>
                <button
                  onClick={handleBankSave}
                  disabled={updateTransaction.isPending}
                  className="text-green-600 hover:text-green-800 font-bold text-sm"
                  title="שמור"
                >✓</button>
                <button
                  onClick={handleBankCancel}
                  className="text-gray-400 hover:text-gray-600 font-bold text-sm"
                  title="בטל"
                >✗</button>
              </div>
            );
          }
          return (
            <button
              onClick={() => startBankEdit(bank)}
              title="ערוך סיווג"
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Pencil size={13} />
            </button>
          );
        }
        const manual = s as Salary;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => setEditingSalary(manual)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="ערוך"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => setDeletingId(manual.id)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="מחק"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  // Per-member totals (manual entries only)
  const memberTotals = ((data?.salaries ?? []).filter(s => s._type !== 'bank') as Salary[])
    .reduce<Record<string, number>>((acc, s) => {
      const name = s.member?.name ?? '—';
      acc[name] = (acc[name] ?? 0) + Number(s.amount);
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">משכורות</h2>
          <p className="text-sm text-gray-500 mt-0.5">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <BankImportButton />
          <button onClick={() => setShowMemberModal(true)} className="btn-secondary">
            <UserPlus size={16} />
            חבר חדש
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={16} />
            הוסף משכורת
          </button>
          <ExportButton onExport={salaryApi.export} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="סה״כ הכנסות החודש"
          value={formatCurrency(data?.total ?? 0)}
          subtitle={
            data?.bankTotal
              ? `ידני: ${formatCurrency(data.manualTotal)} | בנק: ${formatCurrency(data.bankTotal)}`
              : undefined
          }
          icon={Wallet}
          color="blue"
        />
        {Object.entries(memberTotals).map(([name, total]) => (
          <KpiCard
            key={name}
            title={name}
            value={formatCurrency(total)}
            icon={Wallet}
            color="green"
          />
        ))}
      </div>

      <div className="card p-0">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">רשימת הכנסות</h3>
        </div>
        <div className="p-4">
          <DataTable
            data={data?.salaries ?? []}
            columns={columns}
            loading={isLoading}
            emptyMessage="אין הכנסות לחודש זה"
          />
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingSalary !== null}
        onClose={() => { setShowAddModal(false); setEditingSalary(null); }}
        title={editingSalary ? 'עריכת משכורת' : 'הוספת משכורת'}
      >
        <SalaryForm
          defaultValues={
            editingSalary
              ? ({
                  memberId: String(editingSalary.memberId),
                  amount: String(editingSalary.amount),
                  month: String(editingSalary.month),
                  year: String(editingSalary.year),
                  type: editingSalary.type,
                  notes: editingSalary.notes ?? '',
                } as Partial<SalaryFormData>)
              : undefined
          }
          onSubmit={handleSalarySubmit}
          onClose={() => { setShowAddModal(false); setEditingSalary(null); }}
          isPending={createSalary.isPending || updateSalary.isPending}
          month={selectedMonth}
          year={selectedYear}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="מחיקת משכורת"
        size="sm"
      >
        <p className="text-gray-600 mb-5">האם אתה בטוח שברצונך למחוק משכורת זו?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeletingId(null)} className="btn-secondary">ביטול</button>
          <button
            onClick={handleDeleteConfirm}
            disabled={deleteSalary.isPending}
            className="btn-danger"
          >
            {deleteSalary.isPending ? 'מוחק...' : 'מחק'}
          </button>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        title="הוספת חבר משק בית"
        size="sm"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="form-group">
            <label className="label">שם</label>
            <input type="text" {...regMember('name')} className="input" placeholder="שם מלא" />
            {memberErrors.name && <p className="error-text">{memberErrors.name.message}</p>}
          </div>
          <div className="form-group">
            <label className="label">תפקיד</label>
            <input type="text" {...regMember('role')} className="input" placeholder="לדוג': primary, partner" />
            {memberErrors.role && <p className="error-text">{memberErrors.role.message}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowMemberModal(false)} className="btn-secondary">ביטול</button>
            <button type="submit" disabled={createMember.isPending} className="btn-primary">
              {createMember.isPending ? 'שומר...' : 'הוסף'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
