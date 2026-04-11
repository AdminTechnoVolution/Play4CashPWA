import React from 'react';
import { usePWAInstallStore } from '../../store/pwaInstallStore';
import { useT } from '../../i18n/translations';

const ShareIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', color: '#007AFF' }}
  >
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--sovereign-gold)' }}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 99999,
  padding: '0 16px 16px',
  pointerEvents: 'none',
};

const cardBase: React.CSSProperties = {
  pointerEvents: 'auto',
  maxWidth: 420,
  margin: '0 auto',
  background: 'linear-gradient(135deg, rgba(19,31,53,0.97) 0%, rgba(30,54,80,0.97) 100%)',
  border: '1px solid var(--sovereign-border)',
  borderRadius: 16,
  padding: '16px 20px',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
  animation: 'slideUp 0.35s ease-out',
};

const dismissBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--sovereign-text-muted)',
  fontSize: 13,
  fontWeight: 500,
  padding: '4px 8px',
  cursor: 'pointer',
  position: 'absolute',
  top: 10,
  right: 10,
};

const installBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #E9C349, #d4a930)',
  border: 'none',
  borderRadius: 8,
  color: '#152A3F',
  fontSize: 13,
  fontWeight: 700,
  padding: '8px 16px',
  cursor: 'pointer',
};

const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isIOSSafari, triggerInstall, dismiss } = usePWAInstallStore();
  const t = useT();

  if (!isInstallable) return null;

  if (isIOSSafari) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardBase, position: 'relative' }}>
          <button onClick={dismiss} style={dismissBtnStyle} aria-label="Close">
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <img
              src="/icons/icon-192.png"
              alt="Play4Cash"
              style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
            />
            <div>
              <p style={{ color: 'var(--sovereign-text)', fontSize: 15, fontWeight: 600, margin: 0 }}>
                {t('pwa_install_title')}
              </p>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 12, margin: '2px 0 0', lineHeight: 1.4 }}>
                {t('pwa_ios_subtitle')}
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(0,122,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <ShareIcon />
              </div>
              <p style={{ color: 'var(--sovereign-text)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                {t('pwa_ios_step1')}
              </p>
            </div>

            <div style={{
              width: 1, height: 10, marginLeft: 14,
              background: 'var(--sovereign-border)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(233,195,73,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <PlusIcon />
              </div>
              <p style={{ color: 'var(--sovereign-text)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                {t('pwa_ios_step2')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 14 }}>
        <img
          src="/icons/icon-192.png"
          alt="Play4Cash"
          style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--sovereign-text)', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>
            {t('pwa_install_title')}
          </p>
          <p style={{ color: 'var(--sovereign-text-muted)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
            {t('pwa_install_subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={dismiss}
            style={{
              background: 'transparent',
              border: '1px solid var(--sovereign-border)',
              borderRadius: 8,
              color: 'var(--sovereign-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {t('pwa_install_dismiss')}
          </button>
          <button onClick={triggerInstall} style={installBtnStyle}>
            {t('pwa_install_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
