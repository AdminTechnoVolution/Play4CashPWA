import React from 'react';
import { usePWAInstallStore } from '../../store/pwaInstallStore';
import { useT } from '../../i18n/translations';

const PWAInstallBanner: React.FC = () => {
  const { isInstallable, triggerInstall, dismiss } = usePWAInstallStore();
  const t = useT();

  if (!isInstallable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      padding: '0 16px 16px',
      pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto',
        maxWidth: 420,
        margin: '0 auto',
        background: 'linear-gradient(135deg, rgba(19,31,53,0.97) 0%, rgba(30,54,80,0.97) 100%)',
        border: '1px solid var(--sovereign-border)',
        borderRadius: 16,
        padding: '16px 20px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        animation: 'slideUp 0.35s ease-out',
      }}>
        <img
          src="/icons/icon-192.png"
          alt="Play4Cash"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: 'var(--sovereign-text)',
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 2px',
          }}>
            {t('pwa_install_title')}
          </p>
          <p style={{
            color: 'var(--sovereign-text-muted)',
            fontSize: 12,
            margin: 0,
            lineHeight: 1.4,
          }}>
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
          <button
            onClick={triggerInstall}
            style={{
              background: 'linear-gradient(135deg, #E9C349, #d4a930)',
              border: 'none',
              borderRadius: 8,
              color: '#152A3F',
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            {t('pwa_install_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
