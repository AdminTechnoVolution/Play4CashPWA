import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';
import { t } from '../../i18n/translations';

export default function DataTreatmentPage() {
  return (
    <LegalLayout title={t('LEGAL.DATA.TITLE')}>
      <h1 style={H1}>{t('LEGAL.DATA.TITLE')}</h1>
      <p style={UPDATED}>{t('LEGAL.UPDATED')}</p>

      <p>
        {t('LEGAL.DATA.INTRO_BEFORE')}
        <Link to="/privacy" style={LINK}>{t('LEGAL.DATA.INTRO_LINK_PRIVACY')}</Link>
        {t('LEGAL.DATA.INTRO_MID')}
      </p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_IDENTITY')}</h2>
      <p>{t('LEGAL.DATA.P_IDENTITY')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_LEGAL_BASIS')}</h2>
      <p>{t('LEGAL.DATA.P_LEGAL_BASIS')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_CATEGORIES')}</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li style={LI}><strong style={{ color: '#c9a84c' }}>{t('LEGAL.DATA.LI_CAT_1_STRONG')}</strong> {t('LEGAL.DATA.LI_CAT_1_REST')}</li>
        <li style={LI}><strong style={{ color: '#c9a84c' }}>{t('LEGAL.DATA.LI_CAT_2_STRONG')}</strong> {t('LEGAL.DATA.LI_CAT_2_REST')}</li>
        <li style={LI}><strong style={{ color: '#c9a84c' }}>{t('LEGAL.DATA.LI_CAT_3_STRONG')}</strong> {t('LEGAL.DATA.LI_CAT_3_REST')}</li>
      </ul>

      <h2 style={H2}>{t('LEGAL.DATA.H2_PURPOSES')}</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li style={LI}>{t('LEGAL.DATA.LI_PURPOSE_1')}</li>
        <li style={LI}>{t('LEGAL.DATA.LI_PURPOSE_2')}</li>
        <li style={LI}>{t('LEGAL.DATA.LI_PURPOSE_3')}</li>
        <li style={LI}>{t('LEGAL.DATA.LI_PURPOSE_4')}</li>
      </ul>

      <h2 style={H2}>{t('LEGAL.DATA.H2_RETENTION')}</h2>
      <p>{t('LEGAL.DATA.P_RETENTION')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_RECIPIENTS')}</h2>
      <p>{t('LEGAL.DATA.P_RECIPIENTS')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_TRANSFERS')}</h2>
      <p>{t('LEGAL.DATA.P_TRANSFERS')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_RIGHTS')}</h2>
      <p>{t('LEGAL.DATA.P_RIGHTS_1')}</p>
      <p>{t('LEGAL.DATA.P_RIGHTS_2')}</p>

      <h2 style={H2}>{t('LEGAL.DATA.H2_MINORS')}</h2>
      <p>{t('LEGAL.DATA.P_MINORS')}</p>

      <p style={NOTE}>{t('LEGAL.DATA.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const H2: React.CSSProperties = { color: '#c9a84c', fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const LI: React.CSSProperties = { marginBottom: 6 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
