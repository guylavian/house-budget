export interface BankTransaction {
  id: string;
  source: 'otsar_hahayal' | 'isracard' | 'diners' | string;
  sourceType: 'checking' | 'credit';
  date: string;
  description: string;
  chargedAmount: number;
  type: 'income' | 'expense' | 'savings' | 'transfer';
  categoryId: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  confidence: 'auto' | 'manual' | 'ai_suggested';
  isRecurring: boolean;
  memo: string | null;
  cardLast4?: string | null;
  ownerName?: string | null;
  importBatchId: string;
}

export interface SnapshotAlert {
  type: 'over_budget' | 'uncategorized' | 'large_expense' | 'income_drop';
  message: string;
  severity: 'warning' | 'error';
}

export interface Snapshot {
  month: number;
  year: number;
  income: {
    total: number;
    breakdown: { categoryId: string; name: string; color: string; amount: number }[];
  };
  expenses: {
    total: number;
    breakdown: {
      categoryId: string; name: string; color: string;
      amount: number; budget?: number; overBudget: boolean;
    }[];
  };
  savings: {
    total: number;
    goals: { id: string; name: string; icon: string; color: string; current: number; target: number; progressPct: number }[];
  };
  netBalance: number;
  savingsRate: number;
  topMerchants: { description: string; total: number; count: number }[];
  previousMonth: { income: number; expenses: number; incomeDelta: number; expenseDelta: number };
  alerts: SnapshotAlert[];
  uncategorized: { count: number; transactions: BankTransaction[] };
}

export interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  duplicates: number;
  unclassified: number;
  errors: { row: number; message: string }[];
}

export interface Category {
  _id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'savings' | 'transfer';
  budgetAmount?: number;
  isHouseCategory?: boolean;
  sortOrder: number;
}

export interface CategoryRule {
  _id: string;
  keywords: string[];
  categoryId: string;
  categoryName?: string;
  type: string;
  priority: number;
  isActive: boolean;
}

export interface CardOwner {
  _id: string;
  source: string;
  cardLast4: string;
  ownerName: string;
}
