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
  IonAlert,
} from '@ionic/react';
import {
  chevronDownOutline,
  chevronUpOutline,
  walletOutline,
  globeOutline,
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
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const SettingsPage: React.FC = () => {
  const t = useT();
  const { setLang } = useLanguageStore();

  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [language, setLanguage] = useState(getLanguage());

  const [walletExpanded, setWalletExpanded] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletSaving, setWalletSaving] = useState(false);
  const [error, setError] = useState('');

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const selectedWallet = wallets[selectedWalletIndex] ?? null;

  useEffect(() => {
    const account = getUserAccount();
    const storedAddress = getWalletAddress() ?? account?.walletAddress ?? '';
    setWalletAddress(storedAddress);

    (async () => {
      setWalletsLoading(true);
      try {
        const data = await apiRepository.getWallets();
        setWallets(data);

        const userNetwork = account?.walletAddress;
        if (userNetwork && data.length > 0) {
          const idx = data.findIndex(
            (w) =>
              w.network.toLowerCase() === userNetwork.toLowerCase() ||
              w.network.toLowerCase().includes(userNetwork.toLowerCase()) ||
              userNetwork.toLowerCase().includes(w.network.toLowerCase()),
          );
          if (idx >= 0) setSelectedWalletIndex(idx);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error_try_later_message'));
      } finally {
        setWalletsLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveWallet = async () => {
    if (!walletAddress.trim()) return;
    setWalletSaving(true);
    try {
      const network = selectedWallet?.network ?? 'TRX Tron(TRC20)';
      await apiRepository.registerWallet({
        wallet: walletAddress.trim(),
        coin: 'USDT',
        network,
      });
      saveWalletAddress(walletAddress.trim());
      setAlertMessage(t('wallet_saved_success'));
      setAlertOpen(true);
    } catch (err) {
      const msg = formatApiMessageForDisplay(
        err instanceof Error ? err.message : null,
        'error_try_later_message',
      );
      setAlertMessage(msg);
      setAlertOpen(true);
    } finally {
      setWalletSaving(false);
    }
  };

  const handleSaveLanguage = () => {
    saveLanguage(language);
    setLang(language);
    setAlertMessage(t('language_updated'));
    setAlertOpen(true);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>
            {t('settings_title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <div
          style={{
            padding: '24px 20px',
            maxWidth: '480px',
            margin: '0 auto',
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          {/* ── Wallet Section ── */}
          <CollapsibleCard
            icon={walletOutline}
            title={t('configure_your_wallet')}
            expanded={walletExpanded}
            onToggle={() => setWalletExpanded((v) => !v)}
          >
            {/* Coin (read-only) */}
            <FieldGroup label={t('label_coin')}>
              <IonInput
                value={t('value_coin_usdt')}
                readonly
                style={inputStyle as React.CSSProperties}
              />
            </FieldGroup>

            {/* Network */}
            <FieldGroup label={t('label_network')}>
              {walletsLoading ? (
                <IonSkeletonText animated style={{ height: '48px', borderRadius: '10px' }} />
              ) : (
                <IonSelect
                  value={selectedWalletIndex}
                  onIonChange={(e) => setSelectedWalletIndex(e.detail.value)}
                  interface="action-sheet"
                  placeholder="—"
                  disabled={wallets.length === 0}
                  style={selectStyle as React.CSSProperties}
                >
                  {wallets.map((w, i) => (
                    <IonSelectOption key={w.id || i} value={i}>
                      {w.coin} — {w.network}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              )}
            </FieldGroup>

            {/* Wallet address */}
            <FieldGroup label={t('label_wallet')}>
              <IonInput
                value={walletAddress}
                onIonInput={(e) => setWalletAddress(e.detail.value ?? '')}
                placeholder="TRC20, ERC20..."
                style={inputStyle as React.CSSProperties}
              />
            </FieldGroup>

            {/* Min withdrawal hint */}
            {selectedWallet && selectedWallet.minAmount > 0 && (
              <IonText>
                <p style={hintStyle}>
                  {t('label_min_withdrawal')}: {formatCurrency(selectedWallet.minAmount)}
                </p>
              </IonText>
            )}

            {/* Network withdrawal fee hint */}
            {selectedWallet && selectedWallet.fee > 0 && (
              <IonText>
                <p style={hintStyle}>
                  {t('withdrawal_fee_charged_note').replace('%s', formatCurrency(selectedWallet.fee))}
                </p>
              </IonText>
            )}

            {/* Warning */}
            <div style={warningBoxStyle}>
              <IonIcon
                icon={informationCircleOutline}
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '16px',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              />
              <IonText>
                <p
                  style={{
                    color: 'var(--sovereign-text-muted)',
                    fontSize: '12px',
                    margin: 0,
                    lineHeight: '1.5',
                  }}
                >
                  {t('wallet_network_warning')}
                </p>
              </IonText>
            </div>

            <SovereignPrimaryButton onClick={handleSaveWallet} loading={walletSaving} expand="block">
              {t('save_wallet')}
            </SovereignPrimaryButton>
          </CollapsibleCard>

          {/* ── Language Section ── */}
          <CollapsibleCard
            icon={globeOutline}
            title={t('label_language')}
            expanded={languageExpanded}
            onToggle={() => setLanguageExpanded((v) => !v)}
          >
            <FieldGroup label={t('label_language')}>
              <IonSelect
                value={language}
                onIonChange={(e) => setLanguage(e.detail.value)}
                interface="action-sheet"
                style={selectStyle as React.CSSProperties}
              >
                {LANGUAGES.map((l) => (
                  <IonSelectOption key={l.code} value={l.code}>
                    {l.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </FieldGroup>

            <SovereignPrimaryButton onClick={handleSaveLanguage} expand="block">
              {t('save_language')}
            </SovereignPrimaryButton>
          </CollapsibleCard>

          {/* ── App Info Footer ── */}
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: '12px',
                  margin: 0,
                  lineHeight: '1.8',
                }}
              >
                {t('label_version')}
                <br />
                <Link to="/terms" style={linkStyle}>
                  Terms &amp; Conditions
                </Link>
                {' · '}
                <Link to="/privacy" style={linkStyle}>
                  Privacy Policy
                </Link>
                {' · '}
                <Link to="/data-treatment" style={linkStyle}>
                  Data Processing
                </Link>
              </p>
            </IonText>
          </div>

          <div style={{ height: '40px' }} />
        </div>

        {/* AlertDialog — mirrors Android pattern */}
        <IonAlert
          isOpen={alertOpen}
          onDidDismiss={() => setAlertOpen(false)}
          header={t('information')}
          message={alertMessage}
          buttons={[t('ok')]}
          cssClass="sovereign-alert"
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error} onDismiss={() => setError('')} />
    </IonPage>
  );
};

/* ── Collapsible Card ── */

interface CollapsibleCardProps {
  icon: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  icon,
  title,
  expanded,
  onToggle,
  children,
}) => (
  <div style={{ marginBottom: '20px' }}>
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        background: 'var(--sovereign-surface)',
        border: '1px solid var(--sovereign-border)',
        borderRadius: expanded ? '16px 16px 0 0' : '16px',
        padding: '16px 20px',
        transition: 'border-radius 0.2s ease',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'rgba(201,168,76,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IonIcon icon={icon} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
      </div>
      <IonText style={{ flex: 1 }}>
        <h3
          style={{
            color: 'var(--sovereign-text)',
            fontWeight: '700',
            fontSize: '16px',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </IonText>
      <IonIcon
        icon={expanded ? chevronUpOutline : chevronDownOutline}
        style={{ color: 'var(--sovereign-text)', fontSize: '20px', flexShrink: 0 }}
      />
    </div>

    <div
      style={{
        maxHeight: expanded ? '800px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.35s ease',
      }}
    >
      <div
        style={{
          background: 'var(--sovereign-surface)',
          border: '1px solid var(--sovereign-border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '20px',
        }}
      >
        {children}
      </div>
    </div>
  </div>
);

/* ── Field Group ── */

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ marginBottom: '16px' }}>
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
        {label}
      </label>
    </IonText>
    {children}
  </div>
);

/* ── Styles ── */

const inputStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  '--placeholder-color': 'var(--sovereign-text-muted)',
  '--padding-start': '14px',
  '--padding-end': '14px',
  '--padding-top': '12px',
  '--padding-bottom': '12px',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
};

const selectStyle = {
  '--background': 'transparent',
  '--color': 'var(--sovereign-text)',
  border: '1px solid var(--sovereign-border)',
  borderRadius: '10px',
  padding: '12px 14px',
  width: '100%',
};

const hintStyle: React.CSSProperties = {
  color: 'var(--sovereign-text-muted)',
  fontSize: '12px',
  margin: '0 0 12px 0',
  lineHeight: '1.5',
};

const warningBoxStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-start',
  background: 'rgba(138,155,191,0.08)',
  borderRadius: '8px',
  padding: '10px 12px',
  marginBottom: '20px',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--sovereign-gold)',
  textDecoration: 'none',
};

export default SettingsPage;
