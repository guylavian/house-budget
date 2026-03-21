import axios, { type AxiosRequestConfig } from 'axios';

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return httpClient.get<T>(url, config).then((r) => r.data);
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return httpClient.post<T>(url, data, config).then((r) => r.data);
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return httpClient.put<T>(url, data, config).then((r) => r.data);
}

export function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return httpClient.patch<T>(url, data, config).then((r) => r.data);
}

export function del(url: string, config?: AxiosRequestConfig): Promise<void> {
  return httpClient.delete(url, config).then(() => undefined);
}

export async function download(url: string, filename: string): Promise<void> {
  const response = await httpClient.get(url, { responseType: 'blob' });
  const objectUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
