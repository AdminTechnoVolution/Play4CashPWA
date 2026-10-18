import { Link } from 'react-router-dom';
import LegalLayout, { LegalSections } from './LegalLayout';
import { t } from '../../i18n/translations';

const SECTIONS = [
  'CONTROLLER', 'DATA', 'PURPOSES', 'AUTHORIZATION', 'SHARING', 'TRANSFERS', 'COOKIES', 'RETENTION',
  'SECURITY', 'RIGHTS', 'MINORS', 'CHANGES',
] as const;

export default function PrivacyPage() {
  return (
    <LegalLayout title={t('LEGAL.PRIVACY.TITLE')}>
      <h1 style={H1}>{t('LEGAL.PRIVACY.TITLE')}</h1>
      <p style={UPDATED}>{t('LEGAL.UPDATED')}</p>

      <p>
        {t('LEGAL.PRIVACY.INTRO_BEFORE')}
        <Link to="/data-treatment" style={LINK}>{t('LEGAL.PRIVACY.INTRO_LINK')}</Link>
        {t('LEGAL.PRIVACY.INTRO_AFTER')}
      </p>

      <LegalSections prefix="LEGAL.PRIVACY" keys={SECTIONS} />

      <p style={NOTE}>{t('LEGAL.PRIVACY.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
