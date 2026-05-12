import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL, REQUEST_TIMEOUT_MS } from '../../config/api.config';
import {
  getAccessToken,
  saveTokens,
  getLanguage,
} from '../auth/AuthSessionStore';
import type { ApiResponse, LoginResponse } from '../models/ApiModels';
import { checkAppMinVersion } from '../../pwa/versionContract';

// ─── Bare client (no interceptors) — used for auth calls ─────────────────────

export const bareClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Authenticated client ─────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Single-flight refresh state ──────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  // Refresh token lives in an httpOnly cookie sent automatically because `withCredentials: true`.
  const response = await bareClient.post<ApiResponse<LoginResponse>>('/api/login/refresh', {});

  const data = response.data?.data;
  if (!data?.token) {
    throw new Error('Invalid refresh response');
  }

  saveTokens(data.token);
  return data.token;
}

/** Ask API to clear httpOnly refresh cookie (best-effort). */
export async function requestRefreshCookieCleared(): Promise<void> {
  try {
    await bareClient.post('/api/login/invalidate-browser-session');
  } catch {
    // ignore
  }
}

/** Notifies the app to clear session (listener clears Zustand, storage, and httpOnly refresh cookie). */
export function emitAuthFailureEvent(): void {
  window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
}

/** Same refresh used on HTTP 401; single-flight so callers and the interceptor share one in-flight refresh. */
export async function refreshAccessTokenWithLock(): Promise<string> {
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

// ─── Request interceptors ─────────────────────────────────────────────────────

bareClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('accept-language', getLanguage());
  config.headers.set('X-App-Version', __APP_VERSION__);
  return config;
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers.set('accept-language', getLanguage());
  config.headers.set('X-App-Version', __APP_VERSION__);
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────

/** Reads the X-App-Min-Version header off any response (success or error) and forwards
 *  it to the version contract checker so a forced-update modal can fire. */
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

    // Network error (no response from server)
    if (!error.response) {
      throw new Error('error_connection_failed');
    }

    const status = error.response.status;

    // 401 — attempt token refresh once
    if (status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;

      try {
        const newToken = await refreshAccessTokenWithLock();

        // Retry original request with new token
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newToken}` };
        }

        return apiClient(originalRequest);
      } catch {
        emitAuthFailureEvent();
        throw new Error('error_session_expired');
      }
    }

    // 5xx — generic server error
    if (status >= 500) {
      throw new Error('error_try_later_message');
    }

    // 4xx — extract backend message
    throw new Error(extractErrorMessage(error));
  },
);
