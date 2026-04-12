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
  IonAlert,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { copyOutline, checkmarkOutline } from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import '../../ui/theme/variables.css';
import type { WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';

function isValidDepositAmountInput(s: string): boolean {
  if (s === '') return true;
  if ((s.match(/\./g) || []).length > 1) return false;
  return /^\d*(\.\d*)?$/.test(s);
}

const AddFundsPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { refreshAccount } = useDashboardStore();

  const [step, setStep] = useState(1);
  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Step 2 form
  const [txId, setTxId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alert state (matches Android AlertDialog)
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!alertOpen && isSuccess) {
      setIsSuccess(false);
      refreshAccount();
      navigate('/dashboard');
    }
  }, [alertOpen, isSuccess, refreshAccount, navigate]);

  useEffect(() => {
    (async () => {
      setWalletsLoading(true);
      try {
        const acc = await apiRepository.getUserAccount();
        const userNetwork = acc.walletNetwork || '';
        const allWallets = await apiRepository.getWallets();
        const active = allWallets.filter((w) => w.isActive);
        setWallets(active);

        const idx = userNetwork
          ? active.findIndex(
              (w) =>
                w.network.toLowerCase() === userNetwork.toLowerCase() ||
                w.network.toLowerCase().includes(userNetwork.toLowerCase()) ||
                userNetwork.toLowerCase().includes(w.network.toLowerCase()),
            )
          : -1;
        setSelectedWalletIndex(idx >= 0 ? idx : 0);
      } catch (err: any) {
        setError(formatApiMessageForDisplay(err));
      } finally {
        setWalletsLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedWallet = wallets[selectedWalletIndex] ?? null;
  const depositAddress = selectedWallet?.address ?? '';

  const handleCopyAddress = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleSubmit = () => {
    const txIdTrimmed = txId.trim();
    const amountDouble = parseFloat(amountText.trim());

    if (!txIdTrimmed) {
      setAlertMessage(t('recharge_error_tx_required'));
      setAlertOpen(true);
      return;
    }
    if (isNaN(amountDouble) || amountDouble <= 0) {
      setAlertMessage(t('recharge_error_amount_invalid'));
      setAlertOpen(true);
      return;
    }

    setIsSubmitting(true);
    (async () => {
      try {
        await apiRepository.recharge({
          txId: txIdTrimmed,
          amount: amountDouble,
          coin: 'usdt',
        });
        setAlertMessage(t('recharge_success'));
        setIsSuccess(true);
        setAlertOpen(true);
      } catch (err: any) {
        setAlertMessage(formatApiMessageForDisplay(err.message, 'error_try_later_message'));
        setIsSuccess(false);
        setAlertOpen(true);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>
            {t('add_funds_title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>

          {step === 1 ? (
            <>
              {/* Important information card */}
              <div style={cardStyle}>
                <IonText>
                  <p style={{ ...cardTitleStyle, fontSize: '15px' }}>{t('important_information')}</p>
                </IonText>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: '12px 0 0 0', lineHeight: '1.6' }}>
                    {t('add_funds_important_info_text')}
                  </p>
                </IonText>
              </div>

              {/* Wallet selection card */}
              <div style={cardStyle}>
                {/* Coin (read-only) */}
                <div style={{ marginBottom: '16px' }}>
                  <SectionLabel>{t('label_coin')}</SectionLabel>
                  <IonInput
                    value={selectedWallet?.coin || 'USDT'}
                    readonly
                    style={inputStyle}
                  />
                </div>

                {/* Network dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <SectionLabel>{t('label_network')}</SectionLabel>
                  {walletsLoading ? (
                    <div style={{ ...inputStyleBase, color: 'var(--sovereign-text-muted)', padding: '14px' }}>...</div>
                  ) : (
                    <IonSelect
                      value={selectedWallet?.network}
                      onIonChange={(e) => {
                        const idx = wallets.findIndex((w) => w.network === e.detail.value);
                        if (idx >= 0) setSelectedWalletIndex(idx);
                      }}
                      interface="action-sheet"
                      placeholder="—"
                      disabled={wallets.length === 0}
                      style={{
                        '--background': 'transparent',
                        '--color': 'var(--sovereign-text)',
                        border: '1px solid var(--sovereign-border)',
                        borderRadius: '10px',
                        padding: '4px 14px',
                        width: '100%',
                      } as React.CSSProperties}
                    >
                      {wallets.map((w) => (
                        <IonSelectOption key={w.network} value={w.network}>
                          {w.displayLabel}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  )}
                </div>

                {/* Deposit address (read-only + copy) */}
                <div style={{ marginBottom: '24px' }}>
                  <SectionLabel>{t('deposit_address')}</SectionLabel>
                  <div
                    style={{
                      ...inputStyleBase,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: depositAddress ? 'pointer' : 'default',
                    }}
                    onClick={handleCopyAddress}
                  >
                    <span
                      style={{
                        flex: 1,
                        color: 'var(--sovereign-text)',
                        fontSize: '13px',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}
                    >
                      {depositAddress || '—'}
                    </span>
                    {depositAddress && (
                      <IonIcon
                        icon={copied ? checkmarkOutline : copyOutline}
                        style={{
                          color: copied ? '#4caf50' : 'var(--sovereign-gold)',
                          fontSize: '20px',
                          flexShrink: 0,
                          transition: 'color 0.2s',
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Continue to step 2 */}
                <SovereignPrimaryButton
                  onClick={() => setStep(2)}
                  disabled={walletsLoading || !depositAddress}
                  expand="block"
                >
                  {t('done_recharge_done')}
                </SovereignPrimaryButton>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Important information */}
              <div style={cardStyle}>
                <IonText>
                  <p style={{ ...cardTitleStyle, fontSize: '15px' }}>{t('important_information')}</p>
                </IonText>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: '12px 0 0 0', lineHeight: '1.6' }}>
                    {t('add_funds_step2_important_info_text')}
                  </p>
                </IonText>
              </div>

              {/* Step 2: Recharge form */}
              <div style={cardStyle}>
                <IonText>
                  <p style={{ ...cardTitleStyle, fontSize: '15px', marginBottom: '16px' }}>
                    {t('add_funds_form_title')}
                  </p>
                </IonText>

                {/* Transaction ID */}
                <div style={{ marginBottom: '16px' }}>
                  <SectionLabel>{t('label_transaction_id')}</SectionLabel>
                  <IonInput
                    value={txId}
                    onIonInput={(e) => setTxId(e.detail.value ?? '')}
                    placeholder={t('label_transaction_id')}
                    style={inputStyle}
                  />
                </div>

                {/* Amount */}
                <div style={{ marginBottom: '16px' }}>
                  <SectionLabel>{t('label_amount')}</SectionLabel>
                  <IonInput
                    type="text"
                    inputmode="decimal"
                    value={amountText}
                    onIonInput={(e) => {
                      const v = (e.detail.value ?? '').replace(',', '.');
                      if (isValidDepositAmountInput(v)) setAmountText(v);
                    }}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>

                {/* Coin (read-only) */}
                <div style={{ marginBottom: '24px' }}>
                  <SectionLabel>{t('label_coin')}</SectionLabel>
                  <IonInput
                    value={t('value_coin_usdt')}
                    readonly
                    style={inputStyle}
                  />
                </div>

                {/* Submit */}
                <SovereignPrimaryButton
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  expand="block"
                >
                  {isSubmitting ? '...' : t('verify_button')}
                </SovereignPrimaryButton>
              </div>
            </>
          )}

          <div style={{ height: '40px' }} />
        </div>

        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={() => setAlertOpen(false)}
          header={t('information')}
          message={alertMessage}
          buttons={[{ text: t('ok'), handler: () => setAlertOpen(false) }]}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

/* ── Sub-components ── */

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
  color: 'var(--sovereign-text)',
  fontWeight: '700',
  margin: 0,
};

const inputStyleBase: React.CSSProperties = {
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
  padding: '12px 14px',
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
} as React.CSSProperties;

export default AddFundsPage;
