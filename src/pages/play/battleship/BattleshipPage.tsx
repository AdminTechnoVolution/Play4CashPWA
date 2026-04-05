import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonFooter,
  IonGrid, IonRow, IonCol, IonChip, IonLabel,
} from '@ionic/react';
import { arrowBackOutline, refreshOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useBattleshipStore, SHIP_CATALOG } from '../../../store/battleshipStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';

const CELL_SIZE = 30;

const cellColor = (cell: string, animate: boolean) => {
  if (animate) return '#c9a84c';
  switch (cell) {
    case 'ship': return '#1e3a5f';
    case 'hit': return '#cf4a5a';
    case 'miss': return '#2a3f5f';
    case 'sunk': return '#7a1a2a';
    default: return '#0d1f35';
  }
};

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function BattleshipPage({ roomId, betAmount, roomName, opponentName, isSpectator, onLeaveRequest }: Props) {
  const { user } = useAuthStore();
  const store = useBattleshipStore();
  const chatRef = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    const myUsername = user?.username ?? '';
    store.initGame(roomId, myUsername);
    const chat = chatRef.current;
    chat.connect();
    chat.onMessage((msg) => setLastMsg(msg));
    apiRepository.getGreetings().then(setGreetings).catch(() => {});
    return () => {
      store.cleanup();
      chat.disconnect();
    };
  }, [roomId]);

  const sendGreeting = (id: string) => chatRef.current.sendGreeting(roomId, id);

  const renderGrid = (board: string[][], clickable: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(10, ${CELL_SIZE}px)`, gap: 2 }}>
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isAnim = store.animatingShot?.row === r && store.animatingShot?.col === c;
          return (
            <div
              key={`${r}-${c}`}
              onClick={() => clickable && !isSpectator && store.fire(roomId, r, c)}
              style={{
                width: CELL_SIZE, height: CELL_SIZE,
                background: cellColor(cell, isAnim),
                borderRadius: 3,
                border: clickable && cell === 'empty' ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.05)',
                cursor: clickable && !isSpectator ? 'pointer' : 'default',
                transition: 'background 0.3s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}
            >
              {cell === 'hit' && '💥'}
              {cell === 'miss' && '·'}
              {cell === 'sunk' && '✕'}
            </div>
          );
        })
      )}
    </div>
  );

  const renderPlacement = () => (
    <IonContent style={{ '--background': '#0a1628' }}>
      <div style={{ padding: 16 }}>
        <IonText><h3 style={{ color: '#c9a84c', margin: '0 0 12px' }}>Place your ships</h3></IonText>
        {renderGrid(store.playerBoard, false)}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <IonChip
              onClick={() => store.toggleOrientation()}
              style={{ '--background': 'rgba(201,168,76,0.15)', '--color': '#c9a84c', border: '1px solid #c9a84c' }}
            >
              <IonIcon icon={swapHorizontalOutline} />
              <IonLabel style={{ marginLeft: 4 }}>{store.selectedHorizontal ? 'Horizontal' : 'Vertical'}</IonLabel>
            </IonChip>
          </div>
          {SHIP_CATALOG.map((s) => {
            const placed = store.placedShips.find((p) => p.type === s.type);
            return (
              <div
                key={s.type}
                onClick={() => store.selectShipType(s.type)}
                style={{
                  padding: '10px 14px',
                  marginBottom: 6,
                  borderRadius: 8,
                  background: store.selectedShipType === s.type ? 'rgba(201,168,76,0.2)' : '#131f35',
                  border: `1px solid ${store.selectedShipType === s.type ? '#c9a84c' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ color: '#fff', fontSize: 14 }}>{s.type} ({s.size})</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: s.size }).map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: placed ? '#c9a84c' : '#2a3f5f' }} />
                  ))}
                </div>
                {placed && (
                  <IonIcon
                    icon={refreshOutline}
                    onClick={(e) => { e.stopPropagation(); store.removeShip(s.type); }}
                    style={{ color: '#cf6679', marginLeft: 8 }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p style={{ color: '#8a9bbf', fontSize: 12, marginTop: 8 }}>Tap a cell on the grid to place selected ship</p>
        <div style={{ marginTop: 16 }}>
          <IonButton
            expand="block"
            onClick={() => store.submitPlacement(roomId)}
            disabled={store.placedShips.length < SHIP_CATALOG.length}
            style={{ '--background': '#c9a84c', '--color': '#0a1628', '--border-radius': '12px' }}
          >
            Ready ({store.placedShips.length}/{SHIP_CATALOG.length})
          </IonButton>
        </div>
      </div>
      <div
        onClick={(e) => {
          const target = e.currentTarget.getBoundingClientRect();
          const col = Math.floor((e.clientX - target.left) / (CELL_SIZE + 2));
          const row = Math.floor((e.clientY - target.top) / (CELL_SIZE + 2));
          if (row >= 0 && row < 10 && col >= 0 && col < 10) store.placeShipAt(row, col);
        }}
        style={{ position: 'absolute', top: 68, left: 16, width: 10 * (CELL_SIZE + 2), height: 10 * (CELL_SIZE + 2), cursor: 'crosshair' }}
      />
    </IonContent>
  );

  const renderBattle = () => (
    <IonContent style={{ '--background': '#0a1628' }}>
      <div style={{ padding: 12 }}>
        {isSpectator && <SpectatorBadge />}
        <TurnTimer
          seconds={30}
          isMyTurn={store.isMyTurn}
          onTimeout={() => {}}
        />
        <div style={{ marginBottom: 16 }}>
          <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>Opponent — {opponentName}</IonText>
          {renderGrid(store.opponentBoard, store.isMyTurn && !isSpectator)}
        </div>
        <div>
          <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>Your Board</IonText>
          {renderGrid(store.playerBoard, false)}
        </div>
        <ChatGreetingChips greetings={greetings} onSend={sendGreeting} lastReceivedMessage={lastMsg} />
      </div>
    </IonContent>
  );

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>{roomName}</IonTitle>
          <IonButtons slot="end">
            <IonText style={{ color: '#c9a84c', fontSize: 14, paddingRight: 12 }}>
              ${betAmount}
            </IonText>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {store.phase === 'placement' ? renderPlacement() : renderBattle()}

      <GameOverModal
        isOpen={!!store.gameOver}
        gameOver={store.gameOver}
        onPlayAgain={onLeaveRequest}
        onExit={onLeaveRequest}
      />
      <GenericErrorModal
        isOpen={!!store.error}
        message={store.error ?? ''}
        onDismiss={() => store.clearError()}
      />
    </IonPage>
  );
}
