import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL, REQUEST_TIMEOUT_MS } from '../../config/api.config';
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  getLanguage,
} from '../auth/AuthSessionStore';
import type { ApiResponse, LoginResponse } from '../models/ApiModels';

// ─── Bare client (no interceptors) — used for auth calls ─────────────────────

export const bareClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Authenticated client ─────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Single-flight refresh state ──────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await bareClient.post<ApiResponse<LoginResponse>>(
    '/api/login/refresh',
    { refreshToken },
  );

  const data = response.data?.data;
  if (!data?.token || !data?.refreshToken) {
    throw new Error('Invalid refresh response');
  }

  saveTokens(data.token, data.refreshToken);
  return data.token;
}

function dispatchAuthFailure(): void {
  clearTokens();
  window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
}

function extractErrorMessage(error: AxiosError): string {
  const body = error.response?.data as ApiResponse<unknown> | undefined;
  if (body?.messages && body.messages.length > 0) return body.messages[0];
  if (body?.message) return body.message;
  return error.message ?? 'Unknown error';
}

// ─── Request interceptors ─────────────────────────────────────────────────────

bareClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('accept-language', getLanguage());
  return config;
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers.set('accept-language', getLanguage());
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;

        // Retry original request with new token
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newToken}` };
        }

        return apiClient(originalRequest);
      } catch {
        dispatchAuthFailure();
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
