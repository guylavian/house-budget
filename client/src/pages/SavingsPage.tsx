import { useState } from 'react';
import { Plus, Pencil, Trash2, PiggyBank, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  useSavingsGoals,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
  useAddDeposit,
  useDeleteDeposit,
} from '../hooks/useSavings';
import { savingsApi } from '../services/api';
import Modal from '../components/shared/Modal';
import ExportButton from '../components/shared/ExportButton';
import KpiCard from '../components/shared/KpiCard';
import type { SavingsGoal, SavingsDeposit } from '../interfaces/models';

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
}

const GoalSchema = z.object({
  name: z.string().min(1, 'הכנס שם יעד'),
  targetAmount: z.string().min(1).transform(Number).pipe(z.number().positive()),
  currentAmount: z.string().optional().transform((v) => (v ? Number(v) : 0)),
  deadline: z.string().optional().or(z.literal('')),
});

type GoalFormData = z.input<typeof GoalSchema>;

const DepositSchema = z.object({
  amount: z.string().min(1).transform(Number).pipe(z.number().positive('סכום חייב להיות חיובי')),
  date: z.string().min(1, 'בחר תאריך'),
  notes: z.string().optional(),
});

type DepositFormData = z.input<typeof DepositSchema>;

function GoalForm({
  defaultValues,
  onSubmit,
  onClose,
  isPending,
}: {
  defaultValues?: Partial<GoalFormData>;
  onSubmit: (data: GoalFormData) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(GoalSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-group">
        <label className="label">שם היעד</label>
        <input type="text" {...register('name')} className="input" placeholder="לדוג': קרן חירום" />
        {errors.name && <p className="error-text">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">יעד (₪)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('targetAmount')}
            className="input"
            placeholder="50,000"
          />
          {errors.targetAmount && <p className="error-text">{errors.targetAmount.message}</p>}
        </div>
        <div className="form-group">
          <label className="label">סכום נוכחי (₪)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('currentAmount')}
            className="input"
            placeholder="0"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="label">תאריך יעד (אופציונלי)</label>
        <input type="date" {...register('deadline')} className="input" />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </form>
  );
}

function DepositForm({
  onSubmit,
  onClose,
  isPending,
}: {
  onSubmit: (data: DepositFormData) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DepositFormData>({
    resolver: zodResolver(DepositSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-group">
        <label className="label">סכום הפקדה (₪)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          {...register('amount')}
          className="input"
          placeholder="0.00"
        />
        {errors.amount && <p className="error-text">{errors.amount.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">תאריך</label>
        <input type="date" {...register('date')} className="input" />
        {errors.date && <p className="error-text">{errors.date.message}</p>}
      </div>

      <div className="form-group">
        <label className="label">הערות</label>
        <input
          type="text"
          {...register('notes')}
          className="input"
          placeholder="הערות אופציונליות"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'מפקיד...' : 'הוסף הפקדה'}
        </button>
      </div>
    </form>
  );
}

function CircularProgress({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color =
    percentage >= 100
      ? '#16A34A'
      : percentage >= 60
      ? '#2563EB'
      : percentage >= 30
      ? '#D97706'
      : '#DC2626';

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddDeposit,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
  onAddDeposit: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const deleteDeposit = useDeleteDeposit();

  const progress =
    Number(goal.targetAmount) > 0
      ? Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100)
      : 0;

  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <CircularProgress percentage={progress} size={80} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-base">{goal.name}</h3>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={onAddDeposit}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="הוסף הפקדה"
              >
                <Plus size={15} />
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="ערוך"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="מחק"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">נצבר:</span>
              <span className="font-semibold text-gray-800">
                {formatCurrency(Number(goal.currentAmount))}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">יעד:</span>
              <span className="text-gray-700">{formatCurrency(Number(goal.targetAmount))}</span>
            </div>
            {remaining > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">נותר:</span>
                <span className="text-orange-600 font-medium">{formatCurrency(remaining)}</span>
              </div>
            )}
          </div>

          {goal.deadline && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
              <Calendar size={12} />
              <span>יעד: {format(new Date(goal.deadline), 'dd/MM/yyyy')}</span>
            </div>
          )}

          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress >= 100
                    ? 'bg-green-500'
                    : progress >= 60
                    ? 'bg-blue-500'
                    : progress >= 30
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {goal.deposits && goal.deposits.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            היסטוריית הפקדות ({goal.deposits.length})
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {goal.deposits.map((deposit: SavingsDeposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between text-sm py-1.5 px-2 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-green-700">
                      {formatCurrency(Number(deposit.amount))}
                    </span>
                    <span className="text-gray-400 mx-1.5">•</span>
                    <span className="text-gray-500">
                      {format(new Date(deposit.date), 'dd/MM/yyyy')}
                    </span>
                    {deposit.notes && (
                      <span className="text-gray-400 mx-1 hidden sm:inline">• {deposit.notes}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteDeposit.mutate(deposit.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    title="מחק הפקדה"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SavingsPage() {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [depositGoalId, setDepositGoalId] = useState<number | null>(null);

  const { data: goals, isLoading } = useSavingsGoals();
  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();
  const addDeposit = useAddDeposit();

  const handleGoalSubmit = async (formData: GoalFormData) => {
    const payload = {
      name: formData.name,
      targetAmount: Number(formData.targetAmount),
      currentAmount: Number(formData.currentAmount ?? 0),
      deadline: (formData.deadline as string | undefined) || null,
    };

    if (editingGoal) {
      await updateGoal.mutateAsync({ id: editingGoal.id, data: payload });
      setEditingGoal(null);
    } else {
      await createGoal.mutateAsync(payload);
      setShowGoalModal(false);
    }
  };

  const handleDepositSubmit = async (formData: DepositFormData) => {
    if (depositGoalId === null) return;
    await addDeposit.mutateAsync({
      goalId: depositGoalId,
      data: {
        amount: Number(formData.amount),
        date: formData.date,
        notes: formData.notes ?? null,
      },
    });
    setShowDepositModal(false);
    setDepositGoalId(null);
  };

  const goalsData = goals ?? [];
  const totalSaved = goalsData.reduce((sum, g) => sum + Number(g.currentAmount), 0);
  const totalTarget = goalsData.reduce((sum, g) => sum + Number(g.targetAmount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">חיסכון</h2>
          <p className="text-sm text-gray-500 mt-0.5">ניהול יעדי חיסכון</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGoalModal(true)} className="btn-primary">
            <Plus size={16} />
            יעד חדש
          </button>
          <ExportButton onExport={savingsApi.export} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="סה״כ חסכון" value={formatCurrency(totalSaved)} icon={PiggyBank} color="green" />
        <KpiCard title="יעד כולל" value={formatCurrency(totalTarget)} icon={PiggyBank} color="blue" />
        <KpiCard
          title="התקדמות כוללת"
          value={`${overallProgress.toFixed(1)}%`}
          subtitle={`${goalsData.length} יעדים`}
          icon={PiggyBank}
          color="purple"
        />
      </div>

      {/* Goal Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : goalsData.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <PiggyBank size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">אין יעדי חיסכון</p>
          <p className="text-sm mt-1">הוסף יעד חיסכון ראשון</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goalsData.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditingGoal(goal)}
              onDelete={() => setDeletingId(goal.id)}
              onAddDeposit={() => {
                setDepositGoalId(goal.id);
                setShowDepositModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Goal Modal */}
      <Modal
        isOpen={showGoalModal || editingGoal !== null}
        onClose={() => {
          setShowGoalModal(false);
          setEditingGoal(null);
        }}
        title={editingGoal ? 'עריכת יעד חיסכון' : 'יעד חיסכון חדש'}
      >
        <GoalForm
          defaultValues={
            editingGoal
              ? ({
                  name: editingGoal.name,
                  targetAmount: String(editingGoal.targetAmount),
                  currentAmount: String(editingGoal.currentAmount),
                  deadline: editingGoal.deadline
                    ? new Date(editingGoal.deadline).toISOString().split('T')[0]
                    : '',
                } as Partial<GoalFormData>)
              : undefined
          }
          onSubmit={handleGoalSubmit}
          onClose={() => {
            setShowGoalModal(false);
            setEditingGoal(null);
          }}
          isPending={createGoal.isPending || updateGoal.isPending}
        />
      </Modal>

      {/* Deposit Modal */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          setDepositGoalId(null);
        }}
        title="הוספת הפקדה"
        size="sm"
      >
        <DepositForm
          onSubmit={handleDepositSubmit}
          onClose={() => {
            setShowDepositModal(false);
            setDepositGoalId(null);
          }}
          isPending={addDeposit.isPending}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="מחיקת יעד"
        size="sm"
      >
        <p className="text-gray-600 mb-5">האם אתה בטוח? כל ההפקדות הקשורות יימחקו.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeletingId(null)} className="btn-secondary">
            ביטול
          </button>
          <button
            onClick={async () => {
              await deleteGoal.mutateAsync(deletingId!);
              setDeletingId(null);
            }}
            disabled={deleteGoal.isPending}
            className="btn-danger"
          >
            {deleteGoal.isPending ? 'מוחק...' : 'מחק'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
