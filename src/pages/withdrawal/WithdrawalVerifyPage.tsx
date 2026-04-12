import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonInput,
  IonText,
  IonAlert,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { apiRepository } from '../../data/network/ApiRepository';
import { useDashboardStore } from '../../store/dashboardStore';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import { hasKey } from '../../i18n/translations';
import { useT } from '../../i18n/translations';
import '../../ui/theme/variables.css';

const WithdrawalVerifyPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { refreshAccount } = useDashboardStore();

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    const code = otpCode.trim();
    if (!code) return;

    setLoading(true);
    try {
      await apiRepository.verifyWithdrawal({ verification_code: code });
      setAlertMessage(t('withdrawal_verify_success'));
      setIsSuccess(true);
      setAlertOpen(true);
    } catch (err: any) {
      const key = (err.message ?? '').trim();
      const msg = key && hasKey(key)
        ? t(key)
        : t('error_try_later_message');
      setAlertMessage(msg);
      setIsSuccess(false);
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertDismiss = () => {
    setAlertOpen(false);
    if (isSuccess) {
      refreshAccount();
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/withdrawal" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>
            {t('withdrawal_verify_title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>
          <div
            style={{
              background: 'var(--sovereign-surface)',
              border: '1px solid var(--sovereign-border)',
              borderRadius: '16px',
              padding: '20px',
            }}
          >
            <IonText>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: '0 0 20px 0', lineHeight: '1.6' }}>
                {t('APP.WITHDRAWAL.OTP_HINT')}
              </p>
            </IonText>

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
                {t('withdrawal_verify_otp_label')}
              </label>
            </IonText>

            <IonInput
              type="tel"
              inputmode="numeric"
              value={otpCode}
              onIonInput={(e) => setOtpCode((e.detail.value ?? '').replace(/\D/g, ''))}
              placeholder="______"
              style={{
                '--background': 'transparent',
                '--color': 'var(--sovereign-text)',
                '--placeholder-color': 'var(--sovereign-text-muted)',
                '--padding-start': '14px',
                '--padding-end': '14px',
                '--padding-top': '14px',
                '--padding-bottom': '14px',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '10px',
                fontSize: '20px',
                fontWeight: '700',
                letterSpacing: '6px',
                textAlign: 'center',
              } as React.CSSProperties}
            />

            <div style={{ marginTop: '24px' }}>
              <SovereignPrimaryButton
                onClick={handleSubmit}
                loading={loading}
                disabled={!otpCode.trim() || loading}
                expand="block"
              >
                {t('withdrawal_verify_confirm')}
              </SovereignPrimaryButton>
            </div>
          </div>
        </div>

        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={handleAlertDismiss}
          header={t('information')}
          message={alertMessage}
          buttons={[{ text: t('ok'), handler: handleAlertDismiss }]}
        />
      </IonContent>
    </IonPage>
  );
};

export default WithdrawalVerifyPage;
