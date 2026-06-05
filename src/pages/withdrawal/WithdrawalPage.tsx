import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonInput,
  IonText,
  IonIcon,
  IonAlert,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { informationCircleOutline, alertCircleOutline } from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { AppBackButton } from '../../navigation/AppBackButton';
import '../../ui/theme/variables.css';
import type { WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';

const ERROR_WITHDRAWAL_PENDING_VERIFY = 'ERROR_WITHDRAWAL_PENDING_VERIFY';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const WithdrawalPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();

  const { account, refreshAccount } = useDashboardStore();

  const [balance, setBalance] = useState(account?.balance ?? 0);
  const [dailyLimit, setDailyLimit] = useState(account?.limits?.dailyWithdrawal ?? 0);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Wallet destination info (read-only, from account + wallets API)
  const [walletInfo, setWalletInfo] = useState<{ coin: string; network: string; address: string } | null>(null);
  const [minAmount, setMinAmount] = useState(0);
  const [networkFee, setNetworkFee] = useState(0);

  // AlertDialog state (matches Android pattern)
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [navigateToVerifyOnDismiss, setNavigateToVerifyOnDismiss] = useState(false);

  useEffect(() => {
    if (!alertOpen && navigateToVerifyOnDismiss) {
      setNavigateToVerifyOnDismiss(false);
      navigate('/withdrawal-verify');
    }
  }, [alertOpen, navigateToVerifyOnDismiss, navigate]);

  useEffect(() => {
    (async () => {
      try {
        if (!account) {
          refreshAccount();
        }
        apiRepository.invalidateAccountCache();
        const acc = await apiRepository.getUserAccount();
        setBalance(acc.balance ?? 0);
        setDailyLimit(acc.limits?.dailyWithdrawal ?? 0);

        const walletAddr = acc.walletAddress;
        const walletCoin = acc.walletCoin || 'USDT';
        const walletNet = acc.walletNetwork || '';

        if (walletAddr) {
          const wallets = await apiRepository.getWallets();
          const matched = wallets.find(
            (w) =>
              w.network.toLowerCase() === walletNet.toLowerCase() ||
              w.network.toLowerCase().includes(walletNet.toLowerCase()) ||
              walletNet.toLowerCase().includes(w.network.toLowerCase()),
          );
          const networkDisplay = matched
            ? `${matched.network}${matched.description ? ' - ' + matched.description : ''}`
            : walletNet || '—';
          setWalletInfo({ coin: walletCoin, network: networkDisplay, address: walletAddr });
          setMinAmount(matched?.minAmount ?? 0);
          setNetworkFee(matched?.fee ?? 0);
        }
      } catch (err: any) {
        setError(formatApiMessageForDisplay(err));
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = parseInt(amountText, 10) || 0;
  const netReceive = Math.max(0, amount - networkFee);

  const exceedsBalance = balance > 0 && amount > balance;
  const exceedsDailyLimit = dailyLimit > 0 && amount > dailyLimit;
  const belowMinimum = minAmount > 0 && amount > 0 && amount < minAmount;
  const belowFee = networkFee > 0 && amount > 0 && amount <= networkFee;

  const amountError = (() => {
    if (exceedsBalance)
      return t('withdrawal_amount_exceeds_balance').replace('%s', formatCurrency(balance));
    if (exceedsDailyLimit)
      return t('daily_withdrawal_limit_exceeded_warning').replace('%s', formatCurrency(dailyLimit));
    if (belowMinimum)
      return t('withdrawal_amount_below_minimum').replace('%s', formatCurrency(minAmount));
    if (belowFee)
      return t('withdrawal_amount_below_fee').replace('%s', formatCurrency(networkFee));
    return '';
  })();

  const canSubmit = amount > 0 && !exceedsBalance && !exceedsDailyLimit && !belowMinimum && !belowFee && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await apiRepository.withdrawal({ amount });
      setAlertMessage(t('withdrawal_success'));
      setNavigateToVerifyOnDismiss(true);
      setAlertOpen(true);
    } catch (err: any) {
      const raw = (err.message ?? '').trim();
      if (raw.includes(ERROR_WITHDRAWAL_PENDING_VERIFY)) {
        setAlertMessage(t(ERROR_WITHDRAWAL_PENDING_VERIFY));
        setNavigateToVerifyOnDismiss(true);
      } else {
        setAlertMessage(formatApiMessageForDisplay(err.message, 'error_try_later_message'));
        setNavigateToVerifyOnDismiss(false);
      }
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertOk = () => {
    setAlertOpen(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <AppBackButton to="/dashboard" />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>
            {t('withdrawal_title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>

          {/* Wallet destination card (read-only, matching Android) */}
          {walletInfo && (
            <div style={cardStyle}>
              <IonText>
                <p style={cardTitleStyle}>{t('withdrawal_destination')}</p>
              </IonText>
              <div style={{ marginTop: '12px' }}>
                <InfoRow label={t('label_coin')} value={walletInfo.coin} />
                <InfoRow label={t('label_network')} value={walletInfo.network} />
                <InfoRow label={t('label_wallet')} value={walletInfo.address} mono />
                {minAmount > 0 && (
                  <InfoRow label={t('label_min_withdrawal')} value={formatCurrency(minAmount)} />
                )}
                {networkFee > 0 && (
                  <IonText>
                    <p style={hintStyle}>
                      {t('withdrawal_fee_charged_note').replace('%s', formatCurrency(networkFee))}
                    </p>
                  </IonText>
                )}
              </div>
            </div>
          )}

          {/* Amount card */}
          <div style={cardStyle}>
            {/* Available balance */}
            <IonText>
              <p style={{ ...cardTitleStyle, marginBottom: '4px' }}>
                {t('withdrawal_available_balance')}: {formatCurrency(balance)}
              </p>
            </IonText>

            {/* Daily limit */}
            {dailyLimit > 0 && (
              <IonText>
                <p style={hintStyle}>
                  {t('daily_withdrawal_limit_label').replace('%s', formatCurrency(dailyLimit))}
                </p>
              </IonText>
            )}

            {/* Amount input */}
            <div style={{ marginTop: '16px', marginBottom: '4px' }}>
              <SectionLabel>{t('withdrawal_amount_label')}</SectionLabel>
              <IonInput
                type="number"
                inputmode="numeric"
                value={amountText}
                onIonInput={(e) => {
                  const v = e.detail.value ?? '';
                  if (v === '' || /^\d*$/.test(v)) setAmountText(v);
                }}
                placeholder="0"
                style={{
                  ...inputStyle,
                  ...(amountError ? { border: '1px solid var(--sovereign-error)' } : {}),
                } as React.CSSProperties}
              />
            </div>

            {/* Validation error */}
            {amountError && (
              <div style={errorBoxStyle}>
                <IonIcon icon={alertCircleOutline} style={{ color: 'var(--sovereign-error)', fontSize: '16px', flexShrink: 0, marginTop: '1px' }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-error)', fontSize: '12px', margin: 0 }}>{amountError}</p>
                </IonText>
              </div>
            )}

            {/* You will receive */}
            {amount > 0 && !amountError && (
              <IonText>
                <p style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '15px', margin: '12px 0 0 0' }}>
                  {t('withdrawal_you_will_receive').replace('%s', formatCurrency(netReceive))}
                </p>
              </IonText>
            )}

            <div style={{ marginTop: '24px' }}>
              <SovereignPrimaryButton onClick={handleSubmit} loading={loading} disabled={!canSubmit} expand="block">
                {t('withdrawal_request_button')}
              </SovereignPrimaryButton>
            </div>
          </div>

          <div style={{ height: '40px' }} />
        </div>

        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={handleAlertOk}
          header={t('information')}
          message={alertMessage}
          buttons={[{ text: t('ok'), handler: handleAlertOk }]}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

/* ── Sub-components ── */

const InfoRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
    <IonText>
      <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', fontWeight: '700' }}>{label}:</span>
    </IonText>
    <IonText style={{ flex: 1, minWidth: 0 }}>
      <span style={{ color: 'var(--sovereign-text)', fontSize: '13px', wordBreak: 'break-all', ...(mono ? { fontFamily: 'monospace' } : {}) }}>
        {value}
      </span>
    </IonText>
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <IonText>
    <label style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
      {children}
    </label>
  </IonText>
);

/* ── Styles ── */

const cardStyle: React.CSSProperties = {
  background: 'var(--sovereign-surface)',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
};

const cardTitleStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted)',
  fontSize: '13px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: 0,
};

const hintStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted)',
  fontSize: '12px',
  margin: '6px 0 0 0',
  lineHeight: '1.5',
};

const inputStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-end': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
};

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'flex-start',
  marginTop: '8px',
};

export default WithdrawalPage;
