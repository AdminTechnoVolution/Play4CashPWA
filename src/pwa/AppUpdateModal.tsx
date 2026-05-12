import React, { useState } from 'react';
import { IonModal, IonText, IonIcon, IonToast } from '@ionic/react';
import {
  cloudDownloadOutline,
  cloudDoneOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import { useAppUpdate } from './useAppUpdate';
import { SovereignPrimaryButton } from '../ui/components/SovereignButton';
import { useT } from '../i18n/translations';

/**
 * - Centered modal: appears when a new app version is detected (background SW update or
 *   API-forced via X-App-Min-Version). Confirmation required before reloading so we don't
 *   disrupt active gameplay or open forms. Forced updates suppress the dismiss button.
 * - Offline-ready toast: fires once after the SW finishes precaching for the first time.
 *   Lets the user know the install completed and offline use is available.
 */
const AppUpdateModal: React.FC = () => {
  const t = useT();
  const {
    needRefresh,
    forced,
    requiredVersion,
    applyUpdate,
    dismiss,
    dismissOfflineReady,
    appFullVersion,
    isStandalone,
    showOfflineReady,
  } = useAppUpdate();
  const [updating, setUpdating] = useState(false);

  const handleApply = async () => {
    setUpdating(true);
    try {
      await applyUpdate();
    } catch {
      setUpdating(false);
    }
  };

  return (
    <>
      <IonModal isOpen={needRefresh} backdropDismiss={false} className="p4c-update-modal">
        <div style={modalContainerStyle}>
          <div style={iconWrapperStyle}>
            <IonIcon
              icon={forced ? warningOutline : cloudDownloadOutline}
              style={{
                fontSize: '48px',
                color: forced ? 'var(--sovereign-danger, #d96565)' : 'var(--sovereign-gold)',
              }}
            />
          </div>

          <IonText>
            <h2 style={titleStyle}>
              {t(forced ? 'update_required_title' : 'update_available_title')}
            </h2>
          </IonText>

          <IonText>
            <p style={bodyStyle}>
              {t(forced ? 'update_required_body' : 'update_available_body')}
            </p>
          </IonText>

          {isStandalone && (
            <IonText>
              <p style={hintStyle}>{t('update_standalone_hint')}</p>
            </IonText>
          )}

          <div style={buttonGroupStyle}>
            <SovereignPrimaryButton onClick={handleApply} loading={updating} expand="block">
              <IonIcon icon={refreshOutline} slot="start" />
              {updating ? t('update_loading') : t('update_now')}
            </SovereignPrimaryButton>

            {!forced && (
              <button onClick={dismiss} style={dismissButtonStyle}>
                {t('update_later')}
              </button>
            )}
          </div>

          <IonText>
            <p style={versionStyle}>
              {t('current_version')}: v{appFullVersion}
              {requiredVersion && (
                <>
                  <br />
                  {t('required_version')}: v{requiredVersion}
                </>
              )}
            </p>
          </IonText>
        </div>
      </IonModal>

      <IonToast
        isOpen={showOfflineReady}
        onDidDismiss={dismissOfflineReady}
        message={`${t('update_offline_ready_title')} — ${t('update_offline_ready_body')}`}
        icon={cloudDoneOutline}
        duration={5000}
        position="top"
        color="success"
        buttons={[{ text: t('update_offline_ready_dismiss'), role: 'cancel' }]}
      />
    </>
  );
};

const modalContainerStyle: React.CSSProperties = {
  background: 'var(--sovereign-surface, #14233a)',
  padding: '32px 24px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  height: '100%',
  justifyContent: 'center',
};

const iconWrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

const titleStyle: React.CSSProperties = {
  color: 'var(--sovereign-text, #fff)',
  fontSize: '22px',
  fontWeight: 700,
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  color: 'var(--sovereign-text, #fff)',
  fontSize: '15px',
  lineHeight: 1.5,
  margin: '0 8px',
};

const hintStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted, #8a9bbf)',
  fontSize: '12px',
  lineHeight: 1.5,
  margin: '4px 8px 0',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '8px',
};

const dismissButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--sovereign-border, #2a3a55)',
  color: 'var(--sovereign-text-muted, #8a9bbf)',
  borderRadius: '12px',
  padding: '12px 16px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const versionStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted, #8a9bbf)',
  fontSize: '11px',
  margin: '12px 0 0',
  lineHeight: 1.6,
};

export default AppUpdateModal;
