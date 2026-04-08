import { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonToast, IonModal,
} from '@ionic/react';
import { arrowBackOutline, refreshOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useBattleshipStore, SHIP_CATALOG } from '../../../store/battleshipStore';
import type { PlacedShip } from '../../../store/battleshipStore';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import SpectatorBadge from '../components/SpectatorBadge';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import { useT } from '../../../i18n/translations';
import { formatApiMessageForDisplay, applyWsMessagePlaceholders } from '../../../i18n/ApiMessageDisplay';
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

        // Vertical: rotate(90deg) with transformOrigin '0 0' uses matrix [[0,-1],[1,0]]
        // which visually places the image at [left-CELL, left] × [top, top+longSide].
        // Add CELL to left so the visual left edge aligns with column x.
        return (
          <img
            key={s.type}
            src={shipImageSrc(s.type)}
            alt={s.type}
            draggable={false}
            style={{
              position: 'absolute',
              left: x + CELL, top: y,
              width: longSide, height: CELL,
              objectFit: 'fill',
              transform: 'rotate(90deg)',
              transformOrigin: '0 0',
              pointerEvents: 'none',
              zIndex: 3,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
            }}
          />
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
  board, ships, showShips, clickable, isSpectator, boardSide, onFire,
}: {
  board: string[][];
  ships: PlacedShip[];
  showShips: boolean;
  clickable: boolean;
  isSpectator: boolean;
  boardSide: 'player' | 'opponent';
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
              const anim = store.animatingShot;
              const isAnim = anim?.row === r && anim?.col === c && anim?.board === boardSide;
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
  hasOpponent: boolean;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function BattleshipPage({
  roomId, betAmount, roomName, opponentName, hasOpponent, isSpectator, onLeaveRequest,
}: Props) {
  const { user } = useAuthStore();
  const store    = useBattleshipStore();
  const t        = useT();
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);

  useEffect(() => {
    const myUsername = user?.username ?? '';
    store.initGame(roomId, myUsername, hasOpponent, opponentName, isSpectator);
    return () => { store.cleanup(); };
  }, [roomId]);

  // ── Placement phase ─────────────────────────────────────────────────────────
  const renderPlacement = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <p style={{ color: 'rgba(201,168,76,0.75)', fontSize: 12, margin: 0, textAlign: 'center' }}>
          {t('bs_placement_hint') || t('recharge_important_information')}
        </p>

        {/* Opponent joined status banner */}
        {!store.opponentConfirmed ? (
          <div style={{
            background: 'rgba(255,160,0,0.12)',
            border: '1px solid rgba(255,160,0,0.35)',
            borderRadius: 8, padding: '8px 16px',
            color: '#ffb74d', fontSize: 12, textAlign: 'center',
          }}>
            ⏳ {t('halma_status_waiting_opponent')}
          </div>
        ) : (
          <div style={{
            background: 'rgba(76,175,80,0.12)',
            border: '1px solid rgba(76,175,80,0.35)',
            borderRadius: 8, padding: '8px 16px',
            color: '#81c784', fontSize: 12, textAlign: 'center',
          }}>
            ✓ {applyWsMessagePlaceholders(t('bs_status_joined_room'), { username: store.opponentName || opponentName })}
          </div>
        )}

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
          {store.selectedHorizontal ? t('bs_horizontal') : t('bs_vertical')}
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

        {/* Action Buttons — only shown when opponent is confirmed */}
        {store.opponentConfirmed && (
          <div style={{ width: GRID_PX + 16, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
            {/* Reset Fleet Button */}
            <button
              onClick={() => store.resetFleet()}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <IonIcon icon={refreshOutline} style={{ marginRight: '6px', fontSize: '16px', verticalAlign: 'middle' }} />
              {t('bs_reset_button')}
            </button>

            {/* Ready button */}
            <button
              onClick={() => store.placedShips.length >= SHIP_CATALOG.length && setShowReadyConfirm(true)}
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
              {t('bs_ready_button')} ({store.placedShips.length}/{SHIP_CATALOG.length})
            </button>
          </div>
        )}
      </div>

      <IonToast
        isOpen={!!store.placementError}
        message={formatApiMessageForDisplay(store.placementError)}
        duration={2000}
        position="top"
        onDidDismiss={() => store.clearPlacementError()}
        style={{ '--background': '#1e0e12', '--color': '#ff8a8a', '--border-radius': '10px' }}
      />
    </IonContent>
  );

  // ── Waiting phase ───────────────────────────────────────────────────────────
  const renderWaiting = () => {
    const waitingForJoin = !store.opponentConfirmed;
    const waitingLabel = waitingForJoin
      ? t('bs_status_waiting_opponent')
      : t('bs_waiting_title');
    const waitingDesc = waitingForJoin
      ? t('bs_placement_waiting_opponent')
      : t('bs_waiting_opponent_ready');
    return (
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
              <p style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>
                {waitingLabel}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: 13, textAlign: 'center', padding: '0 24px' }}>
                {waitingDesc}
              </p>
            </div>
          </OceanPanel>
        </div>
      </IonContent>
    );
  };

  // ── Battle phase ────────────────────────────────────────────────────────────
  const renderBattle = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        padding: '8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {isSpectator && <SpectatorBadge count={store.spectatorsCount} />}

        <TurnTimer
          seconds={store.turnTimerSeconds}
          isMyTurn={store.isMyTurn}
          onTimeout={() => {}}
          turnPlayerName={isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
          resetKey={isSpectator ? store.shotCount : undefined}
        />

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
              {isSpectator
                ? `⚡ ${store.spectatorOpponentFleetName || store.opponentName || opponentName}`
                : `⚡ ${t('bs_enemy_waters')} — ${store.opponentName || opponentName}`}
            </span>
            {store.isMyTurn && !isSpectator && (
              <span style={{ color: '#c9a84c', fontSize: 11, fontWeight: 600 }}>{t('bs_your_turn')}</span>
            )}
          </div>
          <BattleGrid
            board={store.opponentBoard}
            ships={[]}
            showShips={false}
            clickable={store.isMyTurn && !isSpectator}
            isSpectator={isSpectator}
            boardSide="opponent"
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
              {isSpectator
                ? `⚓ ${store.spectatorFleetOwnerName || store.spectatorBoardOwner}`
                : `⚓ ${t('bs_your_fleet')}`}
            </span>
            {!store.isMyTurn && !isSpectator && (
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{t('bs_opponent_turn')}</span>
            )}
          </div>
          <BattleGrid
            board={store.playerBoard}
            ships={store.placedShips}
            showShips={true}
            clickable={false}
            isSpectator={isSpectator}
            boardSide="player"
            onFire={() => {}}
          />
        </div>

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
        isSpectator={isSpectator}
        onExit={onLeaveRequest}
        gameProfile="BATTLESHIP"
      />
      <GenericErrorModal
        isOpen={!!store.error}
        message={formatApiMessageForDisplay(store.error)}
        onDismiss={() => store.clearError()}
      />

      {/* ── Ready confirmation modal ── */}
      <IonModal
        isOpen={showReadyConfirm}
        onDidDismiss={() => setShowReadyConfirm(false)}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        style={{ '--height': 'auto' }}
      >
        <div style={{
          background: '#0d1e30',
          borderRadius: '16px 16px 0 0',
          padding: '28px 20px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Title */}
          <h2 style={{
            margin: 0, textAlign: 'center',
            color: '#fff', fontSize: 20, fontWeight: 800,
          }}>
            {t('bs_ready_confirm_title')}
          </h2>

          {/* Bet info row (only when betAmount > 0) */}
          {betAmount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(201,168,76,0.10)',
              border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <span style={{ color: '#e8d08a', fontSize: 13, lineHeight: 1.4 }}>
                {t('bs_ready_confirm_bet_info').replace('%s', `$${betAmount.toFixed(2)}`)}
              </span>
            </div>
          )}

          {/* Forfeit warning row */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(255,107,53,0.10)',
            border: '1px solid rgba(255,107,53,0.30)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <span style={{ color: '#ff8a5c', fontSize: 13, lineHeight: 1.4 }}>
              {t('rooms_join_forfeit_warning') || t('recharge_important_information')}
            </span>
          </div>

          {/* Confirm button */}
          <button
            onClick={() => {
              setShowReadyConfirm(false);
              store.submitPlacement(roomId);
            }}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
              border: 'none',
              color: '#0a1628', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', letterSpacing: '0.5px',
            }}
          >
            {t('bs_ready_confirm_button')}
          </button>

          {/* Cancel button */}
          <button
            onClick={() => setShowReadyConfirm(false)}
            style={{
              width: '100%', padding: '12px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(201,168,76,0.35)',
              color: '#c9a84c', fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('cancel')}
          </button>
        </div>
      </IonModal>

      {/* Opponent joined notification */}
      <IonToast
        isOpen={!!store.opponentJoinedToast}
        message={store.opponentJoinedToast ? applyWsMessagePlaceholders(t(store.opponentJoinedToast), { username: store.opponentName }) : ''}
        duration={3000}
        position="top"
        onDidDismiss={() => store.clearOpponentJoinedToast()}
        style={{ '--background': '#0d2a18', '--color': '#81c784', '--border-radius': '10px' }}
      />

      {/* Shot result feedback (hit / miss / sunk) */}
      <IonToast
        isOpen={!!store.shotMessage}
        message={store.shotMessage ? applyWsMessagePlaceholders(t(store.shotMessage), { username: store.opponentName, shipType: store.lastShot?.result === 'sunk' ? 'Ship' : '' }) : ''}
        duration={2500}
        position="bottom"
        onDidDismiss={() => store.clearShotMessage()}
        style={{ '--background': '#0d1e30', '--color': '#e8d08a', '--border-radius': '10px' }}
      />

      {/* ── Opponent left pre-game dialog ── */}
      <IonModal
        isOpen={store.opponentLeftDialog}
        onDidDismiss={() => {/* force explicit choice — do not dismiss on backdrop */}}
        backdropDismiss={false}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        style={{ '--height': 'auto' }}
      >
        <div style={{
          background: '#0d1e30',
          borderRadius: '16px 16px 0 0',
          padding: '28px 20px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Title */}
          <h2 style={{
            margin: 0, textAlign: 'center',
            color: '#ffb74d', fontSize: 20, fontWeight: 800,
          }}>
            {t('bs_opponent_left_title')}
          </h2>

          {/* Message */}
          <p style={{
            margin: 0, textAlign: 'center',
            color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.5,
          }}>
            {t('bs_opponent_left')}
          </p>

          {/* Balance note row */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(76,175,80,0.10)',
            border: '1px solid rgba(76,175,80,0.30)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💰</span>
            <span style={{ color: '#81c784', fontSize: 13, lineHeight: 1.4 }}>
              {t('bs_opponent_left_balance_note')}
            </span>
          </div>

          {/* Wait button */}
          <button
            onClick={() => store.clearOpponentLeftDialog()}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
              border: 'none',
              color: '#0a1628', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', letterSpacing: '0.5px',
            }}
          >
            {t('bs_opponent_left_wait')}
          </button>

          {/* Leave button */}
          <button
            onClick={() => { store.clearOpponentLeftDialog(); onLeaveRequest(); }}
            style={{
              width: '100%', padding: '12px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(255,107,107,0.5)',
              color: '#ff6b6b', fontWeight: 600, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('bs_leave_confirm_leave')}
          </button>
        </div>
      </IonModal>
    </IonPage>
  );
}
