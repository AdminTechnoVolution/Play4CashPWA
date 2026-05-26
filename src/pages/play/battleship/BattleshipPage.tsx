import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties, RefObject } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonToast, IonModal,
} from '@ionic/react';
import { arrowBackOutline, refreshOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useBattleshipStore, SHIP_CATALOG } from '../../../store/battleshipStore';
import type { PlacedShip } from '../../../store/battleshipStore';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import SpectatorBadge from '../components/SpectatorBadge';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import ConnectionStrengthIndicator from '../../../ui/components/ConnectionStrengthIndicator';
import { useT } from '../../../i18n/translations';
import { formatApiMessageForDisplay, applyWsMessagePlaceholders } from '../../../i18n/ApiMessageDisplay';
import { formatUSD } from '../../../util/formatCurrency';
import OceanCanvas from './OceanCanvas';
import GameSound from '../../../ui/game/GameSound';
import { registerPlayBackConsumer } from '../../../util/playBackNavigation';

// ── Grid constants ─────────────────────────────────────────────────────────────
const CELL = 32;
const GAP  = 2;
const GRID_PX = CELL * 10 + GAP * 9; // 338 px
/** Outer size of one battle board block (grid + 8px padding each side). */
const BATTLE_BOARD_FRAME = GRID_PX + 16;
const BS_DND_MIME = 'application/p4c-battleship';
/** Below this distance (px) pointer-up counts as tap (rotate); above = move ship. */
const PLACEMENT_DRAG_THRESHOLD_PX = 12;
const MISSILE_FALL_MS = 820;
const SUNK_BOMB_FALL_MS = 1800;

// ── Helpers ───────────────────────────────────────────────────────────────────
function shipImageSrc(type: string): string {
  return `/battleship/bs_sprite_${type.toLowerCase()}.png`;
}

function cellBg(cell: string, animating: boolean): string {
  if (animating) return 'rgba(255,210,60,0.85)';
  switch (cell) {
    case 'hit':  return 'rgba(200,50,55,0.85)';
    case 'miss': return 'rgba(160,200,220,0.30)';
    case 'sunk': return 'rgba(80,10,15,0.90)';
    case 'ship': return 'rgba(10,42,72,0.45)';
    default:     return 'rgba(8,26,50,0.55)';
  }
}

// ── Animated fire overlay for hit/sunk cells ─────────────────────────────────
const fireKeyframes = `
@keyframes bsFire {
  0%   { transform: scale(1)   translateY(0);    opacity: 0.9; }
  25%  { transform: scale(1.1) translateY(-1px); opacity: 1;   }
  50%  { transform: scale(0.9) translateY(1px);  opacity: 0.8; }
  75%  { transform: scale(1.1) translateY(-2px); opacity: 1;   }
  100% { transform: scale(1)   translateY(0);    opacity: 0.9; }
}
`;
let fireStyleInjected = false;
function ensureFireStyle() {
  if (fireStyleInjected) return;
  fireStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = fireKeyframes;
  document.head.appendChild(style);
}

function FireEmoji({ delay }: { delay: number }) {
  ensureFireStyle();
  return (
    <span style={{
      position: 'absolute',
      top: -2, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: CELL * 0.65,
      animation: `bsFire 0.6s ease-in-out infinite`,
      animationDelay: `${delay}ms`,
      pointerEvents: 'none',
      filter: 'drop-shadow(0 0 3px rgba(255,100,0,0.8))',
    }}>
      🔥
    </span>
  );
}

function pointerClientToPlacementCell(
  clientX: number,
  clientY: number,
  gridEl: HTMLDivElement | null,
): { row: number; col: number } | null {
  if (!gridEl) return null;
  const rect = gridEl.getBoundingClientRect();
  const col = Math.floor((clientX - rect.left) / (CELL + GAP));
  const row = Math.floor((clientY - rect.top) / (CELL + GAP));
  if (row < 0 || row >= 10 || col < 0 || col >= 10) return null;
  return { row, col };
}

/** Which segment of the ship (cells from anchor) lies under the pointer — used on drag end so anchor ≠ “drop cell” when grabbing mid-ship. */
function grabOffsetFromClientOnShip(
  ship: PlacedShip,
  clientX: number,
  clientY: number,
  gridEl: HTMLDivElement | null,
): { dr: number; dc: number } {
  if (!gridEl) return { dr: 0, dc: 0 };
  const rect = gridEl.getBoundingClientRect();
  const col = Math.floor((clientX - rect.left) / (CELL + GAP));
  const row = Math.floor((clientY - rect.top) / (CELL + GAP));
  if (ship.horizontal) {
    const dc = Math.max(0, Math.min(ship.size - 1, col - ship.col));
    return { dr: 0, dc };
  }
  const dr = Math.max(0, Math.min(ship.size - 1, row - ship.row));
  return { dr, dc: 0 };
}

/** Keep translated ship overlay box inside the GRID_PX square (drag preview). */
function clampDragToGridBox(
  boxLeft: number,
  boxTop: number,
  boxW: number,
  boxH: number,
  tx: number,
  ty: number,
): { tx: number; ty: number } {
  const maxTx = GRID_PX - boxW - boxLeft;
  const minTx = -boxLeft;
  const maxTy = GRID_PX - boxH - boxTop;
  const minTy = -boxTop;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return { tx: 0, ty: 0 };
  return {
    tx: Math.min(maxTx, Math.max(minTx, tx)),
    ty: Math.min(maxTy, Math.max(minTy, ty)),
  };
}

// ── Ship image overlay (absolutely positioned on top of grid) ─────────────────
function ShipOverlay({
  ships,
  interactive = false,
  placementGridRef,
  onPlacedShipClick,
  onPlacedShipDragStart,
  onPlacedShipMove,
}: {
  ships: PlacedShip[];
  interactive?: boolean;
  placementGridRef?: RefObject<HTMLDivElement | null>;
  onPlacedShipClick?: (type: string) => void;
  onPlacedShipDragStart?: (e: React.DragEvent, ship: PlacedShip) => void;
  /** Pointer-based move (works with touch + mouse); takes priority over HTML5 drag when set with placementGridRef. */
  onPlacedShipMove?: (type: string, row: number, col: number) => void;
}) {
  const pointerDragRef = useRef<{
    type: string;
    sx: number;
    sy: number;
    /** Segment index from ship anchor toward bow — subtract from drop cell to get new anchor. */
    grabDr: number;
    grabDc: number;
  } | null>(null);
  /** Live pixel offset while dragging — gives visible DnD feedback before pointerup commits. */
  const [dragDelta, setDragDelta] = useState<{ type: string; dx: number; dy: number } | null>(null);

  const usePointerPlacement = !!(placementGridRef && onPlacedShipMove);

  const finishPointerPlacement = useCallback(
    (e: React.PointerEvent, ship: PlacedShip) => {
      try {
        (e.currentTarget as HTMLImageElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const d = pointerDragRef.current;
      pointerDragRef.current = null;
      setDragDelta(null);
      if (!placementGridRef?.current || !onPlacedShipMove) return;
      if (!d || d.type !== ship.type) return;
      const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
      if (dist < PLACEMENT_DRAG_THRESHOLD_PX) {
        onPlacedShipClick?.(ship.type);
        return;
      }
      const drop = pointerClientToPlacementCell(e.clientX, e.clientY, placementGridRef.current);
      if (!drop) return;
      const anchorRow = drop.row - d.grabDr;
      const anchorCol = drop.col - d.grabDc;
      onPlacedShipMove(ship.type, anchorRow, anchorCol);
    },
    [onPlacedShipMove, onPlacedShipClick, placementGridRef],
  );

  const imgStyleBase = (interactive: boolean): CSSProperties => ({
    objectFit: 'fill',
    // Ionic global normalize sets `img { max-width: 100% }` — breaks explicit px sizes when
    // the wrapper is shrink-to-fit (vertical ships looked like tiny thumbnails).
    maxWidth: 'none',
    pointerEvents: interactive ? 'auto' : 'none',
    zIndex: 3,
    borderRadius: 4,
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
    cursor: interactive ? 'grab' : undefined,
    touchAction: interactive ? 'none' : undefined,
    userSelect: interactive ? 'none' : undefined,
  });

  return (
    <>
      {ships.map((s) => {
        const x        = s.col * (CELL + GAP);
        const y        = s.row * (CELL + GAP);
        const longSide = s.size * CELL + (s.size - 1) * GAP;
        /** Pixel box exactly covering occupied cells (anchor = top-left cell of ship). */
        const overlayW = s.horizontal ? longSide : CELL;
        const overlayH = s.horizontal ? CELL : longSide;

        const pointerHandlers = usePointerPlacement
          ? {
              draggable: false as const,
              onPointerDown: (e: React.PointerEvent<HTMLImageElement>) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                const g = placementGridRef?.current
                  ? grabOffsetFromClientOnShip(s, e.clientX, e.clientY, placementGridRef.current)
                  : { dr: 0, dc: 0 };
                pointerDragRef.current = {
                  type: s.type,
                  sx: e.clientX,
                  sy: e.clientY,
                  grabDr: g.dr,
                  grabDc: g.dc,
                };
                setDragDelta({ type: s.type, dx: 0, dy: 0 });
                e.currentTarget.setPointerCapture(e.pointerId);
              },
              onPointerMove: (e: React.PointerEvent<HTMLImageElement>) => {
                const d = pointerDragRef.current;
                if (!d || d.type !== s.type) return;
                const rawDx = e.clientX - d.sx;
                const rawDy = e.clientY - d.sy;
                const { tx, ty } = clampDragToGridBox(x, y, overlayW, overlayH, rawDx, rawDy);
                setDragDelta({ type: s.type, dx: tx, dy: ty });
              },
              onPointerUp: (e: React.PointerEvent<HTMLImageElement>) => finishPointerPlacement(e, s),
              onPointerCancel: () => {
                pointerDragRef.current = null;
                setDragDelta(null);
              },
            }
          : {};

        const draggingThis =
          usePointerPlacement && dragDelta?.type === s.type ? dragDelta : null;
        const dragTx = draggingThis?.dx ?? 0;
        const dragTy = draggingThis?.dy ?? 0;

        const legacyDragHandlers =
          interactive && !usePointerPlacement
            ? {
                draggable: true as const,
                onDragStart: (e: React.DragEvent<HTMLImageElement>) => {
                  e.stopPropagation();
                  onPlacedShipDragStart?.(e, s);
                },
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onPlacedShipClick?.(s.type);
                },
              }
            : { draggable: false as const };

        if (s.horizontal) {
          return (
            <div
              key={s.type}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: overlayW,
                height: overlayH,
                overflow: 'hidden',
                borderRadius: 3,
                transform: draggingThis ? `translate(${dragTx}px, ${dragTy}px)` : undefined,
                zIndex: draggingThis ? 50 : 3,
                pointerEvents: interactive ? 'auto' : 'none',
              }}
            >
              <img
                src={shipImageSrc(s.type)}
                alt={s.type}
                {...pointerHandlers}
                {...legacyDragHandlers}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  ...imgStyleBase(interactive),
                  opacity: draggingThis ? 0.92 : 1,
                  cursor: draggingThis ? 'grabbing' : interactive ? 'grab' : undefined,
                  filter: draggingThis
                    ? 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))'
                    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
                }}
              />
            </div>
          );
        }

        return (
          <div
            key={s.type}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: overlayW,
              height: overlayH,
              overflow: 'hidden',
              borderRadius: 3,
              transform: draggingThis ? `translate(${dragTx}px, ${dragTy}px)` : undefined,
              zIndex: draggingThis ? 50 : 3,
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          >
            <img
              src={shipImageSrc(s.type)}
              alt={s.type}
              {...pointerHandlers}
              {...legacyDragHandlers}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: longSide,
                height: CELL,
                marginLeft: -longSide / 2,
                marginTop: -CELL / 2,
                transform: 'rotate(90deg)',
                transformOrigin: 'center center',
                ...imgStyleBase(interactive),
                opacity: draggingThis ? 0.92 : 1,
                cursor: draggingThis ? 'grabbing' : interactive ? 'grab' : undefined,
                filter: draggingThis
                  ? 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))'
                  : 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
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

// ── Fleet status panel (mirrors Android FleetStatusPanel) ─────────────────────
function FleetStatusPanel({
  label, ships, board,
}: { label: string; ships: PlacedShip[]; board: string[][] }) {
  const t = useT();
  if (ships.length === 0) return null;
  return (
    <div style={{
      width: GRID_PX + 16,
      background: 'rgba(13,31,52,0.7)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 10,
      padding: 12,
    }}>
      <p style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        margin: '0 0 8px',
      }}>
        {label}
      </p>
      {ships.map((ship) => {
        const cells: [number, number][] = [];
        for (let i = 0; i < ship.size; i++) {
          cells.push(ship.horizontal ? [ship.row, ship.col + i] : [ship.row + i, ship.col]);
        }
        const hits = cells.filter(([r, c]) => board[r]?.[c] === 'hit' || board[r]?.[c] === 'sunk').length;
        const isSunk = hits === ship.size;
        return (
          <div key={ship.type} style={{ display: 'flex', alignItems: 'center', padding: '3px 0' }}>
            <span style={{
              width: 82,
              color: isSunk ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)',
              fontSize: 11,
              flexShrink: 0,
              textDecoration: isSunk ? 'line-through' : 'none',
            }}>
              {ship.type}
            </span>
            <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
              {cells.map(([r, c], i) => {
                const isHit = board[r]?.[c] === 'hit' || board[r]?.[c] === 'sunk';
                return (
                  <div key={i} style={{
                    width: 11, height: 11,
                    borderRadius: 2,
                    background: isHit ? '#cc3333' : '#2e6ea6',
                  }} />
                );
              })}
            </div>
            {isSunk && (
              <span style={{
                marginLeft: 6,
                color: '#cc3333',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {t('bs_sunk')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Missile overlay (matches Android MissileOverlay) ─────────────────────────
function MissileOverlay({ targetRow, targetCol, shotCount }: {
  targetRow: number; targetCol: number; shotCount: number;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevShot = useRef(0);

  useEffect(() => {
    if (shotCount <= 0 || shotCount === prevShot.current) return;
    prevShot.current = shotCount;
    setVisible(true);
    setProgress(0);
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min((now - start) / MISSILE_FALL_MS, 1);
      setProgress(t);
      if (t < 1) { raf = requestAnimationFrame(animate); }
      else { setTimeout(() => setVisible(false), 80); }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [shotCount]);

  if (!visible || targetRow < 0 || targetCol < 0) return null;

  const targetX = targetCol * (CELL + GAP) + CELL / 2;
  const targetY = targetRow * (CELL + GAP) + CELL / 2;
  const startY = targetY - CELL * 7;
  const currentY = startY + (targetY - startY) * progress;
  const rocketH = CELL * 0.7;
  const rocketW = CELL * 0.3;
  const plumeLen = CELL * 0.9 * (1 - progress * 0.3);

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 20,
      }}
    >
      <defs>
        <linearGradient id="rocketBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8c0cc" />
          <stop offset="50%" stopColor="#7a8694" />
          <stop offset="100%" stopColor="#4a5460" />
        </linearGradient>
        <linearGradient id="plume" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FFEE88" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#FFAA22" stopOpacity="0.7" />
          <stop offset="70%" stopColor="#FF4400" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF6600" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Flame/plume trail */}
      <ellipse
        cx={targetX} cy={currentY - rocketH}
        rx={rocketW * 0.5} ry={plumeLen / 2}
        fill="url(#plume)"
        opacity={0.85}
      />
      {/* Rocket body */}
      <rect
        x={targetX - rocketW / 2} y={currentY - rocketH}
        width={rocketW} height={rocketH * 0.65}
        rx={rocketW * 0.15} fill="url(#rocketBody)"
        stroke="#1a222c" strokeWidth={0.6}
      />
      {/* Nose cone */}
      <polygon
        points={`${targetX},${currentY} ${targetX - rocketW * 0.45},${currentY - rocketH * 0.25} ${targetX + rocketW * 0.45},${currentY - rocketH * 0.25}`}
        fill="#1a222c"
      />
      {/* Fins */}
      <polygon
        points={`${targetX - rocketW / 2},${currentY - rocketH * 0.9} ${targetX - rocketW},${currentY - rocketH * 0.65} ${targetX - rocketW / 2},${currentY - rocketH * 0.65}`}
        fill="#4a5460" stroke="#1a222c" strokeWidth={0.4}
      />
      <polygon
        points={`${targetX + rocketW / 2},${currentY - rocketH * 0.9} ${targetX + rocketW},${currentY - rocketH * 0.65} ${targetX + rocketW / 2},${currentY - rocketH * 0.65}`}
        fill="#4a5460" stroke="#1a222c" strokeWidth={0.4}
      />
      {/* Nozzle glow */}
      <ellipse
        cx={targetX} cy={currentY - rocketH + 2}
        rx={rocketW * 0.25} ry={2}
        fill="#FF6633" opacity={0.8}
      />
    </svg>
  );
}

// ── Water splash overlay (matches Android WaterSplashOverlay) ────────────────
function WaterSplashOverlay({ targetRow, targetCol, shotCount, outcome }: {
  targetRow: number; targetCol: number; shotCount: number; outcome: string;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevShot = useRef(0);

  useEffect(() => {
    if (shotCount <= 0 || shotCount === prevShot.current || outcome !== 'miss') return;
    prevShot.current = shotCount;
    const delay = Math.max(0, MISSILE_FALL_MS - 30);
    const timer = setTimeout(() => {
      setVisible(true);
      setProgress(0);
      const start = performance.now();
      let raf: number;
      const animate = (now: number) => {
        const t = Math.min((now - start) / 560, 1);
        setProgress(t);
        if (t < 1) { raf = requestAnimationFrame(animate); }
        else { setVisible(false); }
      };
      raf = requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [shotCount, outcome]);

  if (!visible || targetRow < 0 || targetCol < 0) return null;

  const cx = targetCol * (CELL + GAP) + CELL / 2;
  const cy = targetRow * (CELL + GAP) + CELL / 2;
  const ease = 1 - (1 - progress) * (1 - progress);
  const fade = 1 - progress * progress;
  const r = CELL * (0.3 + 0.6 * ease);

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 19,
      }}
    >
      <circle cx={cx} cy={cy} r={r * 0.4} fill={`rgba(255,255,255,${0.8 * fade})`} />
      <circle cx={cx} cy={cy} r={r * 0.7} fill="none"
        stroke={`rgba(160,216,240,${0.5 * fade})`} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={`rgba(160,216,240,${0.3 * fade})`} strokeWidth={1} />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + 0.4;
        const dist = CELL * (0.15 + 0.5 * ease);
        const dx = cx + Math.cos(angle) * dist;
        const dy = cy + Math.sin(angle) * dist * 0.65 - CELL * 0.12 * ease;
        return (
          <circle key={i} cx={dx} cy={dy} r={CELL * 0.04 + CELL * 0.03 * (1 - progress)}
            fill={`rgba(224,244,255,${0.7 * fade})`} />
        );
      })}
    </svg>
  );
}

// ── Explosion overlay (hit/sunk) ─────────────────────────────────────────────
function ExplosionOverlay({ targetRow, targetCol, shotCount, outcome }: {
  targetRow: number; targetCol: number; shotCount: number; outcome: string;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevShot = useRef(0);

  useEffect(() => {
    if (shotCount <= 0 || shotCount === prevShot.current) return;
    if (outcome !== 'hit' && outcome !== 'sunk') return;
    prevShot.current = shotCount;
    const delay = Math.max(0, MISSILE_FALL_MS - 20);
    const timer = setTimeout(() => {
      setVisible(true);
      setProgress(0);
      const start = performance.now();
      let raf: number;
      const animate = (now: number) => {
        const t = Math.min((now - start) / 800, 1);
        setProgress(t);
        if (t < 1) { raf = requestAnimationFrame(animate); }
        else { setTimeout(() => setVisible(false), 300); }
      };
      raf = requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [shotCount, outcome]);

  if (!visible || targetRow < 0 || targetCol < 0) return null;

  const cx = targetCol * (CELL + GAP) + CELL / 2;
  const cy = targetRow * (CELL + GAP) + CELL / 2;
  const ease = 1 - (1 - progress) * (1 - progress);
  const fade = Math.max(0, 1 - progress * 1.2);
  const r = CELL * (0.2 + 1.0 * ease);

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 21,
      }}
    >
      {/* Fireball core */}
      <circle cx={cx} cy={cy} r={r * 0.5}
        fill={`rgba(255,${Math.round(100 + 120 * (1 - progress))},30,${0.9 * fade})`} />
      {/* Mid ring */}
      <circle cx={cx} cy={cy} r={r * 0.75}
        fill={`rgba(255,${Math.round(160 * (1 - progress))},0,${0.5 * fade})`} />
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r}
        fill={`rgba(255,80,0,${0.25 * fade})`} />
      {/* Flash */}
      {progress < 0.15 && (
        <circle cx={cx} cy={cy} r={r * 0.3}
          fill={`rgba(255,255,200,${0.95 * (1 - progress / 0.15)})`} />
      )}
      {/* Smoke particles */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const dist = r * 0.8 * ease;
        const dx = cx + Math.cos(angle) * dist;
        const dy = cy + Math.sin(angle) * dist - CELL * 0.15 * ease;
        return (
          <circle key={i} cx={dx} cy={dy} r={CELL * 0.08 * (1 + ease)}
            fill={`rgba(80,80,80,${0.4 * fade})`} />
        );
      })}
    </svg>
  );
}

// ── Sunk bomb overlay (PWA exclusive — big bomb sweeping across the fleet) ────
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}
function cubicBezierDeriv(t: number, p0: number, p1: number, p2: number, p3: number) {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function SunkBombOverlay({ targetRow, targetCol, shotCount, outcome }: {
  targetRow: number; targetCol: number; shotCount: number; outcome: string;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevShot = useRef(0);

  useEffect(() => {
    if (shotCount <= 0 || shotCount === prevShot.current || outcome !== 'sunk') return;
    prevShot.current = shotCount;
    setVisible(true);
    setProgress(0);
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min((now - start) / SUNK_BOMB_FALL_MS, 1);
      setProgress(t);
      if (t < 1) { raf = requestAnimationFrame(animate); }
      else { setTimeout(() => setVisible(false), 80); }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [shotCount, outcome]);

  if (!visible || targetRow < 0 || targetCol < 0) return null;

  const targetX = targetCol * (CELL + GAP) + CELL / 2;
  const targetY = targetRow * (CELL + GAP) + CELL / 2;

  // Sweep from the opposite side of the grid for a dramatic cross-fleet path
  const enterFromLeft = targetCol > 4;
  const p0x = enterFromLeft ? -CELL * 4 : GRID_PX + CELL * 4;
  const p0y = -CELL * 10;
  const p1x = enterFromLeft ? GRID_PX * 0.35 : GRID_PX * 0.65;
  const p1y = -CELL * 2;
  const p2x = enterFromLeft ? GRID_PX * 0.75 : GRID_PX * 0.25;
  const p2y = targetY * 0.4;
  const p3x = targetX;
  const p3y = targetY;

  const t = progress;
  const cx = cubicBezier(t, p0x, p1x, p2x, p3x);
  const cy = cubicBezier(t, p0y, p1y, p2y, p3y);
  const dx = cubicBezierDeriv(t, p0x, p1x, p2x, p3x);
  const dy = cubicBezierDeriv(t, p0y, p1y, p2y, p3y);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const bombLen = CELL * 1.4;
  const bombW = CELL * 0.65;
  const plumeLen = CELL * 2.2 * (1 - progress * 0.25);
  const plumeW = bombW * 0.55;

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 22,
      }}
    >
      <defs>
        <radialGradient id="bombBody">
          <stop offset="0%" stopColor="#555" />
          <stop offset="60%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#111" />
        </radialGradient>
        <linearGradient id="bombPlume" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FFEE55" stopOpacity="1" />
          <stop offset="30%" stopColor="#FF8800" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FF3300" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#AA2200" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`translate(${cx}, ${cy}) rotate(${angle + 90})`}>
        {/* Flame trail — drawn behind the bomb (positive Y = behind when rotated) */}
        <ellipse cx={0} cy={-bombLen * 0.5 - plumeLen * 0.45} rx={plumeW} ry={plumeLen * 0.5}
          fill="url(#bombPlume)" opacity={0.9} />
        {/* Outer glow */}
        <ellipse cx={0} cy={-bombLen * 0.5 - plumeLen * 0.2} rx={plumeW * 0.7} ry={plumeLen * 0.25}
          fill="rgba(255,200,50,0.4)" />

        {/* Bomb body — fat oval */}
        <ellipse cx={0} cy={0} rx={bombW * 0.5} ry={bombLen * 0.38}
          fill="url(#bombBody)" stroke="#0a0a0a" strokeWidth={1} />
        {/* Nose cone */}
        <ellipse cx={0} cy={bombLen * 0.38} rx={bombW * 0.22} ry={bombLen * 0.14}
          fill="#1a1a1a" />
        {/* Nose tip glow */}
        <circle cx={0} cy={bombLen * 0.48} r={bombW * 0.1}
          fill="#FF4422" opacity={0.7 + 0.3 * Math.sin(progress * 20)} />
        {/* Tail fin left */}
        <polygon
          points={`${-bombW * 0.25},${-bombLen * 0.32} ${-bombW * 0.6},${-bombLen * 0.5} ${-bombW * 0.2},${-bombLen * 0.5}`}
          fill="#333" stroke="#111" strokeWidth={0.5} />
        {/* Tail fin right */}
        <polygon
          points={`${bombW * 0.25},${-bombLen * 0.32} ${bombW * 0.6},${-bombLen * 0.5} ${bombW * 0.2},${-bombLen * 0.5}`}
          fill="#333" stroke="#111" strokeWidth={0.5} />
        {/* Center tail fin */}
        <polygon
          points={`0,${-bombLen * 0.3} ${-bombW * 0.12},${-bombLen * 0.52} ${bombW * 0.12},${-bombLen * 0.52}`}
          fill="#444" stroke="#111" strokeWidth={0.4} />
        {/* Warning band */}
        <rect x={-bombW * 0.48} y={-bombLen * 0.06} width={bombW * 0.96} height={bombLen * 0.08}
          rx={2} fill="#cc3300" opacity={0.8} />
      </g>
    </svg>
  );
}

// ── Sunk explosion overlay (PWA exclusive — massive explosion for sunk ships) ─
function SunkExplosionOverlay({ targetRow, targetCol, shotCount, outcome }: {
  targetRow: number; targetCol: number; shotCount: number; outcome: string;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevShot = useRef(0);

  useEffect(() => {
    if (shotCount <= 0 || shotCount === prevShot.current || outcome !== 'sunk') return;
    prevShot.current = shotCount;
    const delay = SUNK_BOMB_FALL_MS - 30;
    const timer = setTimeout(() => {
      setVisible(true);
      setProgress(0);
      const start = performance.now();
      let raf: number;
      const animate = (now: number) => {
        const p = Math.min((now - start) / 1400, 1);
        setProgress(p);
        if (p < 1) { raf = requestAnimationFrame(animate); }
        else { setTimeout(() => setVisible(false), 200); }
      };
      raf = requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [shotCount, outcome]);

  if (!visible || targetRow < 0 || targetCol < 0) return null;

  const cx = targetCol * (CELL + GAP) + CELL / 2;
  const cy = targetRow * (CELL + GAP) + CELL / 2;
  const ease = 1 - (1 - progress) * (1 - progress);
  const fade = Math.max(0, 1 - progress * 1.1);
  const maxR = CELL * 2.8;
  const r = maxR * ease;

  const shockR = CELL * 4 * ease;
  const shockFade = Math.max(0, 1 - progress * 1.5);

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none', zIndex: 23,
      }}
    >
      {/* Shockwave ring */}
      <circle cx={cx} cy={cy} r={shockR} fill="none"
        stroke={`rgba(255,200,100,${0.35 * shockFade})`} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={shockR * 0.7} fill="none"
        stroke={`rgba(255,150,50,${0.25 * shockFade})`} strokeWidth={1.5} />

      {/* White flash (first 15%) */}
      {progress < 0.15 && (
        <circle cx={cx} cy={cy} r={maxR * 0.8}
          fill={`rgba(255,255,220,${0.95 * (1 - progress / 0.15)})`} />
      )}

      {/* Outer fire ring */}
      <circle cx={cx} cy={cy} r={r}
        fill={`rgba(255,60,0,${0.2 * fade})`} />
      {/* Mid fire ring */}
      <circle cx={cx} cy={cy} r={r * 0.7}
        fill={`rgba(255,${Math.round(120 * (1 - progress))},0,${0.45 * fade})`} />
      {/* Inner fireball */}
      <circle cx={cx} cy={cy} r={r * 0.45}
        fill={`rgba(255,${Math.round(180 + 60 * (1 - progress))},${Math.round(40 * (1 - progress))},${0.85 * fade})`} />
      {/* Bright core */}
      <circle cx={cx} cy={cy} r={r * 0.2}
        fill={`rgba(255,255,180,${0.7 * fade})`} />

      {/* Debris particles — 12 flying outward */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.3;
        const dist = maxR * 1.3 * ease * (0.6 + 0.4 * ((i % 3) / 2));
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist - CELL * 0.3 * ease;
        const size = CELL * (0.06 + 0.06 * ((i % 4) / 3)) * (1.2 - ease * 0.5);
        return (
          <circle key={i} cx={px} cy={py} r={size}
            fill={i % 3 === 0
              ? `rgba(255,${100 + i * 10},0,${0.7 * fade})`
              : `rgba(100,100,100,${0.5 * fade})`
            } />
        );
      })}

      {/* Smoke plume rising from center */}
      {Array.from({ length: 5 }).map((_, i) => {
        const smokeY = cy - CELL * (0.5 + 1.5 * ease) * (1 + i * 0.3);
        const smokeR = CELL * (0.2 + 0.3 * ease) * (1 + i * 0.15);
        const smokeFade = Math.max(0, fade - i * 0.12);
        return (
          <circle key={`s${i}`} cx={cx + (i % 2 ? 3 : -3)} cy={smokeY} r={smokeR}
            fill={`rgba(60,60,60,${0.35 * smokeFade})`} />
        );
      })}
    </svg>
  );
}

// ── Battle grid body (cells + overlays) — place inside a shared OceanPanel in battle ──
function BattleGridBody({
  board, ships, showShips, sunkEnemyShips, clickable, isSpectator, boardSide, onFire,
}: {
  board: string[][];
  ships: PlacedShip[];
  showShips: boolean;
  sunkEnemyShips?: PlacedShip[];
  clickable: boolean;
  isSpectator: boolean;
  boardSide: 'player' | 'opponent';
  onFire: (r: number, c: number) => void;
}) {
  const store = useBattleshipStore();
  const anim = store.animatingShot;
  const showMissile = anim && anim.board === boardSide;
  return (
    <div style={{ padding: 8 }}>
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(10, ${CELL}px)`,
          gap: GAP,
          width: GRID_PX,
          height: GRID_PX,
          cursor: clickable && !isSpectator ? 'crosshair' : 'default',
          overflow: 'visible',
        }}
      >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isAnim = anim?.row === r && anim?.col === c && anim?.board === boardSide;
              const isHitOrSunk = cell === 'hit' || cell === 'sunk';
              const fireDelay = ((r * 10 + c) % 5) * 120;
              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => clickable && !isSpectator && onFire(r, c)}
                  style={{
                    position: 'relative',
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
                    overflow: 'visible',
                  }}
                >
                  {isHitOrSunk && <FireEmoji delay={fireDelay} />}
                  {cell === 'miss' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />}
                </div>
              );
            })
          )}
          {showShips && <ShipOverlay ships={ships} />}
          {sunkEnemyShips && sunkEnemyShips.length > 0 && <ShipOverlay ships={sunkEnemyShips} />}

          {/* Missile + impact overlays */}
          {showMissile && (store.lastShot?.result === 'sunk' ? (
            <>
              <SunkBombOverlay
                targetRow={anim.row}
                targetCol={anim.col}
                shotCount={store.shotCount}
                outcome="sunk"
              />
              <SunkExplosionOverlay
                targetRow={anim.row}
                targetCol={anim.col}
                shotCount={store.shotCount}
                outcome="sunk"
              />
            </>
          ) : (
            <>
              <MissileOverlay
                targetRow={anim.row}
                targetCol={anim.col}
                shotCount={store.shotCount}
              />
              <ExplosionOverlay
                targetRow={anim.row}
                targetCol={anim.col}
                shotCount={store.shotCount}
                outcome={store.lastShot?.result || ''}
              />
              <WaterSplashOverlay
                targetRow={anim.row}
                targetCol={anim.col}
                shotCount={store.shotCount}
                outcome={store.lastShot?.result || ''}
              />
            </>
          ))}
      </div>
    </div>
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
  /** Side-by-side boards on wide viewports; stacked on narrow — same ocean panel. */
  const [battleSeaDualColumn, setBattleSeaDualColumn] = useState(true);
  const placementGridRef = useRef<HTMLDivElement>(null);
  const catalogDragRef = useRef<{ shipType: string; sx: number; sy: number } | null>(null);
  const [catalogDragGhost, setCatalogDragGhost] = useState<{
    shipType: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)');
    const apply = () => setBattleSeaDualColumn(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const myUsername = user?.username ?? '';
    store.initGame(roomId, myUsername, hasOpponent, opponentName, isSpectator);
    return () => { store.cleanup(); };
  }, [roomId]);

  useEffect(() => {
    return registerPlayBackConsumer(() => {
      const st = useBattleshipStore.getState();
      if (st.opponentLeftDialog) {
        st.clearOpponentLeftDialog();
        return true;
      }
      return false;
    });
  }, []);

  const prevShotCount = useRef(0);
  useEffect(() => {
    if (store.shotCount > 0 && store.shotCount !== prevShotCount.current) {
      const result = store.lastShot?.result;
      if (result === 'sunk') {
        const timer = setTimeout(() => GameSound.bigExplosion(), SUNK_BOMB_FALL_MS - 50);
        prevShotCount.current = store.shotCount;
        return () => clearTimeout(timer);
      } else if (result === 'hit') {
        GameSound.explosion();
      } else if (result === 'miss') {
        GameSound.splash();
      }
    }
    prevShotCount.current = store.shotCount;
  }, [store.shotCount, store.lastShot]);

  // ── Placement phase ─────────────────────────────────────────────────────────
  const handlePlacementCellTap = useCallback((row: number, col: number) => {
    if (isSpectator || store.phase !== 'placement') return;
    const st = useBattleshipStore.getState();
    if (!st.selectedShipType) return;
    if (st.placedShips.some((p) => p.type === st.selectedShipType)) {
      st.moveShipTo(st.selectedShipType, row, col);
    } else {
      st.placeShipAt(row, col);
    }
  }, [isSpectator, store.phase, store.selectedShipType, store.placedShips]);

  const finishCatalogPointerDrag = useCallback((e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const d = catalogDragRef.current;
    catalogDragRef.current = null;
    setCatalogDragGhost(null);
    if (!d) return;
    const drop = pointerClientToPlacementCell(
      e.clientX,
      e.clientY,
      placementGridRef.current,
    );
    if (drop) {
      const st = useBattleshipStore.getState();
      if (st.placedShips.some((p) => p.type === d.shipType)) return;
      st.selectShipType(d.shipType);
      st.placeShipAt(drop.row, drop.col);
    }
  }, []);

  const handlePlacementDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const el = placementGridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / (CELL + GAP));
    const row = Math.floor((e.clientY - rect.top) / (CELL + GAP));
    if (row < 0 || row >= 10 || col < 0 || col >= 10) return;

    let payload: { kind: 'place' | 'move'; shipType: string } | null = null;
    const raw = e.dataTransfer.getData(BS_DND_MIME);
    try {
      const o = raw ? (JSON.parse(raw) as { kind?: string; shipType?: string }) : null;
      if (o?.shipType && (o.kind === 'place' || o.kind === 'move')) {
        payload = { kind: o.kind, shipType: o.shipType };
      }
    } catch {
      /* ignore */
    }
    if (!payload?.shipType) return;

    const st = useBattleshipStore.getState();
    if (payload.kind === 'move') {
      st.moveShipTo(payload.shipType, row, col);
    } else {
      if (st.placedShips.some((p) => p.type === payload.shipType)) return;
      st.selectShipType(payload.shipType);
      st.placeShipAt(row, col);
    }
  };

  const renderPlacement = () => (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <p style={{ color: 'rgba(201,168,76,0.75)', fontSize: 12, margin: 0, textAlign: 'center' }}>
          {t('bs_placement_hint') || t('recharge_important_information')}
        </p>

        {store.selectedShipType &&
          !store.placedShips.some((p) => p.type === store.selectedShipType) && (
          <button
            type="button"
            onClick={() => store.toggleOrientation()}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid rgba(201,168,76,0.45)',
              background: 'rgba(201,168,76,0.12)',
              color: '#e8c96b',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ↻ {t('bs_rotate_ship')} ({store.selectedHorizontal ? '→' : '↓'})
          </button>
        )}

        {/* Opponent joined status banner */}
        {!store.opponentConfirmed ? (
          <div style={{
            background: 'rgba(255,160,0,0.12)',
            border: '1px solid rgba(255,160,0,0.35)',
            borderRadius: 8, padding: '8px 16px',
            color: '#ffb74d', fontSize: 12, textAlign: 'center',
          }}>
            ⏳ {t('status_waiting_opponent')}
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

        {/* Ready / reset — above grid so the send action stays visible */}
        {store.opponentConfirmed && (
          <div style={{ width: GRID_PX + 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          </div>
        )}

        {/* Placement grid with ocean background */}
        <OceanPanel width={GRID_PX + 16} height={GRID_PX + 16}>
          <div style={{ padding: 8 }}>
            <div
              ref={placementGridRef}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handlePlacementDrop}
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(10, ${CELL}px)`,
                gap: GAP,
                width: GRID_PX,
                height: GRID_PX,
                overflow: 'hidden',
                touchAction: 'none',
              }}
            >
              {store.playerBoard.map((row, r) =>
                row.map((_cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    role="button"
                    tabIndex={-1}
                    onClick={() => handlePlacementCellTap(r, c)}
                    style={{
                      width: CELL, height: CELL,
                      background: 'rgba(8,26,50,0.55)',
                      borderRadius: 3,
                      border: '1px solid rgba(201,168,76,0.14)',
                      boxSizing: 'border-box',
                      cursor: store.selectedShipType ? 'pointer' : 'default',
                    }}
                  />
                ))
              )}
              <ShipOverlay
                ships={store.placedShips}
                interactive
                placementGridRef={placementGridRef}
                onPlacedShipClick={(type) => store.togglePlacedShipOrientation(type)}
                onPlacedShipMove={(type, row, col) => store.moveShipTo(type, row, col)}
              />
            </div>
          </div>
        </OceanPanel>

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
                  cursor: 'default',
                  boxShadow: isSelected ? '0 0 14px rgba(201,168,76,0.18)' : 'none',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {/* Drag only the sprite — not the full row */}
                <img
                  src={shipImageSrc(s.type)}
                  alt={s.type}
                  draggable={!placed}
                  onDragStart={(e) => {
                    if (placed) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData(
                      BS_DND_MIME,
                      JSON.stringify({ kind: 'place', shipType: s.type }),
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onPointerDown={(e) => {
                    if (placed || e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    store.selectShipType(s.type);
                    catalogDragRef.current = { shipType: s.type, sx: e.clientX, sy: e.clientY };
                    setCatalogDragGhost({ shipType: s.type, x: e.clientX, y: e.clientY });
                    (e.currentTarget as HTMLImageElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!catalogDragRef.current || catalogDragRef.current.shipType !== s.type) return;
                    setCatalogDragGhost({ shipType: s.type, x: e.clientX, y: e.clientY });
                  }}
                  onPointerUp={finishCatalogPointerDrag}
                  onPointerCancel={() => {
                    catalogDragRef.current = null;
                    setCatalogDragGhost(null);
                  }}
                  style={{
                    width: s.size * 18 + 4,
                    height: 22,
                    objectFit: 'fill',
                    borderRadius: 3,
                    flexShrink: 0,
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                    maxWidth: 'none',
                    cursor: placed ? 'default' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                />
                <span style={{ color: '#e8eaf0', fontSize: 13, flex: 1 }}>
                  {s.type} <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>({s.size})</span>
                </span>
                {placed ? (
                  <>
                    <span style={{ color: '#4caf50', fontSize: 14 }}>✓</span>
                    <button
                      type="button"
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

        {catalogDragGhost && (
          <img
            src={shipImageSrc(catalogDragGhost.shipType)}
            alt=""
            draggable={false}
            style={{
              position: 'fixed',
              left: catalogDragGhost.x,
              top: catalogDragGhost.y,
              transform: 'translate(-50%, -50%)',
              width: (SHIP_CATALOG.find((s) => s.type === catalogDragGhost.shipType)?.size ?? 3) * 18 + 4,
              height: 22,
              objectFit: 'fill',
              pointerEvents: 'none',
              zIndex: 100000,
              opacity: 0.85,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
            }}
          />
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
  const renderBattle = () => {
    const BATTLE_GAP = 16;
    const seaPad = 12;
    const labelBand = 26;
    const seaW = battleSeaDualColumn
      ? BATTLE_BOARD_FRAME * 2 + BATTLE_GAP + seaPad * 2
      : BATTLE_BOARD_FRAME + seaPad * 2 + 8;
    const seaH = battleSeaDualColumn
      ? labelBand + BATTLE_BOARD_FRAME + seaPad * 2 + 4
      : 2 * (labelBand + BATTLE_BOARD_FRAME) + BATTLE_GAP + seaPad * 2;

    return (
    <IonContent style={{ '--background': '#060e1e' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        {/* Sticky: turn + timer stay visible while scrolling boards */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            alignSelf: 'stretch',
            width: '100%',
            background: '#060e1e',
            padding: '8px 8px 10px',
            boxSizing: 'border-box',
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            borderBottom: '1px solid rgba(201,168,76,0.12)',
          }}
        >
          {isSpectator && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <SpectatorBadge count={store.spectatorsCount} />
            </div>
          )}
          <TurnTimer
            seconds={store.turnTimerSeconds}
            isMyTurn={store.isMyTurn}
            onTimeout={() => {}}
            turnPlayerName={isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
            otherPlayerName={store.opponentName || opponentName}
            resetKey={store.shotCount}
          />
        </div>

        <div
          style={{
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            width: '100%',
          }}
        >
        <div style={{
          width: '100%',
          maxWidth: seaW,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}>
          <OceanPanel width={seaW} height={seaH}>
            <div style={{
              display: 'flex',
              flexDirection: battleSeaDualColumn ? 'row' : 'column',
              alignItems: 'stretch',
              justifyContent: 'center',
              gap: BATTLE_GAP,
              padding: seaPad,
              boxSizing: 'border-box',
            }}
            >
              <section style={{
                minWidth: 0,
                flex: battleSeaDualColumn ? '1 1 0' : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%',
                  maxWidth: BATTLE_BOARD_FRAME,
                  marginBottom: 5, paddingLeft: 2,
                  flexWrap: 'wrap', gap: 4,
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
                <BattleGridBody
                  board={store.opponentBoard}
                  ships={[]}
                  showShips={false}
                  sunkEnemyShips={store.sunkEnemyShips}
                  clickable={store.isMyTurn && !isSpectator}
                  isSpectator={isSpectator}
                  boardSide="opponent"
                  onFire={(r, c) => store.fire(roomId, r, c)}
                />
              </section>
              <section style={{
                minWidth: 0,
                flex: battleSeaDualColumn ? '1 1 0' : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%',
                  maxWidth: BATTLE_BOARD_FRAME,
                  marginBottom: 5, paddingLeft: 2,
                  flexWrap: 'wrap', gap: 4,
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
                <BattleGridBody
                  board={store.playerBoard}
                  ships={store.placedShips}
                  showShips={true}
                  clickable={false}
                  isSpectator={isSpectator}
                  boardSide="player"
                  onFire={() => {}}
                />
              </section>
            </div>
          </OceanPanel>
        </div>

        {/* Fleet status detail */}
        {store.placedShips.length > 0 && (
          <FleetStatusPanel
            label={isSpectator
              ? `⚓ ${store.spectatorFleetOwnerName || store.spectatorBoardOwner || t('bs_your_fleet')}`
              : t('bs_fleet_status')}
            ships={store.placedShips}
            board={store.playerBoard}
          />
        )}

        </div>
      </div>
    </IonContent>
    );
  };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 30,
                  padding: '0 6px',
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  borderRadius: '8px',
                }}
              >
                <ConnectionStrengthIndicator />
              </div>
              <IonText style={{ color: '#c9a84c', fontSize: 14 }}>${betAmount}</IonText>
            </div>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {store.phase === 'placement'
        ? renderPlacement()
        : store.phase === 'waiting' && !store.gameOver
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
                {t('bs_ready_confirm_bet_info').replace('%s', `$${formatUSD(betAmount)}`)}
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
