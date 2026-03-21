import { create } from 'zustand';
import type { AppStore } from '../interfaces/store';

const now = new Date();

export const useStore = create<AppStore>((set) => ({
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
  sidebarOpen: true,
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setSelectedYear: (year) => set({ selectedYear: year }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
