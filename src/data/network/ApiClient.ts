import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL, REQUEST_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getLanguage, saveTokens } from '../auth/AuthSessionStore';
import type { ApiResponse } from '../models/ApiModels';
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
  if (token) {
    saveTokens(token);
  }
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
  const body = error.response?.data as ApiResponse<unknown> | undefined;
  if (body?.message) return body.message;
  if (body?.messages && body.messages.length > 0) return body.messages[0];
  return error.message ?? 'Unknown error';
}

function isMissingTokenResponse(error: AxiosError): boolean {
  const body = error.response?.data as ApiResponse<unknown> | undefined;
  const message = String(body?.message ?? body?.messages?.[0] ?? '').trim().toLowerCase();
  return message === 'no token provided' || message === 'no auth token provided';
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
    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };

    if (!error.response) {
      throw new Error('error_connection_failed');
    }

    const status = error.response.status;

    if (status === 401 && !originalRequest._retried) {
      if (isMissingTokenResponse(error)) {
        throw new Error('error_try_later_message');
      }
      originalRequest._retried = true;
      try {
        await refreshAccessTokenWithLock();
        return apiClient(originalRequest);
      } catch {
        emitAuthFailureEvent();
        throw new Error('error_session_expired');
      }
    }

    if (status >= 500) {
      throw new Error('error_try_later_message');
    }

    throw new Error(extractErrorMessage(error));
  },
);
