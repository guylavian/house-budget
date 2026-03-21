import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { salaryApi } from '../services/api';
import type { Salary, HouseholdMember } from '../interfaces/models';

export function useSalaries(month: number, year: number) {
  return useQuery({
    queryKey: ['salary', month, year],
    queryFn: () => salaryApi.getAll(month, year),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['salary', 'members'],
    queryFn: () => salaryApi.getMembers(),
  });
}

export function useCreateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Salary, 'id' | 'member' | 'createdAt'>) => salaryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('משכורת נוספה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בהוספת משכורת');
    },
  });
}

export function useUpdateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<Salary, 'id' | 'member' | 'createdAt'> }) =>
      salaryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('משכורת עודכנה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון משכורת');
    },
  });
}

export function useDeleteSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => salaryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('משכורת נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת משכורת');
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role: string }) => salaryApi.createMember(data),
    onSuccess: (member: HouseholdMember) => {
      queryClient.invalidateQueries({ queryKey: ['salary', 'members'] });
      toast.success(`חבר ${member.name} נוסף בהצלחה`);
    },
    onError: () => {
      toast.error('שגיאה בהוספת חבר');
    },
  });
}
