import React, { useEffect, useState } from 'react';
import { IonInput, IonIcon, IonSpinner } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { alertCircleOutline, checkmarkCircle, checkmarkOutline, closeCircleOutline, copyOutline, hourglassOutline, timeOutline, warningOutline } from 'ionicons/icons';
import { paymentsApi } from '../../data/network/PaymentsApi';
import type { PaymentNetwork, PaymentOrder } from '../../data/network/PaymentsApi';
import { getUserAccount } from '../../data/auth/AuthSessionStore';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { useT } from '../../i18n/translations';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import {
  BalanceHero, failedStatuses, fieldInputStyle, formatUsdt, isValidAmount, Label, NetworkPicker, Notice, OrderHeader, PaymentsLayout,
  requestKey, Steps, success, terminal, useOrderPolling,
} from './PaymentUi';
import type { Balance } from './PaymentUi';

const quickAmounts = ['10', '25', '50', '100'];

/** 0 = waiting for payment, 1 = confirming on chain, 3 = credited (all stages done). */
function progressStep(status: string): number {
  if (status === 'confirmed') return 3;
  if (status === 'confirming') return 1;
  return 0;
}

const DepositPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { refreshAccount } = useDashboardStore();
  const storageKey = `p4c:payment:${getUserAccount()?.id ?? ''}:deposit`;
  const [networks, setNetworks] = useState<PaymentNetwork[] | null>(null);
  const [network, setNetwork] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<Balance | null>(null);
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

  useOrderPolling(order, (next, funds) => {
    setOrder(next); setBalance(funds);
    if (next.status === 'confirmed') refreshAccount();
  });

  const validAmount = isValidAmount(amount);

  const createDeposit = async () => {
    setLoading(true); setError('');
    try {
      const next = await paymentsApi.deposit(requestKey(storageKey, { network, amount }), network, amount);
      setOrder(next); sessionStorage.setItem(`${storageKey}:order`, next.id);
    } catch (e) {
      setError(formatApiMessageForDisplay((e as Error).message));
    } finally { setLoading(false); }
  };

  const reset = () => {
    sessionStorage.removeItem(`${storageKey}:order`); sessionStorage.removeItem(`${storageKey}:request`);
    setOrder(null); setAmount(''); setError('');
  };

  return (
    <PaymentsLayout title={t('add_funds_title')}>
      <BalanceHero balance={balance} direction="deposit" network={order?.network ?? network} />

      {error && <Notice icon={alertCircleOutline} tone="error" role="alert"><p>{error}</p></Notice>}

      {!order ? (
        <div className="p4c-card">
          <p className="p4c-card-title">{t('recharge_intent_amount_title')}</p>
          <NetworkPicker networks={networks} value={network} disabled={loading} onChange={setNetwork} />

          <Label>{t('deposit_amount_label')}</Label>
          <div className={`p4c-field${amount && !validAmount ? ' p4c-field--error' : ''}`}>
            <IonInput aria-label={t('deposit_amount_label')} inputmode="decimal" placeholder="0.00" value={amount} disabled={loading}
              onIonInput={e => setAmount(String(e.detail.value ?? '').trim())} style={{ ...fieldInputStyle, fontSize: '18px', fontWeight: 700 }} className="p4c-mono" />
            <span className="p4c-field-suffix">USDT</span>
          </div>
          <div className="p4c-chips">
            {quickAmounts.map(value => (
              <button key={value} type="button" className="p4c-chip" aria-pressed={amount === value} disabled={loading} onClick={() => setAmount(value)}>
                {value}
              </button>
            ))}
          </div>
          <p className="p4c-hint p4c-hint--error">{amount && !validAmount ? t('recharge_error_amount_invalid') : ''}</p>

          <SovereignPrimaryButton onClick={createDeposit} loading={loading} disabled={!validAmount || !network}>
            {t('deposit_create_button')}
          </SovereignPrimaryButton>
        </div>
      ) : (
        <DepositOrderCard order={order} onNew={reset} onHome={() => navigate('/dashboard')} />
      )}
    </PaymentsLayout>
  );
};

const DepositOrderCard: React.FC<{ order: PaymentOrder; onNew: () => void; onHome: () => void }> = ({ order, onNew, onHome }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const isFailed = failedStatuses.has(order.status);
  const isConfirmed = order.status === 'confirmed';
  const credited = formatUsdt(order.credited ?? order.amount);
  const label = t(`deposit_status_${order.status === 'verification_delivery_failed' ? 'failed' : order.status}`);
  const color = isConfirmed ? success : isFailed ? 'var(--sovereign-error)' : 'var(--sovereign-gold)';
  const icon = isConfirmed ? checkmarkCircle : isFailed ? closeCircleOutline : order.status === 'confirming' ? hourglassOutline : timeOutline;

  const copyAddress = async () => {
    if (!order.address) return;
    try {
      await navigator.clipboard.writeText(order.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  return (
    <div className="p4c-card">
      <OrderHeader order={order} label={label} icon={icon} color={color} />
      {!isFailed && <Steps step={progressStep(order.status)} labels={[t('deposit_step_payment'), t('deposit_step_confirming'), t('deposit_step_credited')]} />}

      {isConfirmed ? (
        <div className="p4c-result">
          <p className="p4c-result-amount p4c-mono" style={{ color: success }}>+{credited} USDT</p>
          <p className="p4c-result-text">{t('deposit_credited_text').replace('%s', credited)}</p>
        </div>
      ) : isFailed ? (
        <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
          {order.reviewReason === 'provider_rejected' ? t('deposit_provider_rejected') : t('deposit_failed_text')}
        </p>
      ) : !order.address ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '28px 0' }}>
          <IonSpinner name="crescent" style={{ color: 'var(--sovereign-gold)' }} />
          <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px' }}>{t('deposit_preparing_address')}</span>
        </div>
      ) : (
        <>
          <Label>{t('recharge_intent_exact_amount_title')}</Label>
          <div className="p4c-amount-box p4c-mono">{formatUsdt(order.payAmount ?? order.amount)} <small>USDT</small></div>

          <div className="p4c-qr"><div><QRCodeSVG value={order.address} size={176} /></div></div>

          <Label>{t('deposit_address')}</Label>
          <button type="button" className="p4c-address p4c-mono" onClick={copyAddress} aria-label={t('copy_to_clipboard')}>
            <span>{order.address}</span>
            <IonIcon icon={copied ? checkmarkOutline : copyOutline} style={copied ? { color: success } : undefined} />
          </button>
          <p className="p4c-hint" style={{ color: copied ? success : undefined }}>{copied ? t('copied_to_clipboard') : ''}</p>

          <Notice icon={warningOutline} tone="warning"><p>{t('deposit_only_usdt_warning').replace('%s', order.network)}</p></Notice>
          <p className="p4c-hint" style={{ margin: 0 }}>{t('deposit_net_credit_note')}</p>
        </>
      )}

      {order.status === 'uncertain' && <p className="p4c-hint" style={{ marginBottom: 0 }}>{t('deposit_uncertain_note')}</p>}

      {terminal.has(order.status) && (
        <div className="p4c-actions">
          <SovereignPrimaryButton onClick={onNew}>{t('deposit_new_button')}</SovereignPrimaryButton>
          {isConfirmed && <SovereignSecondaryButton onClick={onHome}>{t('deposit_back_home')}</SovereignSecondaryButton>}
        </div>
      )}
    </div>
  );
};

export default DepositPage;
