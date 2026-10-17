import React, { useEffect, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon, IonSkeletonText } from '@ionic/react';
import { arrowDownOutline, arrowUpOutline, checkmarkCircle, checkmarkOutline, cubeOutline, flaskOutline, gameControllerOutline, helpBuoyOutline, walletOutline } from 'ionicons/icons';
import { AppBackButton } from '../../navigation/AppBackButton';
import { paymentsApi } from '../../data/network/PaymentsApi';
import type { PaymentNetwork, PaymentOrder } from '../../data/network/PaymentsApi';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { useT } from '../../i18n/translations';
import { useLanguageStore } from '../../i18n/languageStore';
import { SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import '../../ui/theme/variables.css';
import './payments.css';

export type Balance = { available: string; reserved: string };

export const chains: Record<string, { name: string; color: string }> = {
  TRC20: { name: 'Tron', color: '#ff3b3f' },
  ERC20: { name: 'Ethereum', color: '#627eea' },
  BEP20: { name: 'BNB Smart Chain', color: '#f3ba2f' },
  POLYGON: { name: 'Polygon', color: '#8247e5' },
  ARBITRUM: { name: 'Arbitrum', color: '#28a0f0' },
  TON: { name: 'TON', color: '#0098ea' },
  SOLANA: { name: 'Solana', color: '#14f195' },
};
export const terminal = new Set(['confirmed', 'rejected', 'failed', 'refunded', 'expired', 'verification_delivery_failed']);
export const failedStatuses = new Set(['rejected', 'failed', 'refunded', 'expired', 'verification_delivery_failed']);
export const success = '#4caf50';
export const usdtAmount = /^\d{1,18}(\.\d{1,6})?$/;

/** Money strings arrive with 6 decimals; show at least 2, drop trailing zeros and group thousands like formatUSD. */
export function formatUsdt(value?: string): string {
  const [whole = '0', fraction = ''] = (value ?? '0').split('.');
  // Grouped on the string, not via Number, so 18-digit amounts keep every digit.
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
}

export const isValidAmount = (value: string) => usdtAmount.test(value) && /[1-9]/.test(value);

/** Estimates are shown in cents, rounding fees up and credits down so the screen never promises more than settles. */
export const approxFee = (value: number | string) => (Math.ceil(Number(value) * 100) / 100).toFixed(2);
export const approxCredit = (value: number | string) => (Math.floor(Number(value) * 100) / 100).toFixed(2);

/** Approximate deposit fee for `amount` (0 when not entered): fixed network part + service rate. */
export function estimateDepositFee(network: PaymentNetwork, amount: string): number | null {
  if (!network.depositFee) return null;
  return Number(network.depositFee.fixed) + (isValidAmount(amount) ? Number(amount) : 0) * Number(network.depositFee.rate);
}

/** The network with the lowest estimated fee, only when at least two can be compared. */
export function cheapestNetwork(networks: PaymentNetwork[], amount: string): string | null {
  const priced = networks.map(n => [n.network, estimateDepositFee(n, amount)] as const).filter((row): row is readonly [string, number] => row[1] !== null);
  if (priced.length < 2) return null;
  return priced.reduce((best, row) => (row[1] < best[1] ? row : best))[0];
}

/** Reuses the idempotency key while the same request is retried, so a double tap never creates two operations. */
export function requestKey(storageKey: string, input: unknown): string {
  const serialized = JSON.stringify(input);
  const saved = JSON.parse(sessionStorage.getItem(`${storageKey}:request`) ?? 'null');
  if (saved?.input === serialized) return saved.key as string;
  const key = crypto.randomUUID();
  sessionStorage.setItem(`${storageKey}:request`, JSON.stringify({ key, input: serialized }));
  return key;
}

/** Polls a non-terminal order and the balance every 5 seconds. */
export function useOrderPolling(order: PaymentOrder | null, onUpdate: (next: PaymentOrder, funds: Balance) => void) {
  useEffect(() => {
    if (!order || terminal.has(order.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const [next, funds] = await Promise.all([paymentsApi.order(order.id), paymentsApi.balance()]);
        if (active) onUpdate(next, funds);
      } catch { /* Keep the last known status while the connection recovers. */ }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [order?.id, order?.status]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const PaymentsLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const t = useT();
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><AppBackButton to="/dashboard" /></IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div className="p4c-pay">
          <Notice icon={flaskOutline}>
            <p style={{ color: 'var(--sovereign-gold)', fontWeight: 700 }}>{t('deposit_sandbox_title')}</p>
            <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', marginTop: '4px' }}>{t('deposit_sandbox_text')}</p>
          </Notice>
          {children}
          <div style={{ height: '40px' }} />
        </div>
      </IonContent>
    </IonPage>
  );
};

export const Notice: React.FC<{ icon: string; tone?: 'warning' | 'error'; role?: string; children: React.ReactNode }> = ({ icon, tone, role, children }) => (
  <div role={role} className={`p4c-notice${tone ? ` p4c-notice--${tone}` : ''}`}>
    <IonIcon icon={icon} />
    <div>{children}</div>
  </div>
);

export const Label: React.FC<{ id?: string; htmlFor?: string; children: React.ReactNode }> = ({ id, htmlFor, children }) => (
  <label id={id} htmlFor={htmlFor} className="p4c-label">{children}</label>
);

/** Balance card with the animated path the money travels: wallet → network → Play4Cash (or the reverse). */
export const BalanceHero: React.FC<{ balance: Balance | null; direction: 'deposit' | 'withdrawal' | null; network?: string }> = ({ balance, direction, network }) => {
  const t = useT();
  const app = { icon: gameControllerOutline, caption: 'Play4Cash' };
  const wallet = { icon: walletOutline, caption: t('payments_flow_wallet') };
  const chain = { icon: cubeOutline, caption: network ? `USDT · ${network}` : 'USDT' };
  const nodes = direction === 'deposit' ? [wallet, chain, app] : [app, chain, wallet];
  const reserved = balance && /[1-9]/.test(balance.reserved);
  return (
    <div className="p4c-card p4c-hero">
      <div className="p4c-hero-row">
        <div className="p4c-hero-icon"><IonIcon icon={walletOutline} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Label>{t('your_balance')}</Label>
          {balance ? (
            <p className="p4c-hero-amount p4c-mono">{formatUsdt(balance.available)} <small>USDT</small></p>
          ) : <IonSkeletonText animated style={{ width: '55%', height: '26px', borderRadius: '6px', margin: 0 }} />}
          {reserved && <p className="p4c-hero-sub">{t('payments_reserved_label')}: <span className="p4c-mono">{formatUsdt(balance.reserved)} USDT</span></p>}
        </div>
      </div>
      {direction && (
        <div className="p4c-chain" aria-hidden="true">
          {nodes.map((node, i) => (
            <React.Fragment key={node.caption}>
              {i > 0 && <div className="p4c-chain-link" />}
              <div className={`p4c-chain-node${i === 1 ? ' p4c-chain-node--active' : ''}`}>
                <div className="p4c-chain-box"><IonIcon icon={node.icon} /></div>
                <span className="p4c-chain-caption">{node.caption}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

/** `feeAmount` turns on deposit fee estimates for the amount being typed. */
export const NetworkPicker: React.FC<{
  networks: PaymentNetwork[] | null; value: string; disabled?: boolean; feeAmount?: string; showMinimum?: boolean; onChange: (network: string) => void;
}> = ({ networks, value, disabled, feeAmount, showMinimum, onChange }) => {
  const t = useT();
  const showFees = feeAmount !== undefined && !!networks?.some(n => n.depositFee);
  const cheapest = showFees && networks ? cheapestNetwork(networks, feeAmount) : null;
  return (
    <>
      <Label id="payment-network-label">{t('deposit_network_label')}</Label>
      {networks === null ? (
        <div className="p4c-networks">
          {[0, 1].map(i => <IonSkeletonText key={i} animated style={{ height: '58px', borderRadius: '12px', margin: 0 }} />)}
        </div>
      ) : networks.length === 0 ? (
        <p className="p4c-hint" style={{ marginBottom: '20px' }}>{t('deposit_networks_empty')}</p>
      ) : (
        <div role="radiogroup" aria-labelledby="payment-network-label" className={`p4c-networks${cheapest ? ' p4c-networks--badged' : ''}`}>
          {networks.map(n => {
            const chain = chains[n.network];
            const selected = n.network === value;
            const fee = showFees ? estimateDepositFee(n, feeAmount) : null;
            return (
              <button key={n.network} type="button" role="radio" aria-checked={selected} disabled={disabled}
                className="p4c-network" onClick={() => onChange(n.network)}>
                <span className="p4c-network-code">
                  <span className="p4c-network-dot" style={{ background: chain?.color ?? 'var(--sovereign-gold)', boxShadow: `0 0 8px ${chain?.color ?? 'transparent'}` }} />
                  {n.network}
                </span>
                <span className="p4c-network-chain">{chain?.name ?? n.network}</span>
                {showMinimum && n.minDeposit && (
                  <span className="p4c-network-chain p4c-mono">{t('deposit_network_minimum').replace('%s', formatUsdt(n.minDeposit))}</span>
                )}
                {fee !== null && (
                  <span className={`p4c-network-fee p4c-mono${n.network === cheapest ? ' p4c-network-fee--best' : ''}`}>
                    {isValidAmount(feeAmount ?? '') ? `≈ ${approxFee(fee)} USDT` : t('deposit_fee_from').replace('%s', `${approxFee(fee)} USDT`)}
                  </span>
                )}
                {n.network === cheapest && <span className="p4c-network-badge">{t('deposit_cheapest')}</span>}
                {selected && <IonIcon icon={checkmarkCircle} className="p4c-network-check" />}
              </button>
            );
          })}
        </div>
      )}
      {showFees && <p className="p4c-hint" style={{ marginTop: '-10px', marginBottom: '18px' }}>{t('deposit_fee_note')}</p>}
    </>
  );
};

/** `step` is the index of the stage in progress; `step === labels.length` means everything is done. */
export const Steps: React.FC<{ labels: string[]; step: number }> = ({ labels, step }) => (
  <div className="p4c-steps">
    {labels.map((label, i) => (
      <React.Fragment key={label}>
        {i > 0 && <div className={`p4c-step-link${i <= step ? ' p4c-step-link--done' : ''}`} />}
        <div className={`p4c-step${i < step ? ' p4c-step--done' : i === step ? ' p4c-step--current' : ''}`}>
          <div className="p4c-step-dot">{i < step ? <IonIcon icon={checkmarkOutline} style={{ fontSize: '16px' }} /> : i + 1}</div>
          <span className="p4c-step-label">{label}</span>
        </div>
      </React.Fragment>
    ))}
  </div>
);

/** Status header shared by deposit and withdrawal orders. */
export const OrderHeader: React.FC<{ order: PaymentOrder; label: string; icon: string; color: string }> = ({ order, label, icon, color }) => {
  const t = useT();
  return (
    <>
      <div className="p4c-status">
        <div className="p4c-status-title">
          <IonIcon icon={icon} style={{ color }} />
          <h2>{label}</h2>
        </div>
        <span className="p4c-pill">USDT · {order.network}</span>
      </div>
      <div className="p4c-meta">
        <span>{t('payments_order_id')}: <span className="p4c-mono">{shortId(order.id)}</span></span>
        {!terminal.has(order.status) && <span className="p4c-live">{t('payments_live_updates')}</span>}
      </div>
    </>
  );
};

export const Receipt: React.FC<{ rows: Array<[string, React.ReactNode, boolean?]> }> = ({ rows }) => (
  <div className="p4c-receipt">
    {rows.map(([label, value, strong]) => (
      <div key={label} className={`p4c-receipt-row${strong ? ' p4c-receipt-row--strong' : ''}`}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    ))}
  </div>
);

export const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

/** IonInput styling inside a `.p4c-field` wrapper. */
export const fieldInputStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  '--highlight-height': '0px',
  flex: 1,
} as React.CSSProperties;

/** Lets the user ask for a supervised review of existing funds (e.g. after a provider rejection). */
export const ReturnRequestCard: React.FC<{ storageKey: string }> = ({ storageKey }) => {
  const t = useT();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setLoading(true); setError('');
    try {
      await paymentsApi.requestReturn(requestKey(storageKey, { returnReason: reason }), reason);
      setDone(true);
    } catch (e) { setError(formatApiMessageForDisplay((e as Error).message)); } finally { setLoading(false); }
  };
  return (
    <div className="p4c-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span className="p4c-hero-icon" style={{ width: '32px', height: '32px', borderRadius: '9px', fontSize: '17px' }}><IonIcon icon={helpBuoyOutline} /></span>
        <p className="p4c-card-title" style={{ margin: 0 }}>{t('payments_return_title')}</p>
      </div>
      <p className="p4c-hint" style={{ marginTop: 0 }}>{t('payments_return_text')}</p>
      {done ? (
        <Notice icon={checkmarkCircle}><p>{t('payments_return_done')}</p></Notice>
      ) : (
        <>
          <Label htmlFor="return-reason">{t('payments_return_reason')}</Label>
          <textarea id="return-reason" className="p4c-textarea" maxLength={500} value={reason} disabled={loading} onChange={e => setReason(e.target.value)} />
          {error && <p className="p4c-hint p4c-hint--error" style={{ marginTop: '-6px' }}>{error}</p>}
          <SovereignSecondaryButton onClick={submit} loading={loading} disabled={reason.trim().length < 10}>{t('payments_return_button')}</SovereignSecondaryButton>
        </>
      )}
    </div>
  );
};

/** One provider deposit or withdrawal, as listed in the history. */
export const PaymentOrderRow: React.FC<{ order: PaymentOrder }> = ({ order }) => {
  const t = useT();
  const lang = useLanguageStore(s => s.lang);
  const deposit = order.kind === 'deposit';
  const failed = failedStatuses.has(order.status);
  const status = deposit && order.status === 'verification_delivery_failed' ? 'failed' : order.status;
  const statusColor = order.status === 'confirmed' ? success : failed ? 'var(--sovereign-error)' : 'var(--sovereign-gold)';
  const kindColor = deposit ? success : 'var(--sovereign-gold)';
  const value = formatUsdt(deposit ? order.credited ?? order.amount : order.amount);
  return (
    <div className="p4c-tx">
      <div className="p4c-tx-icon" style={{ color: kindColor }}><IonIcon icon={deposit ? arrowDownOutline : arrowUpOutline} /></div>
      <div className="p4c-tx-main">
        <p className="p4c-tx-title">{t(deposit ? 'payments_kind_deposit' : 'payments_kind_withdrawal')} · {order.network}</p>
        <p className="p4c-tx-sub">
          <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}</time> · <span className="p4c-mono">{shortId(order.id)}</span>
        </p>
      </div>
      <div className="p4c-tx-amount">
        <strong className="p4c-mono" style={{ color: failed ? 'var(--sovereign-text-muted)' : deposit && order.status === 'confirmed' ? success : 'var(--sovereign-text)',
          textDecoration: failed ? 'line-through' : undefined }}>
          {failed ? '' : deposit ? '+' : '−'}{value}
        </strong>
        <span style={{ color: statusColor }}>{t(`${deposit ? 'deposit' : 'withdraw'}_status_${status}`)}</span>
      </div>
    </div>
  );
};
