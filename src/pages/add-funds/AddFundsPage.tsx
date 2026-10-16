import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
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
import { AppBackButton } from '../../navigation/AppBackButton';
import '../../ui/theme/variables.css';
import type { RechargeIntentResponse, WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';

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

  // Step 2: amount → reservation
  const [amount, setAmount] = useState('');
  const [isReserving, setIsReserving] = useState(false);
  const [intent, setIntent] = useState<RechargeIntentResponse | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // Step 3 form
  const [txId, setTxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alert state (matches Android AlertDialog)
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const rechargeIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!alertOpen && isSuccess) {
      setIsSuccess(false);
      rechargeIdempotencyKeyRef.current = null;
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

  // Step 3 countdown until the reservation expires.
  useEffect(() => {
    if (!intent) return;
    const expiresAtMs = new Date(intent.expiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, expiresAtMs - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [intent]);

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

  const handleReserve = () => {
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setAlertMessage(t('recharge_error_amount_invalid'));
      setAlertOpen(true);
      return;
    }
    if (!selectedWallet) return;

    setIsReserving(true);
    (async () => {
      try {
        const result = await apiRepository.createRechargeIntent({
          coin: selectedWallet.coin || 'usdt',
          network: selectedWallet.network,
          amount: parsed,
        });
        setIntent(result);
        setStep(3);
      } catch (err: any) {
        setAlertMessage(formatApiMessageForDisplay(err.message, 'error_try_later_message'));
        setAlertOpen(true);
      } finally {
        setIsReserving(false);
      }
    })();
  };

  const handleSubmit = () => {
    const txIdTrimmed = txId.trim();

    if (!txIdTrimmed) {
      setAlertMessage(t('recharge_error_tx_required'));
      setAlertOpen(true);
      return;
    }

    setIsSubmitting(true);
    (async () => {
      try {
        const idempotencyKey = rechargeIdempotencyKeyRef.current ?? createIdempotencyKey();
        rechargeIdempotencyKeyRef.current = idempotencyKey;
        await apiRepository.recharge({
          txId: txIdTrimmed,
          coin: 'usdt',
          idempotencyKey,
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

  const isExpired = step === 3 && !!intent && remainingMs <= 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <AppBackButton to="/dashboard" />
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

                {/* Continue to step 2 */}
                <SovereignPrimaryButton
                  onClick={() => setStep(2)}
                  disabled={walletsLoading || !selectedWallet}
                  expand="block"
                >
                  {t('done_recharge_done')}
                </SovereignPrimaryButton>
              </div>
            </>
          ) : step === 2 ? (
            <>
              {/* Step 2: how much to deposit */}
              <div style={cardStyle}>
                <IonText>
                  <p style={{ ...cardTitleStyle, fontSize: '15px', marginBottom: '16px' }}>
                    {t('recharge_intent_amount_title')}
                  </p>
                </IonText>

                <div style={{ marginBottom: selectedWallet?.minAmount ? '8px' : '24px' }}>
                  <SectionLabel>{t('label_amount')}</SectionLabel>
                  <IonInput
                    value={amount}
                    type="number"
                    inputmode="decimal"
                    onIonInput={(e) => setAmount(e.detail.value ?? '')}
                    placeholder={t('label_amount')}
                    style={inputStyle}
                  />
                </div>
                {!!selectedWallet?.minAmount && (
                  <IonText>
                    <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: '0 0 24px 0' }}>
                      {t('recharge_intent_minimum_hint').replace('%s', `${selectedWallet.minAmount} ${selectedWallet.coin || 'USDT'}`)}
                    </p>
                  </IonText>
                )}

                <SovereignPrimaryButton
                  onClick={handleReserve}
                  loading={isReserving}
                  disabled={isReserving}
                  expand="block"
                >
                  {isReserving ? '...' : t('recharge_intent_reserve_button')}
                </SovereignPrimaryButton>
              </div>
            </>
          ) : (
            <>
              {/* Step 3: exact amount + address + countdown */}
              <div style={cardStyle}>
                <IonText>
                  <p style={{ ...cardTitleStyle, fontSize: '15px' }}>
                    {isExpired ? t('recharge_intent_expired_title') : t('recharge_intent_exact_amount_title')}
                  </p>
                </IonText>

                {isExpired ? (
                  <>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: '12px 0 20px 0', lineHeight: '1.6' }}>
                        {t('recharge_intent_expired_text')}
                      </p>
                    </IonText>
                    <SovereignPrimaryButton
                      onClick={() => {
                        setIntent(null);
                        setTxId('');
                        setStep(2);
                      }}
                      expand="block"
                    >
                      {t('recharge_intent_reserve_again_button')}
                    </SovereignPrimaryButton>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        ...inputStyleBase,
                        margin: '12px 0',
                        textAlign: 'center',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: 'var(--sovereign-gold)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {intent?.exactAmount} {intent?.coin}
                    </div>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: '0 0 16px 0', lineHeight: '1.6' }}>
                        {t('recharge_intent_exact_amount_warning')}
                      </p>
                    </IonText>

                    {/* Deposit address (read-only + copy) */}
                    <div style={{ marginBottom: '12px' }}>
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
                          {intent?.address || depositAddress || '—'}
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

                    <IonText>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: '0 0 4px 0' }}>
                        {t('recharge_intent_expires_label')}: {formatRemaining(remainingMs)}
                      </p>
                    </IonText>
                    <button
                      type="button"
                      onClick={() => {
                        setIntent(null);
                        setTxId('');
                        setStep(2);
                      }}
                      style={linkButtonStyle}
                    >
                      {t('recharge_intent_change_amount_link')}
                    </button>
                  </>
                )}
              </div>

              {/* Step 3: transaction id + submit */}
              {!isExpired && (
                <div style={cardStyle}>
                  <IonText>
                    <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: '0 0 16px 0', lineHeight: '1.6' }}>
                      {t('add_funds_step2_important_info_text')}
                    </p>
                  </IonText>

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
                      onIonInput={(e) => {
                        rechargeIdempotencyKeyRef.current = null;
                        setTxId(e.detail.value ?? '');
                      }}
                      placeholder={t('label_transaction_id')}
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
              )}
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

/* ── Helpers ── */

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  marginTop: '4px',
  color: 'var(--sovereign-gold)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
};

export default AddFundsPage;

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
