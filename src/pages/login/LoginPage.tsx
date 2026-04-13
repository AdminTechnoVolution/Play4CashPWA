import React, { useEffect } from 'react';
import { IonPage, IonContent, IonText, IonSpinner } from '@ionic/react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuthStore } from '../../store/authStore';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { useT } from '../../i18n/translations';
import '../../ui/theme/variables.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, error, signInWithGoogle, loadSession, clearError } = useAuthStore();
  const t = useT();

  useEffect(() => {
    (async () => {
      await loadSession();
      const { user } = useAuthStore.getState();
      if (user) navigate('/dashboard');
    })();
  }, []);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const { credential } = credentialResponse;
    if (!credential) return;
    try {
      await signInWithGoogle(credential);
      navigate('/dashboard');
    } catch {
      // error set in store
    }
  };

  const handleGoogleError = () => {
    useAuthStore.setState({ error: 'Google sign-in failed. Please try again.' });
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': 'transparent', '--overflow': 'hidden' } as React.CSSProperties}>

        {/* Background image */}
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'url(/bg_app_play4cash.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }} />

        {/* Dark overlay */}
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(5,13,26,0.55) 0%, rgba(5,13,26,0.75) 50%, rgba(5,13,26,0.92) 100%)',
          zIndex: 1,
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '40px 32px',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '44px' }}>
            <img
              src="/logo_play4cash.png"
              alt="Play4Cash"
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                objectFit: 'cover',
                marginBottom: 16,
                boxShadow: '0 0 0 3px rgba(201,168,76,0.5), 0 8px 32px rgba(201,168,76,0.35)',
              }}
            />
            <IonText>
              <p style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: 13,
                letterSpacing: '3px',
                margin: 0,
                textTransform: 'uppercase',
                fontWeight: 500,
              }}>
                {t('login_tagline')}
              </p>
            </IonText>
          </div>

          {/* Card */}
          <div style={{
            width: '100%',
            maxWidth: 380,
            background: 'rgba(19,31,53,0.88)',
            border: '1px solid var(--sovereign-border)',
            borderRadius: 20,
            padding: '32px 28px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            <IonText>
              <h2 style={{
                color: 'var(--sovereign-text)',
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                margin: '0 0 6px 0',
              }}>
                {t('login_welcome_title')}
              </h2>
            </IonText>
            <IonText>
              <p style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: 14,
                textAlign: 'center',
                margin: '0 0 28px 0',
                lineHeight: 1.5,
              }}>
                {t('login_welcome_subtitle')}
              </p>
            </IonText>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
                <IonSpinner name="crescent" style={{ color: 'var(--sovereign-gold)', width: 40, height: 40 }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 14, margin: 0 }}>{t('loading')}</p>
                </IonText>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="filled_black"
                    size="large"
                    width="320"
                    text="signin_with"
                    shape="rectangular"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terms */}
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <IonText>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 12, margin: 0, lineHeight: 1.8 }}>
                {t('login_compliance_agree')}{' '}
                <Link to="/terms" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none', fontWeight: 600 }}>
                  {t('login_terms')}
                </Link>{' '}
                {t('login_compliance_and')}{' '}
                <Link to="/privacy" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none', fontWeight: 600 }}>
                  {t('login_privacy')}
                </Link>
              </p>
            </IonText>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 'auto',
              width: '100%',
              paddingTop: 28,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              textAlign: 'center',
            }}
          >
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: 12,
                  margin: 0,
                  opacity: 0.7,
                  letterSpacing: '0.04em',
                }}
              >
                By Techno Volution
              </p>
            </IonText>
          </div>
        </div>

        <GenericErrorModal isOpen={!!error} message={error ?? ''} onDismiss={clearError} />
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
