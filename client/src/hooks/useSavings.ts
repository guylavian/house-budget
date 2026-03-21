import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { savingsApi } from '../services/api';

export function useSavingsGoals() {
  return useQuery({
    queryKey: ['savings'],
    queryFn: () => savingsApi.getAll(),
  });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      targetAmount: number;
      currentAmount?: number;
      deadline?: string | null;
    }) => savingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('יעד חיסכון נוסף');
    },
    onError: () => {
      toast.error('שגיאה בהוספת יעד חיסכון');
    },
  });
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; targetAmount: number; currentAmount?: number; deadline?: string | null };
    }) => savingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('יעד חיסכון עודכן');
    },
    onError: () => {
      toast.error('שגיאה בעדכון יעד חיסכון');
    },
  });
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => savingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('יעד חיסכון נמחק');
    },
    onError: () => {
      toast.error('שגיאה במחיקת יעד חיסכון');
    },
  });
}

export function useAddDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      goalId,
      data,
    }: {
      goalId: number;
      data: { amount: number; date: string; notes?: string | null };
    }) => savingsApi.addDeposit(goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('הפקדה נוספה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בהוספת הפקדה');
    },
  });
}

export function useDeleteDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (depositId: number) => savingsApi.deleteDeposit(depositId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('הפקדה נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת הפקדה');
    },
  });
}
