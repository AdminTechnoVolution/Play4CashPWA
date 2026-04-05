import React, { useState, useRef } from 'react';
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
  IonIcon,
  IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { mailOutline, shieldCheckmarkOutline, alertCircleOutline } from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import '../../ui/theme/variables.css';

const WithdrawalVerifyPage: React.FC = () => {
  const history = useHistory();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });
  const inputRef = useRef<HTMLIonInputElement>(null);

  const handleSubmit = async () => {
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setFieldError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setFieldError('');
    try {
      await apiRepository.verifyWithdrawal({ code: otp });
      setToast({ isOpen: true, message: 'Withdrawal verified successfully!', color: 'success' });
      setTimeout(() => history.replace('/dashboard'), 1500);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    if (fieldError) setFieldError('');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>Verify Withdrawal</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 24px',
            maxWidth: '420px',
            margin: '0 auto',
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid var(--sovereign-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <IonIcon icon={mailOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '40px' }} />
          </div>

          <IonText>
            <h2
              style={{
                color: 'var(--sovereign-text)',
                fontSize: '22px',
                fontWeight: '700',
                textAlign: 'center',
                margin: '0 0 10px 0',
              }}
            >
              Check Your Email
            </h2>
          </IonText>
          <IonText>
            <p
              style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: '14px',
                textAlign: 'center',
                lineHeight: '1.6',
                margin: '0 0 40px 0',
              }}
            >
              We've sent a 6-digit verification code to your registered email address. Please enter it below to confirm your withdrawal.
            </p>
          </IonText>

          {/* OTP Card */}
          <div
            style={{
              width: '100%',
              background: 'var(--sovereign-surface)',
              border: '1px solid var(--sovereign-border)',
              borderRadius: '16px',
              padding: '28px 24px',
              marginBottom: '24px',
            }}
          >
            <IonText>
              <label
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '1px',
                  display: 'block',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                }}
              >
                VERIFICATION CODE
              </label>
            </IonText>

            <IonInput
              ref={inputRef}
              type="tel"
              inputmode="numeric"
              value={otp}
              onIonInput={(e) => handleOtpChange(e.detail.value ?? '')}
              placeholder="_ _ _ _ _ _"
              maxlength={6}
              style={{
                '--background': 'var(--sovereign-bg)',
                '--color': 'var(--sovereign-text)',
                '--placeholder-color': 'var(--sovereign-text-muted)',
                '--padding-start': '14px',
                '--padding-end': '14px',
                '--padding-top': '14px',
                '--padding-bottom': '14px',
                border: `1px solid ${fieldError ? 'var(--sovereign-error)' : 'var(--sovereign-border)'}`,
                borderRadius: '10px',
                fontSize: '24px',
                fontWeight: '700',
                letterSpacing: '8px',
                textAlign: 'center',
                transition: 'border-color 0.2s',
              } as React.CSSProperties}
            />

            {/* OTP dots indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '14px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: i < otp.length ? 'var(--sovereign-gold)' : 'var(--sovereign-border)',
                    transition: 'background 0.15s ease',
                  }}
                />
              ))}
            </div>

            {/* Field error */}
            {fieldError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '16px',
                  background: 'rgba(207,102,121,0.12)',
                  border: '1px solid rgba(207,102,121,0.4)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <IonIcon icon={alertCircleOutline} style={{ color: 'var(--sovereign-error)', fontSize: '18px', flexShrink: 0 }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-error)', fontSize: '13px', margin: 0 }}>{fieldError}</p>
                </IonText>
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ width: '100%', marginBottom: '12px' }}>
            <SovereignPrimaryButton
              onClick={handleSubmit}
              loading={loading}
              disabled={otp.length !== 6}
              expand="block"
            >
              <IonIcon icon={shieldCheckmarkOutline} style={{ marginRight: '8px', fontSize: '18px' }} />
              Verify & Confirm
            </SovereignPrimaryButton>
          </div>

          <div style={{ width: '100%' }}>
            <SovereignSecondaryButton
              onClick={() => history.replace('/dashboard')}
              expand="block"
            >
              Cancel
            </SovereignSecondaryButton>
          </div>

          {/* Resend hint */}
          <IonText>
            <p
              style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: '13px',
                textAlign: 'center',
                marginTop: '24px',
                lineHeight: '1.6',
              }}
            >
              Didn't receive the code?{' '}
              <span
                style={{
                  color: 'var(--sovereign-gold)',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                onClick={() => setToast({ isOpen: true, message: 'Please re-submit your withdrawal request to get a new code.', color: 'medium' })}
              >
                Go back
              </span>{' '}
              and try again.
            </p>
          </IonText>
        </div>

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          duration={3500}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, isOpen: false })}
        />
      </IonContent>
    </IonPage>
  );
};

export default WithdrawalVerifyPage;
