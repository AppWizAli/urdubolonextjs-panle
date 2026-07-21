import axios from 'axios';

const API_PREFIX = '/api/v1';

function normalizeApiUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(API_PREFIX)) return trimmed;
  return `${trimmed}${API_PREFIX}`;
}

export const api = axios.create({
  baseURL: normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3200'),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('urdubolo_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  if (error.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.localStorage.removeItem('urdubolo_access_token');
    window.localStorage.removeItem('urdubolo_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export function apiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? 'The request could not be completed.';
  return 'The request could not be completed.';
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data;
}

export type PageResult<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number };
