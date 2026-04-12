import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonCard, IonCardContent, IonSpinner
} from '@ionic/react';
import { arrowBackOutline, flame } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useHalmaStore, HalmaPhase, HalmaCellState } from '../../../store/halmaStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';
import TurnTimer from '../components/TurnTimer';
import GameOverModal from '../components/GameOverModal';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import GameSound from '../../../ui/game/GameSound';

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  isPlayer1: boolean;
  onLeaveRequest: () => void;
}

export default function HalmaPage({ roomId, betAmount, onLeaveRequest, isSpectator, opponentName: initialOpponentName }: Props) {
  const { user } = useAuthStore();
  const store = useHalmaStore();
  const t = useT();
  const chatRef = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!roomId) return;
    store.initGame(roomId, user?.username ?? '', betAmount, false, initialOpponentName, isSpectator);
    
    const chat = chatRef.current;
    chat.connect(roomId);
    chat.onMessage(setLastMsg);
    
    apiRepository.getGreetings().then(setGreetings).catch(() => {});
    return () => { 
      store.cleanup(); 
      chat.disconnect();
    };
  }, [roomId]);

  // Sound: piece move (matches Android LaunchedEffect(state.moveCount))
  const prevMoveCount = useRef(0);
  useEffect(() => {
    if (store.moveCount > 0 && store.moveCount !== prevMoveCount.current) {
      GameSound.pieceMove();
    }
    prevMoveCount.current = store.moveCount;
  }, [store.moveCount]);

  const cellSize = Math.min(Math.floor((window.innerWidth - 32) / 8), 44);

  const getCellBg = (r: number, c: number) => {
    const dark = (r + c) % 2 !== 0;
    return dark ? '#769656' : '#EEEED2';
  };

  const isTrail = (row: number, col: number) =>
    store.jumpTrail.some((c) => c.row === row && c.col === col);

  const isValidMove = (row: number, col: number) =>
    store.validMoves.some((m) => m.row === row && m.col === col);

  const isSelected = (row: number, col: number) =>
    store.selectedRow === row && store.selectedCol === col;

  const isPendingCapture = (row: number, col: number) =>
    store.pendingCaptures.some(p => p.row === row && p.col === col);

  const renderWaiting = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      <IonCard style={{ width: '85%', maxWidth: '340px', '--background': '#1a2940', borderRadius: '24px', textAlign: 'center', border: '2px solid rgba(255,255,255,0.1)' }}>
        <IonCardContent style={{ padding: '32px 24px' }}>
          <IonText style={{ color: '#fff', fontSize: '20px', fontWeight: '800', display: 'block', marginBottom: '16px', letterSpacing: '2px' }}>
            {t('bs_waiting_title').toUpperCase()}
          </IonText>
          <IonSpinner name="crescent" style={{ color: '#c9a84c', marginBottom: '24px', width: '48px', height: '48px' }} />
          <IonText style={{ color: '#8a9bbf', fontSize: '15px', display: 'block', marginBottom: '32px', lineHeight: '1.4' }}>
            {store.statusMessage}
          </IonText>
          <IonButton expand="block" onClick={onLeaveRequest} style={{ '--background': 'transparent', '--color': '#8a9bbf', '--border-radius': '12px', border: '1px solid rgba(138,155,191,0.3)', fontWeight: 'bold' }}>
            {t('bs_leave_room')}
          </IonButton>
        </IonCardContent>
      </IonCard>
    </div>
  );

  const renderHeader = () => {
    return (
      <div style={{ marginBottom: '16px' }}>
        <TurnTimer
          seconds={store.turnTimeLeft}
          isMyTurn={store.isPlayerTurn}
          onTimeout={() => {}}
          turnPlayerName={store.isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
          resetKey={store.isSpectator ? store.moveCount : undefined}
        />
      </div>
    );
  };

  const renderPiece = (cell: HalmaCellState, size: number) => {
    const isMine = cell === HalmaCellState.PLAYER || cell === HalmaCellState.PLAYER_KING;
    const isKing = cell === HalmaCellState.PLAYER_KING || cell === HalmaCellState.OPPONENT_KING;
    
    const borderColor = isMine ? '#D4C090' : '#111111';
    const crownColor = isMine ? '#B8860B' : '#E8C547';

    return (
      <div style={{
        width: size * 0.75, height: size * 0.75,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${isMine ? '#fff, #F0E8D0, #D4C090' : '#606060, #282828, #111111'})`,
        boxShadow: '0 4px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)',
        border: `1px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        {isKing && (
          <span style={{ color: crownColor, fontSize: size * 0.45, fontWeight: '900', position: 'relative', top: -1 }}>♔</span>
        )}
      </div>
    );
  };

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest}><IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} /></IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{t('halma_screen_title')}</IonTitle>
          <IonButtons slot="end">
            <IonText style={{ color: '#c9a84c', fontSize: 14, paddingRight: 12, fontWeight: '800' }}>${betAmount}</IonText>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        {store.phase === HalmaPhase.WAITING && renderWaiting()}

        <div style={{ padding: '16px', opacity: store.phase === HalmaPhase.WAITING ? 0.3 : 1 }}>
          {store.isSpectator && <SpectatorBadge />}
          
          {renderHeader()}

          {/* Board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(8, ${cellSize}px)`,
            gridTemplateRows: `repeat(8, ${cellSize}px)`,
            border: '6px solid #3e2723',
            borderRadius: '8px',
            overflow: 'hidden',
            margin: '0 auto',
            width: 8 * cellSize,
            boxShadow: '0 12px 24px rgba(0,0,0,0.6)',
            background: '#3e2723'
          }}>
            {store.board.map((rowArr, r) =>
              rowArr.map((cell, c) => {
                const selected = isSelected(r, c);
                const valid = isValidMove(r, c);
                const trail = isTrail(r, c);
                const pending = isPendingCapture(r, c);

                let bg = getCellBg(r, c);
                if (selected) bg = '#c9a84c99';

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => store.onCellTap(r, c, roomId)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                      boxSizing: 'border-box',
                      border: '0.5px solid rgba(0,0,0,0.1)'
                    }}
                  >
                    {trail && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(232, 213, 176, 0.4)' }} />
                    )}
                    
                    {cell !== HalmaCellState.EMPTY && renderPiece(cell, cellSize)}

                    {valid && cell === HalmaCellState.EMPTY && (
                      <div style={{ width: cellSize * 0.38, height: cellSize * 0.38, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
                    )}

                    {pending && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '20px', fontWeight: 'bold', pointerEvents: 'none'
                      }}>×</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fff, #F0E8D0, #D4C090)', border: '1px solid #D4C090' }} />
              <IonText style={{ color: '#8a9bbf', fontSize: 13, fontWeight: 'bold' }}>{user?.username || 'Tú'}</IonText>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IonText style={{ color: '#8a9bbf', fontSize: 13, fontWeight: 'bold' }}>{store.opponentName || 'Oponente'}</IonText>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #606060, #282828, #111111)', border: '1px solid #111' }} />
            </div>
          </div>

          {(store.mustEndTurn || store.isContinuingJump) && !store.isSpectator && (
            <IonButton
              expand="block"
              onClick={() => store.endTurnManually(roomId)}
              className={store.turnTimeLeft <= 10 ? 'red-zone-btn' : ''}
              style={{ 
                margin: '16px 0', 
                '--background': store.turnTimeLeft <= 10 ? '#E53935' : '#4CAF50', 
                '--color': '#fff', 
                '--border-radius': '14px',
                '--box-shadow': '0 4px 12px rgba(0,0,0,0.3)',
                fontWeight: '900',
                fontSize: '17px',
                height: '56px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {store.turnTimeLeft <= 10 && <span>🔥</span>}
                {t('halma_send_move').toUpperCase()}
                {store.turnTimeLeft <= 10 && <span>🔥</span>}
              </div>
            </IonButton>
          )}

          {store.isContinuingJump && (
            <IonText style={{ color: '#FF9800', fontSize: '12px', textAlign: 'center', display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>
              {t('halma_continue_jump')}
            </IonText>
          )}

          {!isSpectator && (
            <div style={{ marginTop: 'auto', paddingBottom: '20px' }}>
              <ChatGreetingChips greetings={greetings} onSend={(id) => chatRef.current.sendGreeting(roomId, id)} lastReceivedMessage={lastMsg} />
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
          }
          .red-zone-btn {
            animation: shake 0.5s infinite;
          }
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            50% { transform: translateX(2px); }
            75% { transform: translateX(-1px); }
            100% { transform: translateX(0); }
          }
        `}</style>
      </IonContent>

      <GameOverModal 
        isOpen={store.phase === HalmaPhase.GAME_OVER} 
        gameOver={store.gameOver} 
        isSpectator={store.isSpectator} 
        onExit={onLeaveRequest} 
        gameProfile="HALMA" 
      />
      
      <GenericErrorModal 
        isOpen={!!store.apiErrorRawMessage} 
        message={store.apiErrorRawMessage || ''} 
        onDismiss={() => { store.clearError(); onLeaveRequest(); }} 
      />
    </IonPage>
  );
}
