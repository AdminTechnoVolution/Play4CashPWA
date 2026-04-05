import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';
import { t } from '../../i18n/translations';

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

      <h2 style={H2}>{t('LEGAL.TERMS.H2_DESC')}</h2>
      <p>{t('LEGAL.TERMS.P_DESC')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_ELIGIBILITY')}</h2>
      <p>{t('LEGAL.TERMS.P_ELIGIBILITY')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_ACCOUNT')}</h2>
      <p>{t('LEGAL.TERMS.P_ACCOUNT')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_ACCEPTABLE')}</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li style={LI}>{t('LEGAL.TERMS.LI_ACC_1')}</li>
        <li style={LI}>{t('LEGAL.TERMS.LI_ACC_2')}</li>
        <li style={LI}>{t('LEGAL.TERMS.LI_ACC_3')}</li>
      </ul>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_BALANCE')}</h2>
      <p>{t('LEGAL.TERMS.P_BALANCE')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_IP')}</h2>
      <p>{t('LEGAL.TERMS.P_IP')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_LIABILITY')}</h2>
      <p>{t('LEGAL.TERMS.P_LIABILITY')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_LAW')}</h2>
      <p>{t('LEGAL.TERMS.P_LAW')}</p>

      <h2 style={H2}>{t('LEGAL.TERMS.H2_CONTACT')}</h2>
      <p>{t('LEGAL.TERMS.P_CONTACT')}</p>

      <p style={NOTE}>{t('LEGAL.TERMS.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const H2: React.CSSProperties = { color: '#c9a84c', fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const LI: React.CSSProperties = { marginBottom: 6 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
