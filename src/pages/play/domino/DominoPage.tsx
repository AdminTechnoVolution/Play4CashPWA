import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonModal, IonList, IonItem, IonLabel,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useDominoStore } from '../../../store/dominoStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { DominoTile, GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import GameOverModal from '../components/GameOverModal';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import { useT } from '../../../i18n/translations';
import { applyWsMessagePlaceholders } from '../../../i18n/ApiMessageDisplay';

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

function DominoTileView({ tile, selected, valid, dim, onClick }: {
  tile: DominoTile;
  selected?: boolean;
  valid?: boolean;
  dim?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        width: 56, height: 28,
        border: `2px solid ${selected ? '#c9a84c' : valid ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 4,
        background: dim ? '#0d1a2a' : '#131f35',
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <div style={{ flex: 1, textAlign: 'center', color: selected ? '#c9a84c' : '#fff', fontSize: 13, fontWeight: 700 }}>{tile.a}</div>
      <div style={{ width: 2, background: 'rgba(255,255,255,0.3)', height: '70%' }} />
      <div style={{ flex: 1, textAlign: 'center', color: selected ? '#c9a84c' : '#fff', fontSize: 13, fontWeight: 700 }}>{tile.b}</div>
    </div>
  );
}

export default function DominoPage({ roomId, betAmount, roomName, opponentName, isSpectator, onLeaveRequest }: Props) {
  const { user } = useAuthStore();
  const store = useDominoStore();
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
  const canDraw = isMyTurn && store.validMoves.length === 0 && store.boneyardCount > 0;
  const canPass = isMyTurn && store.validMoves.length === 0 && store.boneyardCount === 0;

  const handleTileClick = (tile: DominoTile) => {
    if (isSpectator || !isMyTurn) return;
    const vm = store.validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
    if (!vm) return;
    if (vm.sides.length === 1) {
      store.playSide(roomId, tile, vm.sides[0]);
    } else {
      store.selectTile(tile);
    }
  };

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest}><IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} /></IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>{roomName}</IonTitle>
          <IonButtons slot="end">
            <IonText style={{ color: '#c9a84c', fontSize: 14, paddingRight: 12 }}>${betAmount}</IonText>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isSpectator && <SpectatorBadge />}

          {/* Turn + opponent info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IonText style={{ color: isSpectator ? '#8a9bbf' : (isMyTurn ? '#c9a84c' : '#8a9bbf'), fontSize: 13 }}>
              {isSpectator
                ? applyWsMessagePlaceholders(t('spectator_generic_turn_x'), { username: store.currentPlayer })
                : isMyTurn
                  ? `▶ ${t('domino_your_turn')}`
                  : applyWsMessagePlaceholders(t('bs_named_opponent_turn'), { username: opponentName })}
            </IonText>
            <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>
              {applyWsMessagePlaceholders(t('domino_boneyard_count'), { count: store.boneyardCount })}
            </IonText>
          </div>

          {/* Opponents tile counts */}
          <div style={{ display: 'flex', gap: 8 }}>
            {store.opponents.map((op) => (
              <div key={op.username} style={{ padding: '4px 10px', background: '#131f35', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>{op.username}: {applyWsMessagePlaceholders(t('domino_tile_count'), { count: op.tileCount })}</IonText>
              </div>
            ))}
          </div>

          {/* Board */}
          <div style={{ background: '#0d1a2a', borderRadius: 12, padding: 8, minHeight: 80, border: '1px solid rgba(255,255,255,0.08)' }}>
            <IonText style={{ color: '#8a9bbf', fontSize: 11, marginBottom: 6 }}>{t('play_room_label') || 'Board'}</IonText>
            {store.board.length === 0 ? (
              <IonText style={{ color: '#4a5a7a', fontSize: 13 }}>{t('domino_board_empty')}</IonText>
            ) : (
              <div style={{ display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 4, alignItems: 'center' }}>
                <IonText style={{ color: '#c9a84c', fontSize: 12, flexShrink: 0 }}>[{store.leftEnd}]</IonText>
                {store.board.slice(0, 12).map((t_tile, i) => (
                  <DominoTileView key={i} tile={t_tile} dim />
                ))}
                {store.board.length > 12 && <IonText style={{ color: '#4a5a7a' }}>…</IonText>}
                <IonText style={{ color: '#c9a84c', fontSize: 12, flexShrink: 0 }}>[{store.rightEnd}]</IonText>
              </div>
            )}
          </div>

          {/* My hand / Spectator hidden hand */}
          {isSpectator ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#4a5a7a',
              fontSize: 13,
              textAlign: 'center',
            }}>
              {t('spectator_domino_hidden_hand')}
            </div>
          ) : (
            <div>
              <IonText style={{ color: '#8a9bbf', fontSize: 12, marginBottom: 8 }}>{t('domino_your_hand')} ({store.myHand.length})</IonText>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {store.myHand.map((tile, i) => {
                  const vm = store.validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
                  const isValid = !!vm && isMyTurn;
                  const isSelected = store.sidePickTile?.a === tile.a && store.sidePickTile?.b === tile.b;
                  return (
                    <DominoTileView
                      key={i}
                      tile={tile}
                      valid={isValid}
                      selected={isSelected}
                      dim={!isValid && isMyTurn}
                      onClick={() => handleTileClick(tile)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isSpectator && (
            <div style={{ display: 'flex', gap: 8 }}>
              {canDraw && (
                <IonButton
                  onClick={() => store.draw(roomId)}
                  style={{ '--background': '#1a2940', '--color': '#c9a84c', '--border-radius': '8px', flex: 1 }}
                >
                  {t('domino_draw_tile')}
                </IonButton>
              )}
              {canPass && (
                <IonButton
                  onClick={() => store.pass(roomId)}
                  style={{ '--background': '#1a2940', '--color': '#8a9bbf', '--border-radius': '8px', flex: 1 }}
                >
                  {t('domino_pass_turn')}
                </IonButton>
              )}
            </div>
          )}

          <ChatGreetingChips greetings={greetings} onSend={(id) => chatRef.current.sendGreeting(roomId, id)} lastReceivedMessage={lastMsg} />
        </div>
      </IonContent>

      {/* Side picker modal */}
      <IonModal isOpen={!!store.sidePickTile} onDidDismiss={() => store.selectTile(null)} breakpoints={[0, 0.35]} initialBreakpoint={0.35}>
        <div style={{ padding: 16 }}>
          <IonText style={{ color: '#c9a84c', fontSize: 15, fontWeight: 700 }}>{t('domino_select_side_hint')}</IonText>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <IonButton
              expand="block"
              onClick={() => store.sidePickTile && store.playSide(roomId, store.sidePickTile, 'left')}
              style={{ '--background': '#131f35', '--color': '#c9a84c', '--border-radius': '10px', flex: 1, border: '1px solid #c9a84c' }}
            >
              ← {t('domino_place_left')} [{store.leftEnd}]
            </IonButton>
            <IonButton
              expand="block"
              onClick={() => store.sidePickTile && store.playSide(roomId, store.sidePickTile, 'right')}
              style={{ '--background': '#131f35', '--color': '#c9a84c', '--border-radius': '10px', flex: 1, border: '1px solid #c9a84c' }}
            >
              {t('domino_place_right')} [{store.rightEnd}]
            </IonButton>
          </div>
        </div>
      </IonModal>

      <GameOverModal isOpen={!!store.gameOver} gameOver={store.gameOver} isSpectator={isSpectator} onExit={onLeaveRequest} gameProfile="DOMINO" />
    </IonPage>
  );
}
