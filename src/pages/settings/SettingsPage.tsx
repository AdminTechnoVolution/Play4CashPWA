import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  IonSkeletonText,
  IonToast,
} from '@ionic/react';
import {
  walletOutline,
  globeOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { apiRepository } from '../../data/network/ApiRepository';
import {
  getWalletAddress,
  saveWalletAddress,
  getLanguage,
  saveLanguage,
  getUserAccount,
} from '../../data/auth/AuthSessionStore';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import '../../ui/theme/variables.css';
import type { WalletResponse } from '../../data/models/ApiModels';
import { useT } from '../../i18n/translations';
import { useLanguageStore } from '../../i18n/languageStore';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

const SettingsPage: React.FC = () => {
  const t = useT();
  const { lang, setLang } = useLanguageStore();
  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletResponse | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [currentWalletAddress, setCurrentWalletAddress] = useState('');
  const [language, setLanguage] = useState(getLanguage());
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletSaving, setWalletSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });

  useEffect(() => {
    // Load current wallet address
    const account = getUserAccount();
    const storedAddress = getWalletAddress() ?? account?.walletAddress ?? '';
    setCurrentWalletAddress(storedAddress);
    setNewWalletAddress(storedAddress);

    (async () => {
      setWalletsLoading(true);
      try {
        const data = await apiRepository.getWallets();
        setWallets(data);
        if (data.length > 0) {
          setSelectedWallet(data[0]);
          setSelectedNetwork(data[0].network);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wallets.');
      } finally {
        setWalletsLoading(false);
      }
    })();
  }, []);

  const handleSaveWallet = async () => {
    if (!newWalletAddress.trim()) {
      setToast({ isOpen: true, message: 'Please enter a wallet address.', color: 'warning' });
      return;
    }
    if (!selectedNetwork) {
      setToast({ isOpen: true, message: 'Please select a network.', color: 'warning' });
      return;
    }
    setWalletSaving(true);
    try {
      await apiRepository.registerWallet({
        wallet: newWalletAddress.trim(),
        coin: selectedWallet?.coin ?? 'USDT',
        network: selectedNetwork,
      });
      saveWalletAddress(newWalletAddress.trim());
      setCurrentWalletAddress(newWalletAddress.trim());
      setToast({ isOpen: true, message: t('recharge_success'), color: 'success' });
    } catch (err) {
      setToast({ isOpen: true, message: err instanceof Error ? err.message : 'Failed to save wallet.', color: 'danger' });
    } finally {
      setWalletSaving(false);
    }
  };

  const handleSaveLanguage = () => {
    saveLanguage(language);
    setLang(language);
    setToast({ isOpen: true, message: 'Language updated.', color: 'success' });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{t('settings_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
        <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>

          {/* Wallet Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(201,168,76,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IonIcon icon={walletOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
              </div>
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '17px', margin: 0 }}>
                  {t('label_wallet')}
                </h3>
              </IonText>
            </div>

            <div
              style={{
                background: 'var(--sovereign-surface)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              {/* Current address display */}
              {currentWalletAddress && (
                <div
                  style={{
                    background: 'rgba(201,168,76,0.06)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <IonIcon icon={checkmarkCircleOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '18px', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: '0 0 3px 0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Current address
                      </p>
                    </IonText>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text)', fontSize: '13px', margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {currentWalletAddress}
                      </p>
                    </IonText>
                  </div>
                </div>
              )}

              {/* Network */}
              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>{t('label_network')}</SectionLabel>
                {walletsLoading ? (
                  <IonSkeletonText animated style={{ height: '48px', borderRadius: '10px' }} />
                ) : (
                  <IonSelect
                    value={selectedNetwork}
                    onIonChange={(e) => {
                      const network = e.detail.value;
                      setSelectedNetwork(network);
                      const w = wallets.find((w) => w.network === network);
                      if (w) setSelectedWallet(w);
                    }}
                    interface="action-sheet"
                    placeholder="Select network"
                    style={{
                      '--background': 'var(--sovereign-bg)',
                      '--color': 'var(--sovereign-text)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      width: '100%',
                    } as React.CSSProperties}
                  >
                    {wallets.map((w) => (
                      <IonSelectOption key={w.network} value={w.network}>
                        {w.coin} — {w.network}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                )}
              </div>

              {/* New wallet address */}
              <div style={{ marginBottom: '20px' }}>
                <SectionLabel>{t('label_wallet')}</SectionLabel>
                <IonInput
                  value={newWalletAddress}
                  onIonInput={(e) => setNewWalletAddress(e.detail.value ?? '')}
                  placeholder="Enter your withdrawal address"
                  style={inputStyle as React.CSSProperties}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  background: 'rgba(138,155,191,0.08)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '20px',
                }}
              >
                <IonIcon icon={informationCircleOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '16px', flexShrink: 0, marginTop: '1px' }} />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                    Make sure the address matches the selected network. Sending to the wrong network may result in permanent loss of funds.
                  </p>
                </IonText>
              </div>

              <SovereignPrimaryButton onClick={handleSaveWallet} loading={walletSaving} expand="block">
                {t('save_wallet')}
              </SovereignPrimaryButton>
            </div>
          </div>

          {/* Language Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(201,168,76,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IonIcon icon={globeOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
              </div>
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '17px', margin: 0 }}>
                  {t('label_language')}
                </h3>
              </IonText>
            </div>

            <div
              style={{
                background: 'var(--sovereign-surface)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <SectionLabel>{t('label_language')}</SectionLabel>
                <IonSelect
                  value={language}
                  onIonChange={(e) => setLanguage(e.detail.value)}
                  interface="action-sheet"
                  style={{
                    '--background': 'var(--sovereign-bg)',
                    '--color': 'var(--sovereign-text)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    width: '100%',
                  } as React.CSSProperties}
                >
                  {LANGUAGES.map((lang) => (
                    <IonSelectOption key={lang.code} value={lang.code}>
                      {lang.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>

              <SovereignPrimaryButton onClick={handleSaveLanguage} expand="block">
                {t('save_wallet')}
              </SovereignPrimaryButton>
            </div>
          </div>

          {/* App info */}
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
            }}
          >
            <IonText>
              <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: 0, lineHeight: '1.8' }}>
                {t('label_version')}
                <br />
                <Link to="/terms" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none' }}>
                  Terms &amp; Conditions
                </Link>
                {' · '}
                <Link to="/privacy" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none' }}>
                  Privacy Policy
                </Link>
                {' · '}
                <Link to="/data-treatment" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none' }}>
                  Data Processing
                </Link>
              </p>
            </IonText>
          </div>

          <div style={{ height: '40px' }} />
        </div>

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          duration={3000}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, isOpen: false })}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
      {children}
    </label>
  </IonText>
);

const inputStyle = {
  '--background': 'var(--sovereign-bg)',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-end': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
};

export default SettingsPage;
