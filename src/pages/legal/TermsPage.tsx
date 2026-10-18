import { Link } from 'react-router-dom';
import LegalLayout, { LegalSections } from './LegalLayout';
import { t } from '../../i18n/translations';

const SECTIONS = [
  'OPERATOR', 'DESC', 'ELIGIBILITY', 'ACCOUNT', 'GAMES', 'FEES', 'DEPOSITS', 'WITHDRAWALS', 'AML', 'CONDUCT',
  'ERRORS', 'CHAT', 'RESPONSIBLE', 'TAXES', 'SUSPENSION', 'AVAILABILITY', 'THIRD', 'IP', 'LIABILITY',
  'INDEMNITY', 'FORCE', 'CLAIMS', 'CHANGES', 'LAW', 'GENERAL', 'CONTACT',
] as const;

export default function TermsPage() {
  return (
    <LegalLayout title={t('LEGAL.TERMS.TITLE')}>
      <h1 style={H1}>{t('LEGAL.TERMS.TITLE')}</h1>
      <p style={UPDATED}>{t('LEGAL.UPDATED')}</p>

      <p>
        {t('LEGAL.TERMS.INTRO_BEFORE')}
        <Link to="/privacy" style={LINK}>{t('LEGAL.TERMS.INTRO_LINK_PRIVACY')}</Link>
        {t('LEGAL.TERMS.INTRO_MID')}
        <Link to="/data-treatment" style={LINK}>{t('LEGAL.TERMS.INTRO_LINK_DATA')}</Link>
        {t('LEGAL.TERMS.INTRO_AFTER')}
      </p>

      <LegalSections prefix="LEGAL.TERMS" keys={SECTIONS} />

      <p style={NOTE}>{t('LEGAL.TERMS.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
