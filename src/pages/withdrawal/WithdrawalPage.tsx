import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonText,
  IonIcon,
  IonSkeletonText,
  IonToast,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { walletOutline, cashOutline, informationCircleOutline, alertCircleOutline } from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import '../../ui/theme/variables.css';
import type { WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';

const WithdrawalPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();

  // Balance and daily limit come from the account stored locally — no URL params needed
  const { account } = useDashboardStore();
  const balance = account?.balance ?? 0;
  const dailyLimit = account?.limits?.dailyWithdrawal ?? 0;

  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletResponse | null>(null);
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });

  const remainingDailyLimit = dailyLimit;

  useEffect(() => {
    (async () => {
      setWalletsLoading(true);
      try {
        const data = await apiRepository.getWallets();
        setWallets(data);
        if (data.length > 0) setSelectedWallet(data[0]);
      } catch (err: any) {
        setError(formatApiMessageForDisplay(err));
      } finally {
        setWalletsLoading(false);
      }
    })();
  }, []);

  const amountNum = parseFloat(amount || '0');
  const fee = selectedWallet?.fee ?? 0;
  const youReceive = Math.max(0, amountNum - fee);

  const validate = (): string => {
    if (!walletAddress.trim()) return t('recharge_error_tx_required');
    if (!selectedWallet) return t('error_generic');
    if (isNaN(amountNum) || amountNum <= 0) return t('recharge_error_amount_invalid');
    if (amountNum < selectedWallet.minAmount) return `${t('label_min_withdrawal')} $${selectedWallet.minAmount}.`;
    if (amountNum > balance) return t('ERROR_WITHDRAWAL_INSUFFICIENT_BALANCE');
    if (amountNum > remainingDailyLimit) return t('daily_withdrawal_limit_exceeded_warning').replace('%s', `$${remainingDailyLimit}`);
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    if (!selectedWallet) return;

    setLoading(true);
    setFieldError('');
    try {
      await apiRepository.withdrawal({ amount: amountNum });
      navigate('/withdrawal-verify');
    } catch (err: any) {
      setFieldError(formatApiMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{t('withdrawal_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>

          {/* Balance display */}
          <div
            style={{
              background: 'linear-gradient(135deg, var(--sovereign-surface) 0%, var(--sovereign-surface-high) 100%)',
              border: '1px solid var(--sovereign-border)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', letterSpacing: '1px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                  {t('withdrawal_available_balance')}
                </p>
              </IonText>
              <IonText>
                <h2 style={{ color: 'var(--sovereign-gold)', fontSize: '28px', fontWeight: '800', margin: 0 }}>
                  ${balance.toFixed(2)}
                </h2>
              </IonText>
            </div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: 'rgba(201,168,76,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IonIcon icon={cashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '28px' }} />
            </div>
          </div>

          {/* Daily limit */}
          <div
            style={{
              background: 'rgba(138,155,191,0.08)',
              border: '1px solid rgba(138,155,191,0.15)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <IonIcon icon={informationCircleOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '18px', flexShrink: 0 }} />
            <IonText>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: 0 }}>
                {t('daily_withdrawal_limit_label').replace('%s', dailyLimit.toFixed(2))}
              </p>
            </IonText>
          </div>

          {/* Form card */}
          <div
            style={{
              background: 'var(--sovereign-surface)',
              border: '1px solid var(--sovereign-border)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            {/* Network */}
            <div style={{ marginBottom: '20px' }}>
              <SectionLabel>{t('label_network')}</SectionLabel>
              {walletsLoading ? (
                <IonSkeletonText animated style={{ height: '48px', borderRadius: '10px' }} />
              ) : (
                <IonSelect
                  value={selectedWallet?.network}
                  onIonChange={(e) => {
                    const w = wallets.find((w) => w.network === e.detail.value);
                    if (w) setSelectedWallet(w);
                  }}
                  interface="action-sheet"
                  placeholder="Select network"
                  style={{
                    '--background': 'transparent',
                    '--color': 'var(--sovereign-text)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    width: '100%',
                  } as React.CSSProperties}
                >
                  {wallets.map((w) => (
                    <IonSelectOption key={w.network} value={w.network}>
                      {w.coin} — {w.network}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              )}
            </div>

            {/* Wallet address */}
            <div style={{ marginBottom: '20px' }}>
              <SectionLabel>{t('label_wallet')}</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={walletOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '18px', flexShrink: 0 }} />
                <IonInput
                  value={walletAddress}
                  onIonInput={(e) => setWalletAddress(e.detail.value ?? '')}
                  placeholder="Enter your wallet address"
                  style={{
                    ...inputStyle,
                    flex: 1,
                  } as React.CSSProperties}
                />
              </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '20px' }}>
              <SectionLabel>{t('label_amount')}</SectionLabel>
              <IonInput
                type="number"
                value={amount}
                onIonInput={(e) => {
                  setAmount(e.detail.value ?? '');
                  setFieldError('');
                }}
                placeholder={selectedWallet ? `Min $${selectedWallet.minAmount}` : 'Amount'}
                min={String(selectedWallet?.minAmount ?? 0)}
                max={String(Math.min(balance, remainingDailyLimit))}
                step="0.01"
                style={inputStyle as React.CSSProperties}
              />
            </div>

            {/* Fee calculation */}
            {amountNum > 0 && selectedWallet && (
              <div
                style={{
                  background: 'var(--sovereign-bg)',
                  border: '1px solid var(--sovereign-border)',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>{t('label_amount')}</span>
                  </IonText>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-text)', fontSize: '13px' }}>${amountNum.toFixed(2)}</span>
                  </IonText>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>{t('label_network_withdrawal_fee')}</span>
                  </IonText>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-error)', fontSize: '13px' }}>-${fee.toFixed(2)}</span>
                  </IonText>
                </div>
                <div
                  style={{
                    borderTop: '1px solid var(--sovereign-border)',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <IonText>
                    <span style={{ color: 'var(--sovereign-text)', fontWeight: '600', fontSize: '14px' }}>{t('withdrawal_you_will_receive').replace('%s', '')}</span>
                  </IonText>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-gold)', fontWeight: '800', fontSize: '16px' }}>
                      ${youReceive.toFixed(2)}
                    </span>
                  </IonText>
                </div>
              </div>
            )}

            {/* Error */}
            {fieldError && (
              <div
                style={{
                  background: 'rgba(207,102,121,0.12)',
                  border: '1px solid rgba(207,102,121,0.4)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}
              >
                <IonIcon icon={alertCircleOutline} style={{ color: 'var(--sovereign-error)', fontSize: '18px', flexShrink: 0, marginTop: '1px' }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-error)', fontSize: '13px', margin: 0 }}>{fieldError}</p>
                </IonText>
              </div>
            )}

            <SovereignPrimaryButton onClick={handleSubmit} loading={loading} expand="block">
              {loading ? t('loading') : t('withdrawal_request_button')}
            </SovereignPrimaryButton>
          </div>

          <div style={{ height: '40px' }} />
        </div>

        <IonToast
          isOpen={toast.isOpen}
          message={formatApiMessageForDisplay(toast.message)}
          duration={3000}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, isOpen: false })}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <IonText>
    <label
      style={{
        color: 'var(--sovereign-text-muted)',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '1px',
        display: 'block',
        marginBottom: '8px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  </IonText>
);

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

export default WithdrawalPage;
