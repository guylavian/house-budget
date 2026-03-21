export interface ExpenseQueryParams {
  month?: string;
  year?: string;
  categoryId?: string;
}

export interface ExpenseDateFilter {
  gte: Date;
  lte: Date;
}

export interface ExpenseWhereClause {
  categoryId?: string;
  date?: ExpenseDateFilter;
}

export interface CategorySummary {
  categoryName: string;
  total: number;
  count: number;
}
