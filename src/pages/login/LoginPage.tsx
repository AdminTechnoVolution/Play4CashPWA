import React, { useCallback, useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuthStore } from '../../store/authStore';
import { hasValidSession } from '../../data/auth/AuthSessionStore';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { useT } from '../../i18n/translations';
import { useLanguageStore } from '../../i18n/languageStore';
import { normaliseLang } from '../../i18n/languageUtils';
import { apiRepository } from '../../data/network/ApiRepository';
import { checkServiceWorkerForUpdate } from '../../pwa/useAppUpdate';
import '../../ui/theme/variables.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, error, signInWithGoogle, clearError, user, authHydrated } = useAuthStore();
  const t = useT();
  const lang = normaliseLang(useLanguageStore((s) => s.lang));
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!authHydrated || isLoading) return;
    if (user && hasValidSession()) {
      clearError();
      navigate('/dashboard', { replace: true });
    }
  }, [user, authHydrated, isLoading, navigate, clearError]);

  const refreshPublicStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await apiRepository.getPublicUserStats();
      setRegisteredCount(Math.max(0, s.registeredUsers));
    } catch {
      setRegisteredCount(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPublicStats();
  }, [refreshPublicStats]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    try {
      await Promise.all([refreshPublicStats(), checkServiceWorkerForUpdate()]);
    } finally {
      event.detail.complete();
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const { credential } = credentialResponse;
    if (!credential) return;
    try {
      await signInWithGoogle(credential);
      navigate('/dashboard', { replace: true });
    } catch {
      // error set in store
    }
  };

  const handleGoogleError = () => {
    useAuthStore.setState({ error: 'Google sign-in failed. Please try again.' });
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY style={{ '--background': 'transparent' } as React.CSSProperties}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('login_refresher_pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('login_refresher_refreshing')}
          />
        </IonRefresher>

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
          minHeight: '100vh',
          padding: '40px 32px',
          paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom, 0px)))',
        }}>

          {/* Main — logo, card, terms */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
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
          <div style={{ marginTop: 24, textAlign: 'center' }}>
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
          </div>

          {/* Footer — community stats, version, credit */}
          <div
            style={{
              width: '100%',
              marginTop: 16,
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {(statsLoading || registeredCount !== null) && (
              <div
                style={{
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  maxWidth: 320,
                  width: '100%',
                  borderRadius: 16,
                  padding: '18px 20px',
                  background: 'linear-gradient(145deg, rgba(201,168,76,0.12) 0%, rgba(19,31,53,0.85) 45%, rgba(19,31,53,0.92) 100%)',
                  border: '1px solid rgba(201,168,76,0.35)',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(10px)',
                }}
                aria-live="polite"
                aria-busy={statsLoading}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                    color: 'var(--sovereign-gold)',
                    fontWeight: 600,
                    marginBottom: 8,
                    opacity: 0.95,
                  }}
                >
                  {t('login_footer_players_title')}
                </div>
                {statsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <IonSpinner name="crescent" style={{ color: 'var(--sovereign-gold)', width: 28, height: 28 }} />
                  </div>
                ) : registeredCount != null ? (
                  <>
                    <div
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 34,
                        fontWeight: 800,
                        lineHeight: 1.1,
                        textAlign: 'center',
                        background: 'linear-gradient(180deg, #f0dfa0 0%, #c9a84c 45%, #9a7a32 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        textShadow: '0 2px 16px rgba(201,168,76,0.25)',
                      }}
                    >
                      {registeredCount.toLocaleString(lang)}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        textAlign: 'center',
                        fontSize: 13,
                        color: 'var(--sovereign-text-muted)',
                        lineHeight: 1.35,
                        fontWeight: 500,
                      }}
                    >
                      {t('login_footer_players_subtitle')}
                    </div>
                  </>
                ) : null}
              </div>
            )}
            <div
              style={{
                marginTop: 8,
                color: 'var(--sovereign-text-muted)',
                fontSize: 11,
                letterSpacing: '0.5px',
                userSelect: 'text',
                opacity: 0.8,
              }}
              aria-label={`App version v${__APP_FULL_VERSION__}`}
            >
              v{__APP_FULL_VERSION__}
            </div>
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: 12,
                  margin: '10px 0 0',
                  opacity: 0.7,
                  letterSpacing: '0.04em',
                }}
              >
                {t('login_by_techno_volution')}
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
