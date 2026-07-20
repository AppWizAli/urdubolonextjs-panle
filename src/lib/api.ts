import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
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
