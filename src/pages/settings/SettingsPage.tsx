import React, { useEffect, useState } from 'react';
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

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

const SettingsPage: React.FC = () => {
  const [wallets, setWallets] = useState<WalletResponse[]>([]);
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
    const storedAddress = getWalletAddress() ?? account?.walletAddress ?? account?.wallet ?? '';
    setCurrentWalletAddress(storedAddress);
    setNewWalletAddress(storedAddress);

    (async () => {
      setWalletsLoading(true);
      try {
        const data = await apiRepository.getWallets();
        setWallets(data);
        if (data.length > 0) setSelectedNetwork(data[0].network);
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
        walletAddress: newWalletAddress.trim(),
        network: selectedNetwork,
      });
      saveWalletAddress(newWalletAddress.trim());
      setCurrentWalletAddress(newWalletAddress.trim());
      setToast({ isOpen: true, message: 'Wallet address saved successfully!', color: 'success' });
    } catch (err) {
      setToast({ isOpen: true, message: err instanceof Error ? err.message : 'Failed to save wallet.', color: 'danger' });
    } finally {
      setWalletSaving(false);
    }
  };

  const handleSaveLanguage = () => {
    saveLanguage(language);
    setToast({ isOpen: true, message: 'Language updated. Reloading...', color: 'success' });
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>Settings</IonTitle>
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
                  Withdrawal Wallet
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
                <SectionLabel>NETWORK</SectionLabel>
                {walletsLoading ? (
                  <IonSkeletonText animated style={{ height: '48px', borderRadius: '10px' }} />
                ) : (
                  <IonSelect
                    value={selectedNetwork}
                    onIonChange={(e) => setSelectedNetwork(e.detail.value)}
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
                <SectionLabel>WALLET ADDRESS</SectionLabel>
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
                Save Wallet Address
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
                  Language
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
                <SectionLabel>APP LANGUAGE</SectionLabel>
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
                Save Language
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
                Play4Cash v1.0.0
                <br />
                <a href="#terms" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none' }}>
                  Terms &amp; Conditions
                </a>
                {' · '}
                <a href="#privacy" style={{ color: 'var(--sovereign-gold)', textDecoration: 'none' }}>
                  Privacy Policy
                </a>
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
