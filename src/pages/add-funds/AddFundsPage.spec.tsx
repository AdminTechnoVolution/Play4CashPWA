import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshAccount: vi.fn(),
  getUserAccount: vi.fn(),
  getWallets: vi.fn(),
  createRechargeIntent: vi.fn(),
  recharge: vi.fn(),
  formatApiMessageForDisplay: vi.fn((value: unknown) => {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return 'formatted-error';
  }),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  IonContent: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  IonBackButton: () => <button type="button">back</button>,
  IonButtons: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonSelect: ({
    value,
    onIonChange,
    children,
    disabled,
  }: {
    value?: string;
    onIonChange?: (event: { detail: { value: string } }) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <select
      aria-label="ion-select"
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onIonChange?.({ detail: { value: event.currentTarget.value } })}
    >
      {children}
    </select>
  ),
  IonSelectOption: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  IonInput: ({
    value,
    onIonInput,
    placeholder,
    readonly,
    type,
    inputmode,
  }: {
    value?: string | number;
    onIonInput?: (event: { detail: { value: string | undefined } }) => void;
    placeholder?: string;
    readonly?: boolean;
    type?: string;
    inputmode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'];
  }) => (
    <input
      aria-label={placeholder ?? 'ion-input'}
      placeholder={placeholder}
      readOnly={readonly}
      type={type ?? 'text'}
      inputMode={inputmode}
      value={value ?? ''}
      onChange={(event) => onIonInput?.({ detail: { value: event.currentTarget.value } })}
    />
  ),
  IonText: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonIcon: () => <span />,
  IonAlert: ({ isOpen, message }: { isOpen: boolean; message: string }) =>
    isOpen ? <div role="alert">{message}</div> : null,
  IonSpinner: () => <span />,
  IonButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../data/network/ApiRepository', () => ({
  apiRepository: {
    getUserAccount: mocks.getUserAccount,
    getWallets: mocks.getWallets,
    createRechargeIntent: mocks.createRechargeIntent,
    recharge: mocks.recharge,
  },
}));

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: () => ({ refreshAccount: mocks.refreshAccount }),
}));

vi.mock('../../ui/components/SovereignButton', () => ({
  SovereignPrimaryButton: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading}>
      {children}
    </button>
  ),
}));

vi.mock('../../ui/components/GenericErrorModal', () => ({
  default: () => null,
}));

vi.mock('../../i18n/ApiMessageDisplay', () => ({
  formatApiMessageForDisplay: (value: unknown) => mocks.formatApiMessageForDisplay(value),
}));

vi.mock('../../i18n/translations', () => ({
  useT: () => (key: string) => key,
}));

import AddFundsPage from './AddFundsPage';

function mockCrypto(sequence: string[]) {
  const randomUUID = vi.fn(() => sequence.shift() ?? 'fallback-uuid');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID },
  });
  return randomUUID;
}

async function openRechargeForm() {
  render(<AddFundsPage />);

  await screen.findByText('done_recharge_done');
  fireEvent.click(screen.getByText('done_recharge_done'));

  await screen.findByText('recharge_intent_reserve_button');
  fireEvent.change(screen.getByPlaceholderText('label_amount'), { target: { value: '50' } });
  fireEvent.click(screen.getByText('recharge_intent_reserve_button'));

  await screen.findByText('verify_button');
}

function fillRechargeForm(txId: string) {
  fireEvent.change(screen.getByPlaceholderText('label_transaction_id'), { target: { value: txId } });
}

describe('AddFundsPage idempotency', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.refreshAccount.mockReset();
    mocks.getUserAccount.mockResolvedValue({
      walletNetwork: 'trc20',
    });
    mocks.getWallets.mockResolvedValue([
      {
        coin: 'USDT',
        network: 'TRC20',
        displayLabel: 'TRC20',
        address: 'T123',
        isActive: true,
      },
    ]);
    mocks.createRechargeIntent.mockReset().mockResolvedValue({
      intentId: 'intent-1',
      coin: 'USDT',
      network: 'TRC20',
      address: 'T123',
      exactAmount: 50.0034,
      expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    });
    mocks.recharge.mockReset().mockRejectedValue(new Error('pending approval'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses the same idempotency key when the user retries the same transaction', async () => {
    const randomUUID = mockCrypto([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);

    await openRechargeForm();
    fillRechargeForm('tx-1');

    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(2));

    const firstKey = mocks.recharge.mock.calls[0][0].idempotencyKey;
    const secondKey = mocks.recharge.mock.calls[1][0].idempotencyKey;

    expect(firstKey).toBe('11111111-1111-4111-8111-111111111111');
    expect(secondKey).toBe(firstKey);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('creates a new idempotency key when the txId changes', async () => {
    mockCrypto([
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]);

    await openRechargeForm();
    fillRechargeForm('tx-1');

    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(1));

    fillRechargeForm('tx-2');
    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(2));

    const firstKey = mocks.recharge.mock.calls[0][0].idempotencyKey;
    const secondKey = mocks.recharge.mock.calls[1][0].idempotencyKey;

    expect(firstKey).toBe('33333333-3333-4333-8333-333333333333');
    expect(secondKey).toBe('44444444-4444-4444-8444-444444444444');
    expect(secondKey).not.toBe(firstKey);
  });

  it('keeps the same idempotency key when the form does not change', async () => {
    mockCrypto([
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ]);

    await openRechargeForm();
    fillRechargeForm('tx-1');

    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(1));

    fillRechargeForm('tx-1');
    fireEvent.click(screen.getByText('verify_button'));
    await waitFor(() => expect(mocks.recharge).toHaveBeenCalledTimes(2));

    const firstKey = mocks.recharge.mock.calls[0][0].idempotencyKey;
    const secondKey = mocks.recharge.mock.calls[1][0].idempotencyKey;

    expect(firstKey).toBe('55555555-5555-4555-8555-555555555555');
    expect(secondKey).toBe(firstKey);
  });
});

describe('AddFundsPage deposit reservation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.refreshAccount.mockReset();
    mocks.getUserAccount.mockResolvedValue({ walletNetwork: 'trc20' });
    mocks.getWallets.mockResolvedValue([
      {
        coin: 'USDT',
        network: 'TRC20',
        displayLabel: 'TRC20',
        address: 'T123',
        isActive: true,
        minAmount: 10,
      },
    ]);
    mocks.recharge.mockReset().mockRejectedValue(new Error('pending approval'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reserves an exact amount for the selected coin/network before showing the txId form', async () => {
    mocks.createRechargeIntent.mockReset().mockResolvedValue({
      intentId: 'intent-1',
      coin: 'USDT',
      network: 'TRC20',
      address: 'T123',
      exactAmount: 50.0034,
      expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    });

    await openRechargeForm();

    expect(mocks.createRechargeIntent).toHaveBeenCalledWith({
      coin: 'USDT',
      network: 'TRC20',
      amount: 50,
    });
    expect(screen.getByText('50.0034 USDT')).toBeTruthy();
  });

  it('shows the expired state and hides the txId form once the reservation lapses', async () => {
    mocks.createRechargeIntent.mockReset().mockResolvedValue({
      intentId: 'intent-1',
      coin: 'USDT',
      network: 'TRC20',
      address: 'T123',
      exactAmount: 50.0034,
      expiresAt: new Date(Date.now() + 500).toISOString(),
    });

    render(<AddFundsPage />);
    await screen.findByText('done_recharge_done');
    fireEvent.click(screen.getByText('done_recharge_done'));
    await screen.findByText('recharge_intent_reserve_button');
    fireEvent.change(screen.getByPlaceholderText('label_amount'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('recharge_intent_reserve_button'));
    await screen.findByText('verify_button');

    await screen.findByText('recharge_intent_expired_title', undefined, { timeout: 3000 });
    expect(screen.queryByText('verify_button')).toBeNull();
  });
});
