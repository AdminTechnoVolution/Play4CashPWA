import { useNavigate } from 'react-router-dom';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import '../../ui/theme/variables.css';
import { t } from '../../i18n/translations';
import { OPERATOR } from './operator';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, children }: Props) {
  const navigate = useNavigate();

  return (
    <IonPage style={{ '--background': '#0a1628' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' } as React.CSSProperties}>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate(-1)}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#c9a84c', fontSize: 16, fontWeight: 700 }}>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' } as React.CSSProperties}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '24px 20px 48px',
          color: '#fff',
          lineHeight: 1.75,
          fontSize: 15,
        }}>
          {children}
        </div>
      </IonContent>
    </IonPage>
  );
}

/** Numbered sections whose copy lives at `<prefix>.H2_<key>` and `<prefix>.P_<key>`. */
export function LegalSections({ prefix, keys }: { prefix: string; keys: readonly string[] }) {
  return (
    <>
      {keys.map((key) => (
        <section key={key}>
          <h2 style={H2}>{t(`${prefix}.H2_${key}`)}</h2>
          <LegalText text={t(`${prefix}.P_${key}`)} />
        </section>
      ))}
    </>
  );
}

/** One line per paragraph, consecutive "- " lines form a list, **bold** spans and {operator} placeholders. */
function LegalText({ text }: { text: string }) {
  const blocks: string[][] = [];
  for (const line of text.split('\n')) {
    const last = blocks[blocks.length - 1];
    if (line.startsWith('- ') && last?.[0].startsWith('- ')) last.push(line);
    else blocks.push([line]);
  }
  return (
    <>
      {blocks.map((lines, i) => lines[0].startsWith('- ')
        ? <ul key={i} style={{ paddingLeft: 20 }}>{lines.map((line, j) => <li key={j} style={LI}>{rich(line.slice(2))}</li>)}</ul>
        : <p key={i}>{rich(lines[0])}</p>)}
    </>
  );
}

function rich(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\{\w+\})/).filter(Boolean).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} style={{ color: '#c9a84c' }}>{rich(part.slice(2, -2))}</strong>;
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name === 'email') return <a key={i} href={`mailto:${OPERATOR.email}`} style={{ color: '#c9a84c' }}>{OPERATOR.email}</a>;
    return name && name in OPERATOR ? OPERATOR[name] : part;
  });
}

const H2: React.CSSProperties = { color: '#c9a84c', fontSize: 17, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const LI: React.CSSProperties = { marginBottom: 6 };
