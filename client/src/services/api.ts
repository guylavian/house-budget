import { get, post, put, del, download } from './http';
import type {
  Salary,
  HouseholdMember,
  Expense,
  ExpenseCategory,
  SavingsGoal,
  SavingsDeposit,
  DashboardSummary,
  SalaryListResponse,
  ExpenseListResponse,
  HouseListResponse,
} from '../interfaces/models';

export const salaryApi = {
  getAll: (month?: number, year?: number) =>
    get<SalaryListResponse>('/salary', { params: { month, year } }),

  create: (data: Omit<Salary, 'id' | 'member' | 'createdAt'>) =>
    post<Salary>('/salary', data),

  update: (id: number, data: Omit<Salary, 'id' | 'member' | 'createdAt'>) =>
    put<Salary>(`/salary/${id}`, data),

  delete: (id: number) => del(`/salary/${id}`),

  export: () => download('/salary/export', 'salary-export.xlsx'),

  getMembers: () => get<HouseholdMember[]>('/salary/members'),

  createMember: (data: { name: string; role: string }) =>
    post<HouseholdMember>('/salary/members', data),
};

export const expensesApi = {
  getAll: (month?: number, year?: number, categoryId?: string) =>
    get<ExpenseListResponse>('/expenses', { params: { month, year, categoryId } }),

  create: (data: Omit<Expense, 'id' | 'category' | 'createdAt'>) =>
    post<Expense>('/expenses', data),

  update: (id: number, data: Omit<Expense, 'id' | 'category' | 'createdAt'>) =>
    put<Expense>(`/expenses/${id}`, data),

  delete: (id: number) => del(`/expenses/${id}`),

  export: () => download('/expenses/export', 'expenses-export.xlsx'),

  getCategories: () => get<ExpenseCategory[]>('/expenses/categories'),

  createCategory: (data: { name: string; icon?: string }) =>
    post<ExpenseCategory>('/expenses/categories', data),

  deleteCategory: (id: number) => del(`/expenses/categories/${id}`),
};

export const houseApi = {
  getAll: (month?: number, year?: number) =>
    get<HouseListResponse>('/house', { params: { month, year } }),

  export: () => download('/house/export', 'house-expenses-export.xlsx'),
};

export const savingsApi = {
  getAll: () => get<SavingsGoal[]>('/savings'),

  create: (data: { name: string; targetAmount: number; currentAmount?: number; deadline?: string | null }) =>
    post<SavingsGoal>('/savings', data),

  update: (id: number, data: { name: string; targetAmount: number; currentAmount?: number; deadline?: string | null }) =>
    put<SavingsGoal>(`/savings/${id}`, data),

  delete: (id: number) => del(`/savings/${id}`),

  addDeposit: (goalId: number, data: { amount: number; date: string; notes?: string | null }) =>
    post<SavingsDeposit>(`/savings/${goalId}/deposit`, data),

  deleteDeposit: (depositId: number) => del(`/savings/deposit/${depositId}`),

  export: () => download('/savings/export', 'savings-export.xlsx'),
};

export const dashboardApi = {
  getSummary: (month: number, year: number) =>
    get<DashboardSummary>('/dashboard/summary', { params: { month, year } }),
};

export const exportApi = {
  fullReport: () => download('/export/full', 'full-report.xlsx'),
};
