import { Link } from 'react-router-dom';
import LegalLayout, { LegalSections } from './LegalLayout';
import { t } from '../../i18n/translations';

/** Covers the contents Decreto 1377 de 2013, art. 13 requires of a Colombian data treatment policy. */
const SECTIONS = [
  'IDENTITY', 'SCOPE', 'PRINCIPLES', 'LEGAL_BASIS', 'CATEGORIES', 'PURPOSES', 'RECIPIENTS', 'TRANSFERS',
  'RIGHTS', 'AREA', 'PROCEDURE', 'SECURITY', 'RETENTION',
] as const;

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

      <LegalSections prefix="LEGAL.DATA" keys={SECTIONS} />

      <p style={NOTE}>{t('LEGAL.DATA.NOTE')}</p>
    </LegalLayout>
  );
}

const H1: React.CSSProperties = { color: '#c9a84c', fontSize: 24, fontWeight: 800, marginBottom: 4 };
const UPDATED: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginBottom: 20 };
const NOTE: React.CSSProperties = { color: '#8a9bbf', fontSize: 13, marginTop: 32, borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 16 };
const LINK: React.CSSProperties = { color: '#c9a84c', textDecoration: 'none', fontWeight: 600 };
