import React, { useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonText,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import { useAuthStore } from '../../store/authStore';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import '../../ui/theme/variables.css';

const LoginPage: React.FC = () => {
  const history = useHistory();
  const { isLoading, error, signInWithGoogle, loadSession, clearError } = useAuthStore();

  useEffect(() => {
    (async () => {
      await loadSession();
      const { user } = useAuthStore.getState();
      if (user) {
        history.replace('/dashboard');
      }
    })();
  }, []);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const { credential } = credentialResponse;
    if (!credential) return;
    try {
      await signInWithGoogle(credential);
      history.replace('/dashboard');
    } catch {
      // error is set in the store
    }
  };

  const handleGoogleError = () => {
    useAuthStore.setState({ error: 'Google sign-in failed. Please try again.' });
  };

  return (
    <IonPage>
      <IonContent
        fullscreen
        style={{
          '--background': 'transparent',
          '--overflow': 'hidden',
        } as React.CSSProperties}
      >
        {/* Animated background */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 30%, #0f1f3a 60%, #0a1628 80%, #050d1a 100%)',
            backgroundSize: '400% 400%',
            animation: 'gradientShift 10s ease infinite',
            zIndex: 0,
          }}
        />

        {/* Decorative gold orb */}
        <div
          style={{
            position: 'fixed',
            top: '-80px',
            right: '-80px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'fixed',
            bottom: '-60px',
            left: '-60px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 70%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Main content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '40px 32px',
            animation: 'fadeInUp 0.6s ease',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '48px',
            }}
          >
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, var(--sovereign-gold) 0%, var(--sovereign-gold-light) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: '0 8px 32px rgba(201,168,76,0.45)',
              }}
            >
              <IonIcon
                icon={shieldCheckmarkOutline}
                style={{ fontSize: '48px', color: '#0a1628' }}
              />
            </div>

            <IonText>
              <h1
                style={{
                  color: 'var(--sovereign-gold)',
                  fontSize: '36px',
                  fontWeight: '800',
                  letterSpacing: '2px',
                  margin: '0 0 6px 0',
                  textShadow: '0 2px 12px rgba(201,168,76,0.4)',
                }}
              >
                PLAY4CASH
              </h1>
            </IonText>

            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '14px',
                  letterSpacing: '3px',
                  margin: 0,
                  textTransform: 'uppercase',
                  fontWeight: '500',
                }}
              >
                Compete. Win. Earn.
              </p>
            </IonText>
          </div>

          {/* Card */}
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--sovereign-surface)',
              border: '1px solid var(--sovereign-border)',
              borderRadius: '20px',
              padding: '36px 28px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <IonText>
              <h2
                style={{
                  color: 'var(--sovereign-text)',
                  fontSize: '22px',
                  fontWeight: '700',
                  textAlign: 'center',
                  margin: '0 0 8px 0',
                }}
              >
                Welcome Back
              </h2>
            </IonText>
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '14px',
                  textAlign: 'center',
                  margin: '0 0 32px 0',
                  lineHeight: '1.5',
                }}
              >
                Sign in to access your account and start playing
              </p>
            </IonText>

            {isLoading ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 0',
                }}
              >
                <IonSpinner name="crescent" style={{ color: 'var(--sovereign-gold)', width: 40, height: 40 }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px', margin: 0 }}>
                    Signing you in...
                  </p>
                </IonText>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
                  }}
                >
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

                <IonText>
                  <p
                    style={{
                      color: 'var(--sovereign-text-muted)',
                      fontSize: '13px',
                      textAlign: 'center',
                      margin: 0,
                      lineHeight: '1.6',
                    }}
                  >
                    Secure authentication powered by Google
                  </p>
                </IonText>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: '40px',
            }}
          >
            {[
              { value: '10K+', label: 'Players' },
              { value: '4', label: 'Games' },
              { value: '24/7', label: 'Live' },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <IonText>
                  <p
                    style={{
                      color: 'var(--sovereign-gold)',
                      fontSize: '20px',
                      fontWeight: '800',
                      margin: '0 0 2px 0',
                    }}
                  >
                    {stat.value}
                  </p>
                </IonText>
                <IonText>
                  <p
                    style={{
                      color: 'var(--sovereign-text-muted)',
                      fontSize: '11px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      margin: 0,
                    }}
                  >
                    {stat.label}
                  </p>
                </IonText>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '12px',
                  margin: 0,
                  lineHeight: '1.8',
                }}
              >
                By signing in you agree to our{' '}
                <a
                  href="#terms"
                  style={{
                    color: 'var(--sovereign-gold)',
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a
                  href="#privacy"
                  style={{
                    color: 'var(--sovereign-gold)',
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  Privacy Policy
                </a>
              </p>
            </IonText>
          </div>
        </div>

        <GenericErrorModal
          isOpen={!!error}
          message={error ?? ''}
          onDismiss={clearError}
        />
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
