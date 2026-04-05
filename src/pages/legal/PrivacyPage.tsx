import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';
import { t } from '../../i18n/translations';

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

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_CONTROLLER')}</h2>
      <p>{t('LEGAL.PRIVACY.P_CONTROLLER')}</p>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_DATA')}</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_DATA_1')}</li>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_DATA_2')}</li>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_DATA_3')}</li>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_DATA_4')}</li>
      </ul>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_PURPOSES')}</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_PURPOSE_1')}</li>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_PURPOSE_2')}</li>
        <li style={LI}>{t('LEGAL.PRIVACY.LI_PURPOSE_3')}</li>
      </ul>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_RETENTION')}</h2>
      <p>{t('LEGAL.PRIVACY.P_RETENTION')}</p>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_SHARING')}</h2>
      <p>{t('LEGAL.PRIVACY.P_SHARING')}</p>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_SECURITY')}</h2>
      <p>{t('LEGAL.PRIVACY.P_SECURITY')}</p>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_RIGHTS')}</h2>
      <p>
        {t('LEGAL.PRIVACY.P_RIGHTS_BEFORE')}
        <Link to="/data-treatment" style={LINK}>{t('LEGAL.PRIVACY.P_RIGHTS_LINK')}</Link>
        {t('LEGAL.PRIVACY.P_RIGHTS_AFTER')}
      </p>

      <h2 style={H2}>{t('LEGAL.PRIVACY.H2_CHANGES')}</h2>
      <p>{t('LEGAL.PRIVACY.P_CHANGES')}</p>

      <p style={NOTE}>{t('LEGAL.PRIVACY.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const H2: React.CSSProperties = { color: '#c9a84c', fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const LI: React.CSSProperties = { marginBottom: 6 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
