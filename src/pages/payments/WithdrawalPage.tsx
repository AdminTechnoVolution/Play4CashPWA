import React, { useEffect, useState } from 'react';
import { IonInput } from '@ionic/react';
import {
  alertCircleOutline, checkmarkCircle, closeCircleOutline, hourglassOutline, mailOutline, paperPlaneOutline,
  shieldCheckmarkOutline, timeOutline, warningOutline,
} from 'ionicons/icons';
import { paymentsApi } from '../../data/network/PaymentsApi';
import type { PaymentNetwork, PaymentOrder, WithdrawalQuote } from '../../data/network/PaymentsApi';
import { getUserAccount } from '../../data/auth/AuthSessionStore';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { useT } from '../../i18n/translations';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import {
  BalanceHero, chains, failedStatuses, fieldInputStyle, formatUsdt, isValidAmount, Label, NetworkPicker, Notice, OrderHeader,
  PaymentsLayout, requestKey, ReturnRequestCard, Steps, success, terminal, useOrderPolling,
} from './PaymentUi';
import type { Balance } from './PaymentUi';

const QUOTE_TTL_MS = 120000;

/** 0 = email verification, 1 = balance reserved, 2 = on-chain payout, 4 = completed (all stages done). */
function progressStep(status: string): number {
  if (status === 'confirmed') return 4;
  if (['submitting', 'processing', 'verification_pending', 'uncertain'].includes(status)) return 2;
  if (['review', 'reserved'].includes(status)) return 1;
  return 0;
}

const WithdrawalPage: React.FC = () => {
  const t = useT();
  const { refreshAccount } = useDashboardStore();
  const storageKey = `p4c:payment:${getUserAccount()?.id ?? ''}:withdrawal`;
  const [networks, setNetworks] = useState<PaymentNetwork[] | null>(null);
  const [network, setNetwork] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [funds, rows] = await Promise.all([paymentsApi.balance(), paymentsApi.networks()]);
        if (!active) return;
        setBalance(funds); setNetworks(rows); setNetwork(rows[0]?.network ?? '');
        const id = sessionStorage.getItem(`${storageKey}:order`);
        if (id) { const current = await paymentsApi.order(id); if (active) setOrder(current); }
      } catch (e) {
        if (active) { setNetworks(current => current ?? []); setError(formatApiMessageForDisplay((e as Error).message)); }
      }
    })();
    return () => { active = false; };
  }, [storageKey]);

  useOrderPolling(order, (next, funds) => { setOrder(next); setBalance(funds); });

  const perform = async (work: () => Promise<void>) => {
    setLoading(true); setError('');
    try { await work(); } catch (e) { setError(formatApiMessageForDisplay((e as Error).message)); } finally { setLoading(false); }
  };
  const remember = (next: PaymentOrder) => { setOrder(next); sessionStorage.setItem(`${storageKey}:order`, next.id); };
  const requestQuote = () => perform(async () => setQuote(await paymentsApi.quote(network, address.trim(), amount)));
  const confirm = (current: WithdrawalQuote) => perform(async () => remember(await paymentsApi.withdraw(requestKey(storageKey, { quoteId: current.id }), current.id)));
  const verify = (code: string) => perform(async () => {
    if (!order) return;
    remember(await paymentsApi.verify(order.id, code, requestKey(storageKey, { verifyOrderId: order.id })));
    setBalance(await paymentsApi.balance());
    refreshAccount();
  });
  const reset = () => {
    sessionStorage.removeItem(`${storageKey}:order`); sessionStorage.removeItem(`${storageKey}:request`);
    setOrder(null); setQuote(null); setAmount(''); setError('');
  };

  const validAmount = isValidAmount(amount);
  const exceedsBalance = !!balance && validAmount && Number(amount) > Number(balance.available);
  const amountError = amount && !validAmount ? t('recharge_error_amount_invalid')
    : exceedsBalance ? t('withdrawal_amount_exceeds_balance').replace('%s', `${formatUsdt(balance!.available)} USDT`) : '';
  const activeNetwork = order?.network ?? quote?.network ?? network;

  const pasteAddress = async () => {
    try { setAddress((await navigator.clipboard.readText()).trim()); setQuote(null); } catch { /* clipboard not available */ }
  };

  return (
    <PaymentsLayout title={t('withdrawal_title')}>
      <BalanceHero balance={balance} direction="withdrawal" network={activeNetwork} />

      {error && <Notice icon={alertCircleOutline} tone="error" role="alert"><p>{error}</p></Notice>}

      {order ? (
        <WithdrawalOrderCard order={order} loading={loading} onVerify={verify} onNew={reset} />
      ) : quote ? (
        <QuoteCard quote={quote} balance={balance} loading={loading} onConfirm={() => confirm(quote)} onRefresh={requestQuote} onEdit={() => setQuote(null)} />
      ) : (
        <div className="p4c-card">
          <p className="p4c-card-title">{t('withdrawal_destination')}</p>
          <NetworkPicker networks={networks} value={network} disabled={loading} onChange={setNetwork} />

          <Label htmlFor="withdraw-address">{t('withdraw_address_label')}</Label>
          <div className="p4c-field">
            <IonInput id="withdraw-address" className="p4c-mono" value={address} disabled={loading} autocapitalize="off" spellcheck={false}
              placeholder={t('withdraw_address_placeholder').replace('%s', network || 'USDT')}
              onIonInput={e => setAddress(String(e.detail.value ?? ''))} style={{ ...fieldInputStyle, fontSize: '13px' }} />
            {typeof navigator !== 'undefined' && !!navigator.clipboard?.readText && (
              <button type="button" className="p4c-field-action" disabled={loading} onClick={pasteAddress}>{t('withdraw_paste')}</button>
            )}
          </div>
          <p className="p4c-hint" />

          <Label htmlFor="withdraw-amount">{t('withdraw_amount_label')}</Label>
          <div className={`p4c-field${amountError ? ' p4c-field--error' : ''}`}>
            <IonInput id="withdraw-amount" className="p4c-mono" inputmode="decimal" placeholder="0.00" value={amount} disabled={loading}
              onIonInput={e => setAmount(String(e.detail.value ?? '').trim())} style={{ ...fieldInputStyle, fontSize: '18px', fontWeight: 700 }} />
            <span className="p4c-field-suffix">USDT</span>
          </div>
          <p className="p4c-hint p4c-hint--error">{amountError}</p>

          <SovereignPrimaryButton onClick={requestQuote} loading={loading}
            disabled={!validAmount || exceedsBalance || !network || address.trim().length < 10}>
            {t('withdraw_quote_button')}
          </SovereignPrimaryButton>
        </div>
      )}

      <ReturnRequestCard storageKey={storageKey} />
    </PaymentsLayout>
  );
};

/* ── Quote review ── */

const QuoteCard: React.FC<{
  quote: WithdrawalQuote; balance: Balance | null; loading: boolean; onConfirm: () => void; onRefresh: () => void; onEdit: () => void;
}> = ({ quote, balance, loading, onConfirm, onRefresh, onEdit }) => {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(quote.expiresAt).getTime() - now);
  const expired = remaining === 0;
  const insufficient = !!balance && Number(quote.amount) > Number(balance.available);

  return (
    <div className="p4c-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <p className="p4c-card-title" style={{ margin: 0 }}>{t('withdraw_review_title')}</p>
        <CountdownRing remaining={remaining} label={t('withdraw_quote_expires')} />
      </div>

      <Receipt rows={[
        [t('transaction_label_network'), <NetworkTag network={quote.network} />],
        [t('withdraw_address_label'), <span className="p4c-mono">{quote.address}</span>],
        [t('withdraw_fee'), <span className="p4c-mono">{formatUsdt(quote.fee)} USDT</span>],
        [t('withdraw_total'), <span className="p4c-mono">{formatUsdt(quote.amount)} USDT</span>],
        [t('withdraw_receive'), <span className="p4c-mono">{formatUsdt(quote.net)} USDT</span>, true],
      ]} />

      {insufficient && (
        <Notice icon={alertCircleOutline} tone="error">
          <p>{t('withdrawal_amount_exceeds_balance').replace('%s', `${formatUsdt(balance!.available)} USDT`)}</p>
        </Notice>
      )}
      {expired ? (
        <Notice icon={timeOutline} tone="warning"><p>{t('withdraw_quote_expired')}</p></Notice>
      ) : (
        <Notice icon={shieldCheckmarkOutline} tone="warning"><p>{t('withdraw_irreversible_warning').replace('%s', quote.network)}</p></Notice>
      )}

      <div className="p4c-actions">
        {expired ? (
          <SovereignPrimaryButton onClick={onRefresh} loading={loading}>{t('withdraw_refresh_quote')}</SovereignPrimaryButton>
        ) : (
          <SovereignPrimaryButton onClick={onConfirm} loading={loading} disabled={insufficient}>{t('withdraw_confirm_button')}</SovereignPrimaryButton>
        )}
        <SovereignSecondaryButton onClick={onEdit} disabled={loading}>{t('withdraw_edit')}</SovereignSecondaryButton>
      </div>
    </div>
  );
};

/* ── Order tracking ── */

const WithdrawalOrderCard: React.FC<{ order: PaymentOrder; loading: boolean; onVerify: (code: string) => void; onNew: () => void }> = ({
  order, loading, onVerify, onNew,
}) => {
  const t = useT();
  const [code, setCode] = useState('');
  const isFailed = failedStatuses.has(order.status);
  const isConfirmed = order.status === 'confirmed';
  const color = isConfirmed ? success : isFailed ? 'var(--sovereign-error)' : 'var(--sovereign-gold)';
  const icon = isConfirmed ? checkmarkCircle : isFailed ? closeCircleOutline
    : order.status === 'pending_verify' ? mailOutline : order.status === 'review' ? hourglassOutline : paperPlaneOutline;
  const net = formatUsdt(order.net);

  return (
    <div className="p4c-card">
      <OrderHeader order={order} label={t(`withdraw_status_${order.status}`)} icon={icon} color={color} />
      {!isFailed && (
        <Steps step={progressStep(order.status)}
          labels={[t('withdraw_step_verify'), t('withdraw_step_reserve'), t('withdraw_step_send'), t('withdraw_step_done')]} />
      )}

      {isConfirmed && (
        <div className="p4c-result">
          <p className="p4c-result-amount p4c-mono" style={{ color: success }}>{net} USDT</p>
          <p className="p4c-result-text">{t('withdraw_sent_text').replace('%s', net)}</p>
        </div>
      )}

      {!isConfirmed && (
        <Receipt rows={[
          [t('withdraw_address_label'), <span className="p4c-mono">{order.address}</span>],
          [t('withdraw_fee'), <span className="p4c-mono">{formatUsdt(order.fee)} USDT</span>],
          [t('withdraw_total'), <span className="p4c-mono">{formatUsdt(order.amount)} USDT</span>],
          [t('withdraw_receive'), <span className="p4c-mono">{net} USDT</span>, true],
        ]} />
      )}

      {order.status === 'pending_verify' && (
        <>
          <Label htmlFor="withdraw-code">{t('withdraw_code_title')}</Label>
          <input id="withdraw-code" className="p4c-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="······" value={code} disabled={loading} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <p className="p4c-hint">{t('withdraw_code_hint')}</p>
          <SovereignPrimaryButton onClick={() => onVerify(code)} loading={loading} disabled={!/^\d{6}$/.test(code)}>
            {t('withdraw_verify_button')}
          </SovereignPrimaryButton>
        </>
      )}

      {order.status === 'review' && <Notice icon={hourglassOutline} tone="warning"><p>{t('withdraw_review_note')}</p></Notice>}
      {['reserved', 'submitting', 'processing', 'verification_pending'].includes(order.status) && (
        <p className="p4c-hint" style={{ margin: 0 }}>{t('withdraw_processing_note')}</p>
      )}
      {order.status === 'uncertain' && <p className="p4c-hint" style={{ margin: 0 }}>{t('deposit_uncertain_note')}</p>}
      {isFailed && (
        <Notice icon={warningOutline} tone="error">
          <p>{order.status === 'verification_delivery_failed' ? t('withdraw_delivery_failed_text')
            : order.reviewReason === 'provider_rejected' ? t('deposit_provider_rejected') : t('withdraw_failed_text')}</p>
        </Notice>
      )}

      {terminal.has(order.status) && (
        <div className="p4c-actions"><SovereignPrimaryButton onClick={onNew}>{t('withdraw_new_button')}</SovereignPrimaryButton></div>
      )}
    </div>
  );
};

/* ── Small pieces ── */

const NetworkTag: React.FC<{ network: string }> = ({ network }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
    <span className="p4c-network-dot" style={{ background: chains[network]?.color ?? 'var(--sovereign-gold)' }} />
    {network}{chains[network] ? ` · ${chains[network].name}` : ''}
  </span>
);

const Receipt: React.FC<{ rows: Array<[string, React.ReactNode, boolean?]> }> = ({ rows }) => (
  <div className="p4c-receipt">
    {rows.map(([label, value, strong]) => (
      <div key={label} className={`p4c-receipt-row${strong ? ' p4c-receipt-row--strong' : ''}`}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    ))}
  </div>
);

const CountdownRing: React.FC<{ remaining: number; label: string }> = ({ remaining, label }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, remaining / QUOTE_TTL_MS);
  const seconds = Math.ceil(remaining / 1000);
  const color = seconds <= 20 ? 'var(--sovereign-error)' : 'var(--sovereign-gold)';
  return (
    <div title={label} aria-label={`${label}: ${seconds}s`} style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--sovereign-border)" strokeWidth="3" />
        <circle cx="20" cy="20" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="p4c-mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color }}>
        {seconds}s
      </span>
    </div>
  );
};

export default WithdrawalPage;
