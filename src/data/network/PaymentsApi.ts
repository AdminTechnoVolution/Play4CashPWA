import { apiClient } from './ApiClient';
import type { ApiResponse } from '../models/ApiModels';
/** depositFee: approximate fee = fixed + amount × rate, from recent provider quotes (absent without history). */
export interface PaymentNetwork { network: string; currency: string; asset: 'USDT'; withdrawable?: boolean; depositFee?: { fixed: string; rate: string } }
export interface PaymentOrder { id: string; kind: 'deposit' | 'withdrawal'; network: string; amount: string; fee?: string;
  net?: string; credited?: string; status: string; address?: string; payAmount?: string; expectedCredit?: string; createdAt: string; reviewReason?: string }
export interface WithdrawalQuote { id: string; network: string; address: string; net: string; fee: string; amount: string; expiresAt: string }
export const paymentsApi = {
  async requestReturn(key: string, reason: string) {
    return (await apiClient.post<ApiResponse<{ id: string; status: string }>>('/api/payments/fund-return-requests', { reason }, { headers: { 'Idempotency-Key': key } })).data.data!;
  },
  async networks() { return (await apiClient.get<ApiResponse<PaymentNetwork[]>>('/api/payments/networks')).data.data ?? []; },
  async balance() { return (await apiClient.get<ApiResponse<{ available: string; reserved: string }>>('/api/payments/balance')).data.data!; },
  async limits() { return (await apiClient.get<ApiResponse<{ depositLimit24h: string }>>('/api/payments/limits')).data.data!; },
  async history() { return (await apiClient.get<ApiResponse<PaymentOrder[]>>('/api/payments/orders')).data.data ?? []; },
  async order(id: string) { return (await apiClient.get<ApiResponse<PaymentOrder>>(`/api/payments/orders/${id}`)).data.data!; },
  async deposit(key: string, network: string, amount: string) {
    return (await apiClient.post<ApiResponse<PaymentOrder>>('/api/payments/deposits', { network, amount }, { headers: { 'Idempotency-Key': key } })).data.data!;
  },
  async quote(network: string, address: string, amount: string) {
    return (await apiClient.post<ApiResponse<WithdrawalQuote>>('/api/payments/withdrawal-quotes', { network, address, amount })).data.data!;
  },
  async withdraw(key: string, quoteId: string) {
    return (await apiClient.post<ApiResponse<PaymentOrder>>('/api/payments/withdrawals', { quoteId }, { headers: { 'Idempotency-Key': key } })).data.data!;
  },
  async verify(id: string, code: string, key: string) {
    return (await apiClient.post<ApiResponse<PaymentOrder>>(`/api/payments/withdrawals/${id}/verify`, { code }, { headers: { 'Idempotency-Key': key } })).data.data!;
  },
};
