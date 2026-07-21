import axios from 'axios';

const API_PREFIX = '/api/v1';
const ACCESS_TOKEN_KEY = 'urdubolo_access_token';
const REFRESH_TOKEN_KEY = 'urdubolo_refresh_token';
const USER_KEY = 'urdubolo_user';
let refreshPromise: Promise<string | null> | null = null;

function normalizeApiUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(API_PREFIX)) return trimmed;
  return `${trimmed}${API_PREFIX}`;
}

export const api = axios.create({
  baseURL: normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3200'),
  headers: { 'Content-Type': 'application/json' },
});

function isAuthEndpoint(url?: string) {
  return Boolean(url?.includes('/auth/login') || url?.includes('/auth/refresh'));
}

function tokenExpiresWithin(token: string, seconds: number) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return !payload.exp || Date.now() + seconds * 1000 >= payload.exp * 1000;
  } catch {
    return false;
  }
}

function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken() {
  if (typeof window === 'undefined') return null;
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
      .then((response) => {
        const nextAccessToken = response.data?.accessToken as string | undefined;
        const nextRefreshToken = response.data?.refreshToken as string | undefined;
        if (!nextAccessToken || !nextRefreshToken) return null;
        window.localStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
        return nextAccessToken;
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function ensureValidAccessToken(minSeconds = 120) {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !tokenExpiresWithin(token, minSeconds)) return token;
  return refreshAccessToken();
}

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    if (!isAuthEndpoint(config.url)) await ensureValidAccessToken();
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
  if (error.response?.status === 401 && typeof window !== 'undefined' && original && !original._retry && !isAuthEndpoint(original.url)) {
    original._retry = true;
    const token = await refreshAccessToken();
    if (token) {
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
  }
  if (error.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    clearSession();
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
