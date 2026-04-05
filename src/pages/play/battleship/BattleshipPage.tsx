import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText,
} from '@ionic/react';
import { arrowBackOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useBattleshipStore, SHIP_CATALOG } from '../../../store/battleshipStore';
import type { PlacedShip } from '../../../store/battleshipStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import { useT } from '../../../i18n/translations';
import OceanCanvas from './OceanCanvas';

// ── Grid constants ─────────────────────────────────────────────────────────────
const CELL = 32;
const GAP  = 2;
const GRID_PX = CELL * 10 + GAP * 9; // 338 px

// ── Helpers ───────────────────────────────────────────────────────────────────
function shipImageSrc(type: string): string {
  return `/battleship/bs_sprite_${type.toLowerCase()}.png`;
}

function cellBg(cell: string, animating: boolean): string {
  if (animating) return 'rgba(255,210,60,0.85)';
  switch (cell) {
    case 'hit':  return 'rgba(200,50,55,0.85)';
    case 'miss': return 'rgba(160,200,220,0.30)';
    case 'sunk': return 'rgba(110,18,28,0.90)';
    case 'ship': return 'rgba(10,42,72,0.45)';
    default:     return 'rgba(8,26,50,0.55)';
  }
}

// ── Ship image overlay (absolutely positioned on top of grid) ─────────────────
function ShipOverlay({ ships }: { ships: PlacedShip[] }) {
  return (
    <>
      {ships.map((s) => {
        const x        = s.col * (CELL + GAP);
        const y        = s.row * (CELL + GAP);
        const longSide = s.size * CELL + (s.size - 1) * GAP;

        if (s.horizontal) {
          return (
            <img
              key={s.type}
              src={shipImageSrc(s.type)}
              alt={s.type}
              draggable={false}
              style={{
                position: 'absolute',
                left: x, top: y,
                width: longSide, height: CELL,
                objectFit: 'fill',
                pointerEvents: 'none',
                zIndex: 3,
                borderRadius: 4,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
              }}
            />
          );
        }

        // Vertical: rotate 90° inside a CELL-wide × longSide-tall container
        return (
          <div
            key={s.type}
            style={{
              position: 'absolute',
              left: x, top: y,
              width: CELL, height: longSide,
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            <img
              src={shipImageSrc(s.type)}
              alt={s.type}
              draggable={false}
              style={{
                position: 'absolute',
                width: longSide, height: CELL,
                left: (CELL - longSide) / 2,
                top:  (longSide - CELL) / 2,
                objectFit: 'fill',
                transform: 'rotate(90deg)',
                transformOrigin: 'center center',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
              }}
            />
          </div>
        );
      })}
    </>
  );
}

// ── Ocean panel: background image + animated canvas + content ─────────────────
function OceanPanel({
  width, height, children,
}: { width: number; height: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'relative',
      width, height,
      borderRadius: 14,
      overflow: 'hidden',
      background: '#020912',
      boxShadow: '0 4px 28px rgba(0,0,0,0.6)',
    }}>
      {/* Animated whales & fish */}
      <OceanCanvas width={width} height={height} style={{ zIndex: 1 }} />
      {/* Foreground content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}

// ── Battle grid (opponent or own) ─────────────────────────────────────────────
function BattleGrid({
  board, ships, showShips, clickable, isSpectator, onFire,
}: {
  board: string[][];
  ships: PlacedShip[];
  showShips: boolean;
  clickable: boolean;
  isSpectator: boolean;
  onFire: (r: number, c: number) => void;
}) {
  const store = useBattleshipStore();
  return (
    <OceanPanel width={GRID_PX + 16} height={GRID_PX + 16}>
      <div style={{ padding: 8 }}>
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `repeat(10, ${CELL}px)`,
            gap: GAP,
            cursor: clickable && !isSpectator ? 'crosshair' : 'default',
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isAnim = store.animatingShot?.row === r && store.animatingShot?.col === c;
              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => clickable && !isSpectator && onFire(r, c)}
                  style={{
                    width: CELL, height: CELL,
                    background: cellBg(cell, isAnim),
                    borderRadius: 3,
                    border: clickable && cell === 'empty'
                      ? '1px solid rgba(201,168,76,0.25)'
                      : '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    transition: 'background 0.3s',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                  }}
                >
                  {cell === 'hit'  && '💥'}
                  {cell === 'miss' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />}
                  {cell === 'sunk' && <span style={{ color: '#fff', fontSize: 11 }}>✕</span>}
                </div>
              );
            })
          )}
          {showShips && <ShipOverlay ships={ships} />}
        </div>
      </div>
    </OceanPanel>
  );
}

// ── Component props ───────────────────────────────────────────────────────────
interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function BattleshipPage({
  roomId, betAmount, roomName, opponentName, isSpectator, onLeaveRequest,
}: Props) {
  const { user } = useAuthStore();
  const store    = useBattleshipStore();
  const t        = useT();
  const chatRef  = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg]     = useState<ChatMessage | null>(null);

  useEffect(() => {
    const myUsername = user?.username ?? '';
    store.initGame(roomId, myUsername);
    const chat = chatRef.current;
    chat.connect(roomId);
    chat.onMessage((msg) => setLastMsg(msg));
    apiRepository.getGreetings().then(setGreetings).catch(() => {});
    return () => { store.cleanup(); chat.disconnect(); };
  }, [roomId]);

  const sendGreeting = (id: string) => chatRef.current.sendGreeting(roomId, id);

  // ── Placement phase ─────────────────────────────────────────────────────────
  const renderPlacement = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <p style={{ color: 'rgba(201,168,76,0.75)', fontSize: 12, margin: 0, textAlign: 'center' }}>
          Tap a cell to place the selected ship
        </p>

        {/* Placement grid with ocean background */}
        <OceanPanel width={GRID_PX + 16} height={GRID_PX + 16}>
          <div style={{ padding: 8 }}>
            <div
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(10, ${CELL}px)`,
                gap: GAP,
                cursor: 'crosshair',
              }}
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const col  = Math.floor((e.clientX - rect.left)  / (CELL + GAP));
                const row  = Math.floor((e.clientY - rect.top)   / (CELL + GAP));
                if (row >= 0 && row < 10 && col >= 0 && col < 10) store.placeShipAt(row, col);
              }}
            >
              {store.playerBoard.map((row, r) =>
                row.map((_cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      width: CELL, height: CELL,
                      background: 'rgba(8,26,50,0.55)',
                      borderRadius: 3,
                      border: '1px solid rgba(201,168,76,0.14)',
                      boxSizing: 'border-box',
                    }}
                  />
                ))
              )}
              <ShipOverlay ships={store.placedShips} />
            </div>
          </div>
        </OceanPanel>

        {/* Orientation toggle */}
        <button
          onClick={() => store.toggleOrientation()}
          style={{
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.45)',
            borderRadius: 8,
            color: '#c9a84c',
            padding: '8px 20px',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <IonIcon icon={swapHorizontalOutline} style={{ fontSize: 16 }} />
          {store.selectedHorizontal ? 'Horizontal' : 'Vertical'}
        </button>

        {/* Ship list */}
        <div style={{ width: GRID_PX + 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHIP_CATALOG.map((s) => {
            const placed     = store.placedShips.find((p) => p.type === s.type);
            const isSelected = store.selectedShipType === s.type;
            return (
              <div
                key={s.type}
                onClick={() => store.selectShipType(s.type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(201,168,76,0.18)' : 'rgba(13,31,52,0.85)',
                  border: `1px solid ${isSelected ? '#c9a84c' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 14px rgba(201,168,76,0.18)' : 'none',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {/* Ship mini-image */}
                <img
                  src={shipImageSrc(s.type)}
                  alt={s.type}
                  style={{
                    width: s.size * 18 + 4, height: 22,
                    objectFit: 'fill',
                    borderRadius: 3,
                    flexShrink: 0,
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                  }}
                />
                <span style={{ color: '#e8eaf0', fontSize: 13, flex: 1 }}>
                  {s.type} <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>({s.size})</span>
                </span>
                {placed ? (
                  <>
                    <span style={{ color: '#4caf50', fontSize: 14 }}>✓</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); store.removeShip(s.type); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#cf6679', fontSize: 18, padding: 0, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Ready button */}
        <div style={{ width: GRID_PX + 16, paddingBottom: 20 }}>
          <button
            onClick={() => store.submitPlacement(roomId)}
            disabled={store.placedShips.length < SHIP_CATALOG.length}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              background: store.placedShips.length < SHIP_CATALOG.length
                ? 'rgba(201,168,76,0.25)'
                : 'linear-gradient(135deg, #b8922a, #e8c96b)',
              border: 'none',
              color: store.placedShips.length < SHIP_CATALOG.length ? 'rgba(255,255,255,0.4)' : '#0a1628',
              fontWeight: 700,
              fontSize: 15,
              cursor: store.placedShips.length < SHIP_CATALOG.length ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              transition: 'opacity 0.2s',
            }}
          >
            {t('APP.BATTLESHIP.READY_BTN')} ({store.placedShips.length}/{SHIP_CATALOG.length})
          </button>
        </div>
      </div>
    </IonContent>
  );

  // ── Waiting phase ───────────────────────────────────────────────────────────
  const renderWaiting = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: 32,
      }}>
        <OceanPanel width={GRID_PX} height={200}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 200, gap: 14,
          }}>
            <span style={{ fontSize: 44 }}>⚓</span>
            <p style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
              {t('APP.BATTLESHIP.WAITING_TITLE')}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: 13, textAlign: 'center', padding: '0 24px' }}>
              {t('APP.BATTLESHIP.WAITING_DESC')}
            </p>
          </div>
        </OceanPanel>
      </div>
    </IonContent>
  );

  // ── Battle phase ────────────────────────────────────────────────────────────
  const renderBattle = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        padding: '8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {isSpectator && <SpectatorBadge />}

        <TurnTimer seconds={30} isMyTurn={store.isMyTurn} onTimeout={() => {}} />

        {/* ── Opponent board ── */}
        <div style={{ width: GRID_PX + 16 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 5, paddingLeft: 2,
          }}>
            <span style={{
              color: '#e05060', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.8px', textTransform: 'uppercase',
            }}>
              ⚡ Enemy Waters — {opponentName}
            </span>
            {store.isMyTurn && !isSpectator && (
              <span style={{ color: '#c9a84c', fontSize: 11, fontWeight: 600 }}>Your turn</span>
            )}
          </div>
          <BattleGrid
            board={store.opponentBoard}
            ships={[]}
            showShips={false}
            clickable={store.isMyTurn && !isSpectator}
            isSpectator={isSpectator}
            onFire={(r, c) => store.fire(roomId, r, c)}
          />
        </div>

        {/* ── Player board ── */}
        <div style={{ width: GRID_PX + 16 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 5, paddingLeft: 2,
          }}>
            <span style={{
              color: '#4a9ec0', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.8px', textTransform: 'uppercase',
            }}>
              ⚓ My Fleet
            </span>
            {!store.isMyTurn && !isSpectator && (
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>Opponent&apos;s turn</span>
            )}
          </div>
          <BattleGrid
            board={store.playerBoard}
            ships={store.placedShips}
            showShips={true}
            clickable={false}
            isSpectator={isSpectator}
            onFire={() => {}}
          />
        </div>

        <ChatGreetingChips
          greetings={greetings}
          onSend={sendGreeting}
          lastReceivedMessage={lastMsg}
        />
      </div>
    </IonContent>
  );

  // ── Root render ─────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#060e1e', '--border-color': 'rgba(201,168,76,0.2)' }}>
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

      {store.phase === 'placement'
        ? renderPlacement()
        : store.phase === 'waiting'
          ? renderWaiting()
          : renderBattle()}

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
