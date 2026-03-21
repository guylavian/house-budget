export interface AppStore {
  selectedMonth: number;
  selectedYear: number;
  sidebarOpen: boolean;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setSidebarOpen: (open: boolean) => void;
}
