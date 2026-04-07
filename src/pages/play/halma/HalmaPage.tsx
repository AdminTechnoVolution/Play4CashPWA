import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText,
} from '@ionic/react';
import { arrowBackOutline, checkmarkDoneOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useHalmaStore } from '../../../store/halmaStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import { useT } from '../../../i18n/translations';
import { applyWsMessagePlaceholders } from '../../../i18n/ApiMessageDisplay';

const isDark = (r: number, c: number) => (r + c) % 2 !== 0;

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function HalmaPage({ roomId, betAmount, roomName, opponentName, isSpectator, onLeaveRequest }: Props) {
  const { user } = useAuthStore();
  const store = useHalmaStore();
  const t = useT();
  const chatRef = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    store.initGame(roomId, user?.username ?? '');
    const chat = chatRef.current;
    chat.connect(roomId);
    chat.onMessage(setLastMsg);
    apiRepository.getGreetings().then(setGreetings).catch(() => {});
    return () => { store.cleanup(); chat.disconnect(); };
  }, [roomId]);

  const isMyTurn = store.currentPlayer === store.myUsername;
  const cellSize = Math.min(Math.floor((window.innerWidth - 32) / 8), 48);

  const getCellBg = (row: number, col: number) => {
    const dark = isDark(row, col);
    return dark ? '#1a2940' : '#0d1520';
  };

  const isTrail = (row: number, col: number) =>
    store.jumpTrail.some((c) => c.row === row && c.col === col);

  const isValidMove = (row: number, col: number) =>
    store.validMoves.some((m) => m.row === row && m.col === col);

  const isSelected = (row: number, col: number) =>
    store.selectedCell?.row === row && store.selectedCell?.col === col;

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest}><IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} /></IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>{roomName}</IonTitle>
          <IonButtons slot="end">
            {store.inJumpSequence && !isSpectator && (
              <IonButton onClick={() => store.endTurn(roomId)} style={{ '--color': '#c9a84c' }}>
                <IonIcon icon={checkmarkDoneOutline} />
              </IonButton>
            )}
            <IonText style={{ color: '#c9a84c', fontSize: 14, paddingRight: 12 }}>${betAmount}</IonText>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        <div style={{ padding: '8px 16px' }}>
          {isSpectator && <SpectatorBadge />}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <IonText style={{ color: isMyTurn && !isSpectator ? '#c9a84c' : '#8a9bbf', fontSize: 13 }}>
              {isSpectator
                ? applyWsMessagePlaceholders(t('spectator_generic_turn_x'), { username: store.currentPlayer })
                : isMyTurn
                  ? `▶ ${t('ws.games.yourTurn')}`
                  : applyWsMessagePlaceholders(t('bs_named_opponent_turn'), { username: opponentName })}
            </IonText>
            {store.inJumpSequence && (
              <IonText style={{ color: '#c9a84c', fontSize: 12 }}>{t('ws.games.canJumpAgain')}</IonText>
            )}
          </div>

          <TurnTimer seconds={30} isMyTurn={isMyTurn} onTimeout={() => {}} />

          {/* Board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(8, ${cellSize}px)`,
            gridTemplateRows: `repeat(8, ${cellSize}px)`,
            border: '2px solid #1a3050',
            borderRadius: 4,
            overflow: 'hidden',
            margin: '0 auto',
            width: 8 * cellSize,
          }}>
            {store.board.map((row, r) =>
              row.map((cell, c) => {
                const dark = isDark(r, c);
                const selected = isSelected(r, c);
                const valid = isValidMove(r, c);
                const trail = isTrail(r, c);

                let bg = getCellBg(r, c);
                if (trail) bg = 'rgba(100, 80, 200, 0.4)';
                if (valid && dark) bg = 'rgba(80, 160, 80, 0.35)';
                if (selected) bg = 'rgba(201, 168, 76, 0.3)';

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => !isSpectator && store.cellTapped(r, c, roomId)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: dark && !isSpectator ? 'pointer' : 'default',
                      position: 'relative',
                      boxSizing: 'border-box',
                      border: selected ? '2px solid #c9a84c' : 'none',
                    }}
                  >
                    {valid && cell === 'empty' && dark && (
                      <div style={{ width: cellSize * 0.3, height: cellSize * 0.3, borderRadius: '50%', background: 'rgba(80,200,80,0.6)' }} />
                    )}
                    {cell === 'mine' && (
                      <div style={{
                        width: cellSize * 0.65, height: cellSize * 0.65,
                        borderRadius: '50%',
                        background: selected ? '#e8c96e' : '#c9a84c',
                        boxShadow: selected ? '0 0 8px rgba(201,168,76,0.8)' : '0 2px 4px rgba(0,0,0,0.4)',
                      }} />
                    )}
                    {cell === 'opponent' && (
                      <div style={{
                        width: cellSize * 0.65, height: cellSize * 0.65,
                        borderRadius: '50%',
                        background: '#cf4a5a',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#c9a84c' }} />
              <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>{t('label_you') || t('recharge_important_information')}</IonText>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#cf4a5a' }} />
              <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>{opponentName}</IonText>
            </div>
          </div>

          {!isSpectator && store.inJumpSequence && (
            <IonButton
              expand="block"
              onClick={() => store.endTurn(roomId)}
              style={{ marginTop: 12, '--background': 'rgba(201,168,76,0.15)', '--color': '#c9a84c', '--border-radius': '10px', border: '1px solid rgba(201,168,76,0.4)' }}
            >
              {t('halma_end_turn')}
            </IonButton>
          )}

          <ChatGreetingChips greetings={greetings} onSend={(id) => chatRef.current.sendGreeting(roomId, id)} lastReceivedMessage={lastMsg} />
        </div>
      </IonContent>

      <GameOverModal isOpen={!!store.gameOver} gameOver={store.gameOver} isSpectator={isSpectator} onExit={onLeaveRequest} gameProfile="HALMA" />
    </IonPage>
  );
}
