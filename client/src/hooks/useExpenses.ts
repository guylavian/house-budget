import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { expensesApi } from '../services/api';
import type { Expense } from '../interfaces/models';

export function useExpenses(month?: number, year?: number, categoryId?: string) {
  return useQuery({
    queryKey: ['expenses', month, year, categoryId],
    queryFn: () => expensesApi.getAll(month, year, categoryId),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: () => expensesApi.getCategories(),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Expense, 'id' | 'category' | 'createdAt'>) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('הוצאה נוספה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בהוספת הוצאה');
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<Expense, 'id' | 'category' | 'createdAt'> }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('הוצאה עודכנה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון הוצאה');
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('הוצאה נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת הוצאה');
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => expensesApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'categories'] });
      toast.success('קטגוריה נוספה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בהוספת קטגוריה');
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expensesApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'categories'] });
      toast.success('קטגוריה נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת קטגוריה');
    },
  });
}
