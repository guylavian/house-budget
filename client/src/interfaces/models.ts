export interface HouseholdMember {
  id: number;
  name: string;
  role: string;
  createdAt: string;
}

export interface Salary {
  id: number;
  memberId: number;
  member: HouseholdMember;
  amount: number;
  month: number;
  year: number;
  type: 'gross' | 'net';
  notes?: string | null;
  createdAt: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  icon?: string | null;
}

export interface Expense {
  id: number;
  categoryId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  isRecurring: boolean;
  paymentType: 'credit' | 'debit' | 'cash';
  cardLast4?: string | null;
  createdAt: string;
}

export interface HouseExpense {
  id: number;
  type: string;
  amount: number;
  dueDay?: number | null;
  isRecurring: boolean;
  month: number;
  year: number;
  isPaid: boolean;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  deposits: SavingsDeposit[];
  depositCount?: number;
  progress?: number;
  createdAt: string;
}

export interface SavingsDeposit {
  id: number;
  goalId: number;
  amount: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  houseTotal: number;
  savingsDeposited: number;
  netBalance: number;
  savingsRate: number;
  expensesByCategory: { categoryName: string; total: number }[];
  last6MonthsIncome: { month: number; year: number; total: number }[];
  last6MonthsExpenses: { month: number; year: number; total: number }[];
  bankIncome?: number;
  bankExpenses?: number;
  bankSavings?: number;
  bankTransactionCount?: number;
  hasUnclassified?: boolean;
}

// A bank-imported income row that appears in the salary list
export interface BankSalaryRow {
  id: string;
  _type: 'bank';
  memberId: null;
  member: null;
  amount: number;
  month: number;
  year: number;
  type: 'net';
  notes: string;
  date: string;
  source: string;
  categoryId: string | null;
  confidence: string;
  importBatchId: string;
  createdAt: string;
}

export type SalaryRow = (Salary & { _type: 'manual' }) | BankSalaryRow;

export interface SalaryListResponse {
  salaries: SalaryRow[];
  total: number;
  manualTotal: number;
  bankTotal: number;
}

// A bank-imported expense row that appears in the expense list
export interface BankExpenseRow {
  id: string;
  _type: 'bank';
  categoryId: string;
  category: ExpenseCategory | null;
  amount: number;
  date: string;
  description: string;
  isRecurring: boolean;
  paymentType: 'credit' | 'debit';
  cardLast4: string | null;
  source: string;
  confidence: string;
  memo: string | null;
  importBatchId: string;
  createdAt: string;
  ownerName?: string | null;
}

export type ExpenseRow = (Expense & { _type?: 'manual' }) | BankExpenseRow;

export interface ExpenseListResponse {
  expenses: ExpenseRow[];
  total: number;
  manualTotal: number;
  bankTotal: number;
  byCategory: { categoryName: string; total: number; count: number }[];
}

export interface HouseBankTransaction {
  id: number;
  source: string;
  date: string;
  description: string;
  chargedAmount: number;
  type: string;
  categoryId: string | null;
  category: { _id: string; name: string; icon: string; color: string } | null;
}

export interface HouseListResponse {
  transactions: HouseBankTransaction[];
  byCategory: { name: string; color: string; icon: string; total: number; count: number }[];
  total: number;
  houseCategories: { _id: string; name: string; icon: string; color: string }[];
}
