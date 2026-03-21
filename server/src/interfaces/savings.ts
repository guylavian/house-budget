export interface DepositRequestBody {
  amount: number;
  date: Date;
  notes?: string | null;
}

export interface GoalEnriched {
  depositCount: number;
  progress: number;
}
