import { useState, useEffect } from 'react';
import { IonChip, IonLabel, IonText } from '@ionic/react';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';

interface Props {
  greetings: GreetingResponse[];
  onSend: (greetingId: string) => void;
  lastReceivedMessage: ChatMessage | null;
  /** When false, only the send chips are shown (incoming banner rendered elsewhere). */
  showIncomingBanner?: boolean;
}

export default function ChatGreetingChips({
  greetings,
  onSend,
  lastReceivedMessage,
  showIncomingBanner = true,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastReceivedMessage) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [lastReceivedMessage]);

  const chipStyle = {
    '--background': 'rgba(201,168,76,0.1)',
    '--color': '#c9a84c',
    border: '1px solid rgba(201,168,76,0.35)',
    fontSize: 12,
    flexShrink: 0,
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {showIncomingBanner && visible && lastReceivedMessage && (
        <div
          style={{
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.4)',
            borderRadius: 8,
            padding: '6px 12px',
            marginBottom: 8,
            animation: 'fadeIn 0.3s ease',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          {(lastReceivedMessage.from ?? '').trim() ? (
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <IonText style={{ color: '#c9a84c', fontSize: 12, fontWeight: 600 }}>
                {lastReceivedMessage.from}:
              </IonText>
              <IonText style={{ color: '#fff', fontSize: 13, marginLeft: 6 }}>
                {lastReceivedMessage.text}
              </IonText>
            </div>
          ) : (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <IonText style={{ color: '#fff', fontSize: 13 }}>{lastReceivedMessage.text}</IonText>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
          scrollbarWidth: 'thin',
          paddingBottom: 2,
        }}
      >
        {greetings.map((g) => (
          <IonChip key={g.id} onClick={() => onSend(g.id)} style={chipStyle}>
            <IonLabel>{g.text}</IonLabel>
          </IonChip>
        ))}
      </div>
    </div>
  );
}
