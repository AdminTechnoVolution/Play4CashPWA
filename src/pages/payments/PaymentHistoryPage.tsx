import React, { useEffect, useState } from 'react';
import { IonIcon, IonSkeletonText } from '@ionic/react';
import { alertCircleOutline, arrowDownOutline, arrowUpOutline, receiptOutline } from 'ionicons/icons';
import { paymentsApi } from '../../data/network/PaymentsApi';
import type { PaymentOrder } from '../../data/network/PaymentsApi';
import { getUserAccount } from '../../data/auth/AuthSessionStore';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { useT } from '../../i18n/translations';
import { useLanguageStore } from '../../i18n/languageStore';
import { BalanceHero, failedStatuses, formatUsdt, Notice, PaymentsLayout, ReturnRequestCard, shortId, success } from './PaymentUi';
import type { Balance } from './PaymentUi';

const PaymentHistoryPage: React.FC = () => {
  const t = useT();
  const storageKey = `p4c:payment:${getUserAccount()?.id ?? ''}:history`;
  const [balance, setBalance] = useState<Balance | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [funds, rows] = await Promise.all([paymentsApi.balance(), paymentsApi.history()]);
        if (active) { setBalance(funds); setOrders(rows); }
      } catch (e) {
        if (active) { setOrders(current => current ?? []); setError(formatApiMessageForDisplay((e as Error).message)); }
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <PaymentsLayout title={t('payments_history_title')}>
      <BalanceHero balance={balance} direction={null} />
      {error && <Notice icon={alertCircleOutline} tone="error" role="alert"><p>{error}</p></Notice>}

      <div className="p4c-card" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
        {orders === null ? (
          [0, 1, 2].map(i => <IonSkeletonText key={i} animated style={{ height: '44px', borderRadius: '10px', margin: '12px 0' }} />)
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <IonIcon icon={receiptOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '34px' }} />
            <p className="p4c-hint" style={{ margin: '8px 0 0' }}>{t('payments_history_empty')}</p>
          </div>
        ) : orders.map(row => <HistoryRow key={row.id} order={row} />)}
      </div>

      <ReturnRequestCard storageKey={storageKey} />
    </PaymentsLayout>
  );
};

const HistoryRow: React.FC<{ order: PaymentOrder }> = ({ order }) => {
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

export default PaymentHistoryPage;
