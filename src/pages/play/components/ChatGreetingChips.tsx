import { useState, useEffect } from 'react';
import { IonChip, IonLabel, IonText } from '@ionic/react';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';

interface Props {
  greetings: GreetingResponse[];
  onSend: (greetingId: string) => void;
  lastReceivedMessage: ChatMessage | null;
}

export default function ChatGreetingChips({ greetings, onSend, lastReceivedMessage }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastReceivedMessage) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [lastReceivedMessage]);

  return (
    <div style={{ padding: '8px 12px' }}>
      {visible && lastReceivedMessage && (
        <div style={{
          background: 'rgba(201,168,76,0.15)',
          border: '1px solid rgba(201,168,76,0.4)',
          borderRadius: 8,
          padding: '6px 12px',
          marginBottom: 8,
          animation: 'fadeIn 0.3s ease',
        }}>
          <IonText style={{ color: '#c9a84c', fontSize: 12, fontWeight: 600 }}>
            {lastReceivedMessage.from}:
          </IonText>
          <IonText style={{ color: '#fff', fontSize: 13, marginLeft: 6 }}>
            {lastReceivedMessage.text}
          </IonText>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {greetings.map((g) => (
          <IonChip
            key={g.id}
            onClick={() => onSend(g.id)}
            style={{
              '--background': 'rgba(201,168,76,0.1)',
              '--color': '#c9a84c',
              border: '1px solid rgba(201,168,76,0.35)',
              fontSize: 12,
            }}
          >
            <IonLabel>{g.text}</IonLabel>
          </IonChip>
        ))}
      </div>
    </div>
  );
}
