export interface DashboardQueryParams {
  month?: string;
  year?: string;
}

export interface MonthYearPoint {
  month: number;
  year: number;
}

export interface TrendDataPoint extends MonthYearPoint {
  total: number;
}

export interface CategoryTotal {
  categoryName: string;
  total: number;
}
