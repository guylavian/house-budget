export interface HouseQueryParams {
  month?: string;
  year?: string;
}

export interface HouseWhereClause {
  month?: number;
  year?: number;
}

export interface PaidRequestBody {
  isPaid: boolean;
  paidAt?: string | null;
}
