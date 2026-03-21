import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CardOwner } from '../interfaces/bank';
const API = '/api/config';

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () =>
    axios.get(`${API}/categories`).then(r => r.data)
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => axios.post(`${API}/categories`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; [k: string]: unknown }) =>
      axios.put(`${API}/categories/${id}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`${API}/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useCategoryRules = () =>
  useQuery({ queryKey: ['rules'], queryFn: () =>
    axios.get(`${API}/rules`).then(r => r.data)
  });

export const useAddRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => axios.post(`${API}/rules`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
};

export const useUpdateRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; [k: string]: unknown }) =>
      axios.put(`${API}/rules/${id}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
};

export const useDeleteRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`${API}/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
};

export const useReloadRules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post(`${API}/rules/reload`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
};

export const useMembers = () =>
  useQuery({ queryKey: ['members'], queryFn: () =>
    axios.get(`${API}/members`).then(r => r.data)
  });

export const useSavingsGoals = () =>
  useQuery({ queryKey: ['goals'], queryFn: () =>
    axios.get(`${API}/goals`).then(r => r.data)
  });

export const useBudgetLimits = () =>
  useQuery({ queryKey: ['budgets'], queryFn: () =>
    axios.get(`${API}/budgets`).then(r => r.data)
  });

export const useAppSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () =>
    axios.get(`${API}/settings`).then(r => r.data)
  });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => axios.put(`${API}/settings`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
};

export const useToggleHouseCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.patch(`${API}/categories/${id}/house-toggle`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['house'] });
    },
  });
};

export const useCardOwners = () =>
  useQuery({
    queryKey: ['card-owners'],
    queryFn: () => axios.get('/api/config/card-owners').then(r => r.data as CardOwner[]),
  });

export const useCreateCardOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { source: string; cardLast4: string; ownerName: string }) =>
      axios.post('/api/config/card-owners', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-owners'] }),
  });
};

export const useDeleteCardOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`/api/config/card-owners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-owners'] }),
  });
};

export const useBackfillCardOwners = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post('/api/config/card-owners/backfill').then(r => r.data as { totalUpdated: number; details: { source: string; cardLast4: string; updated: number }[] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-by-owner'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};
