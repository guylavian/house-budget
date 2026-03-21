import { PrismaClient } from '@prisma/client';
import { Category } from '../models/Category';
import { SavingsGoal } from '../models/SavingsGoal';
import { BudgetLimit } from '../models/BudgetLimit';
import { IAppSettings } from '../models/AppSettings';

export interface SnapshotAlert {
  type: 'over_budget' | 'uncategorized' | 'large_expense' | 'income_drop';
  message: string;
  severity: 'warning' | 'error';
  data: unknown;
}

export async function generateSnapshot(
  month: number,
  year: number,
  prisma: PrismaClient,
  settings: IAppSettings
) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  // Previous month
  let prevMonth = month - 1;
  let prevYear  = year;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const prevStart = new Date(prevYear, prevMonth - 1, 1);
  const prevEnd   = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

  const [transactions, prevTransactions, categories, goals, budgets] = await Promise.all([
    prisma.bankTransaction.findMany({ where: { date: { gte: start, lte: end } } }),
    prisma.bankTransaction.findMany({ where: { date: { gte: prevStart, lte: prevEnd } } }),
    Category.find({ isArchived: false }),
    SavingsGoal.find({}),
    BudgetLimit.find({
      $or: [
        { isRecurring: true },
        { isRecurring: false, month, year },
      ],
    }),
  ]);

  const catMap    = new Map(categories.map(c => [c._id.toString(), c]));
  const budgetMap = new Map(budgets.map(b => [b.categoryId, b.amount]));

  // Categorize transactions
  const incomeTxns    = transactions.filter(t => t.type === 'income');
  const expenseTxns   = transactions.filter(t => t.type === 'expense');
  const savingsTxns   = transactions.filter(t => t.type === 'savings');
  const uncategorized = transactions.filter(t => !t.categoryId || t.confidence === 'manual');

  const totalIncome   = incomeTxns.reduce((s, t)  => s + Number(t.chargedAmount), 0);
  const totalExpenses = expenseTxns.reduce((s, t) => s + Number(t.chargedAmount), 0);
  const totalSavings  = savingsTxns.reduce((s, t) => s + Number(t.chargedAmount), 0);

  // Breakdown by category — expenses
  const expenseBycat = new Map<string, number>();
  for (const t of expenseTxns) {
    const id = t.categoryId ?? 'unknown';
    expenseBycat.set(id, (expenseBycat.get(id) ?? 0) + Number(t.chargedAmount));
  }

  // Breakdown by category — income
  const incomeBycat = new Map<string, number>();
  for (const t of incomeTxns) {
    const id = t.categoryId ?? 'unknown';
    incomeBycat.set(id, (incomeBycat.get(id) ?? 0) + Number(t.chargedAmount));
  }

  const expenseBreakdown = Array.from(expenseBycat.entries()).map(([catId, amount]) => {
    const cat    = catMap.get(catId);
    const budget = budgetMap.get(catId);
    return {
      categoryId: catId,
      name:       cat?.name  ?? 'לא ידוע',
      color:      cat?.color ?? '#6B7280',
      amount,
      budget,
      overBudget: budget ? amount > budget : false,
    };
  });

  const incomeBreakdown = Array.from(incomeBycat.entries()).map(([catId, amount]) => {
    const cat = catMap.get(catId);
    return {
      categoryId: catId,
      name:       cat?.name  ?? 'לא ידוע',
      color:      cat?.color ?? '#10B981',
      amount,
    };
  });

  // Top merchants
  const merchantMap = new Map<string, { total: number; count: number }>();
  for (const t of expenseTxns) {
    const existing = merchantMap.get(t.description);
    if (existing) {
      existing.total += Number(t.chargedAmount);
      existing.count++;
    } else {
      merchantMap.set(t.description, { total: Number(t.chargedAmount), count: 1 });
    }
  }
  const topMerchants = Array.from(merchantMap.entries())
    .map(([description, { total, count }]) => ({ description, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Previous month totals
  const prevIncome   = prevTransactions.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.chargedAmount), 0);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.chargedAmount), 0);
  const incomeDelta  = prevIncome   > 0 ? ((totalIncome   - prevIncome)   / prevIncome)   * 100 : 0;
  const expenseDelta = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

  // Alerts
  const alerts: SnapshotAlert[] = [];

  // Over budget
  for (const item of expenseBreakdown) {
    if (item.overBudget) {
      alerts.push({
        type: 'over_budget',
        severity: 'warning',
        message: `${item.name}: חרגת מהתקציב (₪${item.amount.toFixed(0)} מתוך ₪${item.budget})`,
        data: item,
      });
    }
  }

  // Large expense
  const largeTxns = expenseTxns.filter(t => Number(t.chargedAmount) > settings.alertThresholds.largeExpense);
  for (const t of largeTxns) {
    alerts.push({
      type: 'large_expense',
      severity: 'warning',
      message: `הוצאה גבוהה: ${t.description} — ₪${Number(t.chargedAmount).toFixed(0)}`,
      data: t,
    });
  }

  // Income drop
  if (prevIncome > 0 && incomeDelta < -settings.alertThresholds.incomeDrop) {
    alerts.push({
      type: 'income_drop',
      severity: 'error',
      message: `ירידה בהכנסה של ${Math.abs(incomeDelta).toFixed(1)}% לעומת החודש הקודם`,
      data: { incomeDelta },
    });
  }

  // Uncategorized
  if (uncategorized.length > 0) {
    alerts.push({
      type: 'uncategorized',
      severity: 'warning',
      message: `${uncategorized.length} תנועות לא מסווגות`,
      data: { count: uncategorized.length },
    });
  }

  const netBalance  = totalIncome - totalExpenses - totalSavings;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  return {
    month,
    year,
    income:   { total: totalIncome,   breakdown: incomeBreakdown },
    expenses: { total: totalExpenses, breakdown: expenseBreakdown },
    savings: {
      total: totalSavings,
      goals: goals.map(g => ({
        id:          g._id.toString(),
        name:        g.name,
        icon:        g.icon,
        color:       g.color,
        current:     g.currentAmount,
        target:      g.targetAmount,
        progressPct: g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0,
      })),
    },
    netBalance,
    savingsRate,
    topMerchants,
    previousMonth: { income: prevIncome, expenses: prevExpenses, incomeDelta, expenseDelta },
    alerts,
    uncategorized: { count: uncategorized.length, transactions: uncategorized },
  };
}
