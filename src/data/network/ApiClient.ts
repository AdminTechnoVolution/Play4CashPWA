import axios, { AxiosHeaders, AxiosInstance, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL, REQUEST_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getLanguage, saveTokens } from '../auth/AuthSessionStore';
import type { ApiResponse } from '../models/ApiModels';
import { errorMessageText } from './errorMessage';
import { checkAppMinVersion } from '../../pwa/versionContract';

export const bareClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const res = await bareClient.post<ApiResponse<{ token: string; refreshToken?: string }>>('/api/login/refresh', {});
  const token = res.data?.data?.token;
  if (typeof token !== 'string' || !token.trim()) throw new Error('error_session_expired');
  saveTokens(token);
}

export async function requestRefreshCookieCleared(): Promise<void> {
  try {
    await bareClient.post('/api/login/invalidate-browser-session');
  } catch {
    // ignore
  }
}

export function emitAuthFailureEvent(): void {
  window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
}

export async function refreshAccessTokenWithLock(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function extractErrorMessage(error: AxiosError): string {
  return errorMessageText(error.response?.data) || errorMessageText(error.message) || 'error_try_later_message';
}

bareClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('accept-language', getLanguage());
  config.headers.set('X-App-Version', __APP_VERSION__);
  return config;
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (import.meta.env.VITE_RELIABLE_COMMANDS === 'true') config.headers.set('X-P4C-Command-Protocol', '1');
  config.headers.set('accept-language', getLanguage());
  config.headers.set('X-App-Version', __APP_VERSION__);
  const token = getAccessToken();
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

function inspectMinVersionHeader(response: AxiosResponse | undefined): void {
  if (!response?.headers) return;
  const value = (response.headers as Record<string, unknown>)['x-app-min-version'];
  if (typeof value === 'string') checkAppMinVersion(value);
}

bareClient.interceptors.response.use(
  (response) => {
    inspectMinVersionHeader(response);
    return response;
  },
  (error: AxiosError) => {
    inspectMinVersionHeader(error.response);
    throw error;
  },
);

apiClient.interceptors.response.use(
  (response) => {
    inspectMinVersionHeader(response);
    return response;
  },
  async (error: AxiosError) => {
    inspectMinVersionHeader(error.response);
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (!error.response) {
      throw new Error('error_connection_failed');
    }

    const status = error.response.status;

    if (status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      try {
        const headers = AxiosHeaders.from(originalRequest.headers);
        const current = getAccessToken();
        // A concurrent refresh may already have replaced the token used by this request.
        if (!current || headers.get('Authorization') === `Bearer ${current}`) {
          await refreshAccessTokenWithLock();
        }
        const renewed = getAccessToken();
        if (!renewed) throw new Error('error_session_expired');
        headers.set('Authorization', `Bearer ${renewed}`);
        originalRequest.headers = headers;
      } catch {
        emitAuthFailureEvent();
        throw new Error('error_session_expired');
      }
      return apiClient(originalRequest);
    }
    if (status === 401) {
      emitAuthFailureEvent();
      throw new Error('error_session_expired');
    }

    if (status >= 500) {
      throw new Error('error_try_later_message');
    }

    throw new Error(extractErrorMessage(error));
  },
);
