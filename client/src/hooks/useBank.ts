import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
const API = '/api/bank';

export const useBankSnapshot = (month: number, year: number) =>
  useQuery({ queryKey: ['bank-snapshot', month, year], queryFn: () =>
    axios.get(`${API}/snapshot`, { params: { month, year } }).then(r => r.data)
  });

export const useBankTransactions = (filters: {
  month?: number; year?: number;
  source?: string; type?: string; unclassified?: boolean;
}) =>
  useQuery({ queryKey: ['bank-transactions', filters], queryFn: () =>
    axios.get(`${API}/transactions`, { params: filters }).then(r => r.data)
  });

export const useImportExcel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return axios.post(`${API}/import/excel`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};

export const useImportExcelBulk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      return axios.post(`${API}/import/excel/bulk`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId, type, reset }: { id: string; categoryId?: string; type?: string; reset?: boolean }) =>
      axios.patch(`${API}/transactions/${id}`, { categoryId, type, reset }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};

export const useBulkReclassify = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) =>
      axios.patch(`${API}/transactions/bulk`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};

export const useRollbackBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => axios.delete(`${API}/import/${batchId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-batches'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
    },
  });
};

export const useImportBatches = () =>
  useQuery({ queryKey: ['bank-batches'], queryFn: () =>
    axios.get(`${API}/batches`).then(r => r.data)
  });

const useBankByOwner = (month: number, year: number) =>
  useQuery({ queryKey: ['bank-by-owner', month, year], queryFn: () =>
    axios.get(`${API}/by-owner`, { params: { month, year } }).then(r => r.data)
  });
export default useBankByOwner

export const useByOwner = useBankByOwner;

export const useScraperConfigs = () =>
  useQuery({
    queryKey: ['bank-scraper-configs'],
    queryFn: () => axios.get(`${API}/scraper-configs`).then(r => r.data),
  });

export const useScrape = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { source: string; credentials: Record<string, string>; monthsBack: number }) =>
      axios.post(`${API}/import/scrape`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      qc.invalidateQueries({ queryKey: ['bank-snapshot'] });
      qc.invalidateQueries({ queryKey: ['bank-scraper-configs'] });
    },
  });
};

export const useAiClassifySingle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      axios.post(`${API}/classify/ai`, { id }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
  });
};

export const useAiClassifyBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { ids?: string[]; month?: number; year?: number }) =>
      axios.post(`${API}/classify/ai/batch`, params).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
  });
};

export const useAiApproveAll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { month?: number; year?: number }) =>
      axios.post(`${API}/classify/ai/approve-all`, params).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
  });
};

export const useUpdateScraperConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ source, ...body }: { source: string; isEnabled?: boolean; autoScrapeEnabled?: boolean }) =>
      axios.patch(`${API}/scraper-configs/${source}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-scraper-configs'] }),
  });
};
