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
  IonSpinner,
} from '@ionic/react';
import { QRCodeSVG } from 'qrcode.react';
import { copyOutline, checkmarkOutline, informationCircleOutline } from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import '../../ui/theme/variables.css';
import type { WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';

const AddFundsPage: React.FC = () => {
  const t = useT();
  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletResponse | null>(null);
  const [txId, setTxId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });
  const [copied, setCopied] = useState(false);

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

  const handleCopyAddress = async () => {
    if (!selectedWallet) return;
    try {
      await navigator.clipboard.writeText(selectedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ isOpen: true, message: 'Could not copy address', color: 'warning' });
    }
  };

  const handleSubmit = async () => {
    if (!selectedWallet) return;
    if (!txId.trim()) {
      setToast({ isOpen: true, message: 'Transaction ID is required.', color: 'warning' });
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setToast({ isOpen: true, message: 'Please enter a valid amount.', color: 'warning' });
      return;
    }
    if (amountNum < selectedWallet.minAmount) {
      setToast({ isOpen: true, message: `Minimum amount is $${selectedWallet.minAmount}.`, color: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await apiRepository.recharge({ txId: txId.trim(), amount: amountNum, coin: 'usdt' });
      setTxId('');
      setAmount('');
      setToast({ isOpen: true, message: t('recharge_success'), color: 'success' });
    } catch (err: any) {
      setToast({ isOpen: true, message: formatApiMessageForDisplay(err), color: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const receiveAmount = selectedWallet
    ? Math.max(0, parseFloat(amount || '0') - selectedWallet.fee)
    : 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{t('add_funds_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>

          {/* Select network */}
          <div style={{ marginBottom: '24px' }}>
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
                  '--background': 'var(--sovereign-surface)',
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

          {/* Wallet details card */}
          {selectedWallet && !walletsLoading && (
            <div
              style={{
                background: 'var(--sovereign-surface)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                animation: 'fadeInUp 0.4s ease',
              }}
            >
              {/* QR Code */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  padding: '16px',
                  background: '#ffffff',
                  borderRadius: '12px',
                }}
              >
                <QRCodeSVG
                  value={selectedWallet.address}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#0a1628"
                  level="M"
                />
              </div>

              {/* Network info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <InfoChip label={t('label_coin') || 'Coin'} value={selectedWallet.coin} />
                <InfoChip label={t('label_network') || 'Network'} value={selectedWallet.network} />
                <InfoChip label={t('label_min_withdrawal') || 'Min Amount'} value={`$${selectedWallet.minAmount}`} />
                <InfoChip label={t('label_network_withdrawal_fee') || 'Fee'} value={`$${selectedWallet.fee}`} />
              </div>

              {/* Address */}
              <div>
                <SectionLabel>{t('deposit_address')}</SectionLabel>
                <div
                  style={{
                    background: 'var(--sovereign-bg)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <IonText>
                    <span
                      style={{
                        color: 'var(--sovereign-text)',
                        fontSize: '13px',
                        wordBreak: 'break-all',
                        flex: 1,
                        fontFamily: 'monospace',
                      }}
                    >
                      {selectedWallet.address}
                    </span>
                  </IonText>
                  <IonIcon
                    icon={copied ? checkmarkOutline : copyOutline}
                    onClick={handleCopyAddress}
                    style={{
                      color: copied ? '#4caf50' : 'var(--sovereign-gold)',
                      fontSize: '20px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'color 0.2s',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Transaction form */}
          {selectedWallet && (
            <div
              style={{
                background: 'var(--sovereign-surface)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                animation: 'fadeInUp 0.5s ease',
              }}
            >
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '16px', margin: '0 0 20px 0' }}>
                  Submit Recharge Request
                </h3>
              </IonText>

              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>{t('label_transaction_id')}</SectionLabel>
                <IonInput
                  value={txId}
                  onIonInput={(e) => setTxId(e.detail.value ?? '')}
                  placeholder={t('label_transaction_id')}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>{t('label_amount')}</SectionLabel>
                <IonInput
                  type="number"
                  value={amount}
                  onIonInput={(e) => setAmount(e.detail.value ?? '')}
                  placeholder={`${t('label_min_withdrawal')} $${selectedWallet.minAmount}`}
                  min={String(selectedWallet.minAmount)}
                  step="0.01"
                  style={inputStyle}
                />
              </div>

              {parseFloat(amount) > 0 && (
                <div
                  style={{
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <IonText>
                    <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>
                      {t('label_network_withdrawal_fee') || 'Fee'}: -${selectedWallet.fee}
                    </span>
                  </IonText>
                  <IonText>
                    <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '15px' }}>
                      {t('withdrawal_you_will_receive').replace('%s', '')}: ${receiveAmount.toFixed(2)}
                    </span>
                  </IonText>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  background: 'rgba(138,155,191,0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '20px',
                }}
              >
                <IonIcon icon={informationCircleOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '18px', flexShrink: 0, marginTop: '1px' }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                    Send only {selectedWallet.coin} on the {selectedWallet.network} network to this address. Sending other assets may result in permanent loss.
                  </p>
                </IonText>
              </div>

              <SovereignPrimaryButton onClick={handleSubmit} loading={loading} expand="block">
                {loading ? <IonSpinner name="crescent" /> : t('verify_button')}
              </SovereignPrimaryButton>
            </div>
          )}

          <div style={{ height: '40px' }} />
        </div>

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          duration={4000}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, isOpen: false })}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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

const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      background: 'var(--sovereign-bg)',
      border: '1px solid var(--sovereign-border)',
      borderRadius: '8px',
      padding: '8px 12px',
    }}
  >
    <IonText>
      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>
        {label}
      </p>
    </IonText>
    <IonText>
      <p style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '14px', margin: 0 }}>
        {value}
      </p>
    </IonText>
  </div>
);

const inputStyle: React.CSSProperties = {
  '--background': 'var(--sovereign-bg)',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-end': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
} as React.CSSProperties;

export default AddFundsPage;
