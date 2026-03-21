export interface BankTransactionQueryParams {
  month?: string;
  year?: string;
  source?: string;
  type?: string;
  unclassified?: string;
}

export interface BulkReclassifyBody {
  ids?: string[];
  categoryId?: string;
  type?: string;
  reclassifyAll?: boolean;
  month?: number;
  year?: number;
}

export interface ScrapeRequestBody {
  source: string;
  username: string;
  password: string;
  month: number;
  year: number;
}
