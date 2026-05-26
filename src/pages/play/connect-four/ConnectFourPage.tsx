import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonText,
  useIonToast,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonAlert,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useConnectFourStore, ConnectFourPhase } from '../../../store/connectFourStore';
import type { ChatMessage } from '../../../data/models/ApiModels';
import type { ConnectFourDisc, ConnectFourMove } from '../../../data/models/connectFourModels';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import FloatingIncomingMessages from '../components/FloatingIncomingMessages';
import SpectatorBadge from '../components/SpectatorBadge';
import { formatIncomingFloatingGreeting } from '../../../util/ChatGreetingModels';
import { formatApiMessageForDisplay, tStatus } from '../../../i18n/ApiMessageDisplay';
import { useT } from '../../../i18n/translations';
import GameSound from '../../../ui/game/GameSound';
import { findDropRow } from './connectFourDropAnim';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import ConnectionStrengthIndicator from '../../../ui/components/ConnectionStrengthIndicator';
import { registerPlayBackConsumer } from '../../../util/playBackNavigation';
import './connect-four.css';

type DropAnim = {
  col: number;
  toRow: number;
  color: ConnectFourDisc;
  key: number;
};

function playDropFeedback(): void {
  GameSound.discDrop();
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(40);
    }
  } catch {
    /* gesture policy */
  }
}

function moveSignature(m: ConnectFourMove | null | undefined): string {
  if (!m) return '';
  return `${m.at}|${m.row}|${m.col}|${m.color}`;
}

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  hasOpponent: boolean;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function ConnectFourPage({
  roomId,
  betAmount,
  roomName,
  opponentName,
  hasOpponent,
  isSpectator,
  onLeaveRequest,
}: Props) {
  const { user } = useAuthStore();
  const store = useConnectFourStore();
  const t = useT();
  const [present] = useIonToast();
  const chatRef = useRef(new ChatSocketManager());
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);
  const [dropAnim, setDropAnim] = useState<DropAnim | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const prevLastMoveSig = useRef('');
  const dropAnimKeyRef = useRef(0);

  const clearDropAnim = useCallback((key: number) => {
    setDropAnim((cur) => (cur?.key === key ? null : cur));
  }, []);

  const startDropAnim = useCallback((col: number, toRow: number, color: ConnectFourDisc) => {
    const key = ++dropAnimKeyRef.current;
    setDropAnim({ col, toRow, color, key });
    return key;
  }, []);

  useEffect(() => {
    (window as any).currentRoomId = roomId;
    store.initGame(
      roomId,
      user?.username || '',
      user?.id || '',
      betAmount,
      hasOpponent,
      opponentName,
      isSpectator,
    );

    const chat = chatRef.current;
    chat.onChatEnvelope = (json) => store.handleChatEnvelope(json);
    chat.onMessage((msg) => setLastMsg(msg));
    chat.connect(roomId);
    (window as any).connectFourChatSocket = chat;

    return () => {
      store.cleanup();
      chat.disconnect();
      (window as any).connectFourChatSocket = null;
    };
  }, [roomId]);

  useEffect(() => {
    if (store.phase === ConnectFourPhase.PLAY && !isSpectator) {
      store.loadGreetings();
    }
  }, [store.phase, isSpectator]);

  useEffect(() => {
    if (store.navigateBack) onLeaveRequest();
  }, [store.navigateBack]);

  useEffect(() => {
    return registerPlayBackConsumer(() => {
      if (useConnectFourStore.getState().opponentLeftMessage) {
        useConnectFourStore.getState().clearOpponentLeft();
        return true;
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (store.chatErrorToast) {
      present({
        message: store.chatErrorToast,
        duration: 2500,
        position: 'bottom',
        color: 'warning',
        onDidDismiss: () => store.clearChatErrorToast(),
      });
    }
  }, [store.chatErrorToast]);

  useEffect(() => {
    if (store.matchCancelledMessage) {
      present({ message: store.matchCancelledMessage, duration: 2500, position: 'bottom' });
      store.clearMatchCancelledToast();
    }
  }, [store.matchCancelledMessage]);

  useEffect(() => {
    if (store.illegalMoveToast) {
      setDropAnim(null);
      present({
        message: formatApiMessageForDisplay(store.illegalMoveToast, ''),
        duration: 2200,
        position: 'bottom',
        color: 'danger',
        onDidDismiss: () => store.clearIllegalMoveToast(),
      });
    }
  }, [store.illegalMoveToast]);

  const statusText = tStatus(store.statusMessage);

  const resolvedOpponentFromNames = (() => {
    const me = user?.username?.trim();
    const p1 = store.player1Name.trim();
    const p2 = store.player2Name.trim();
    if (p1 && p2 && me) {
      if (p1 === me) return p2;
      if (p2 === me) return p1;
    }
    return '';
  })();

  const opponentLabel =
    (!store.isPlayerTurn && store.turnHolder.trim()) ||
    store.opponentName.trim() ||
    resolvedOpponentFromNames ||
    opponentName.trim() ||
    t('connect_four_opponent');

  const canDrop =
    !isSpectator &&
    store.phase === ConnectFourPhase.PLAY &&
    store.isPlayerTurn &&
    !store.isMovePending;

  /** Animate opponent drops when `lastMove` updates from the server (own moves animate on tap). */
  useEffect(() => {
    const m = store.lastMove;
    const sig = moveSignature(m);
    if (!m || !sig || sig === prevLastMoveSig.current) return;
    prevLastMoveSig.current = sig;

    const isOpponent = !!m.userId && m.userId !== user?.id;
    if (!isOpponent) return;

    const animKey = startDropAnim(m.col, m.row, m.color);
    playDropFeedback();
    window.setTimeout(() => clearDropAnim(animKey), 480);
  }, [store.lastMove, user?.id, startDropAnim, clearDropAnim]);

  const handleColumnClick = useCallback(
    (col: number) => {
      if (!canDrop || !store.yourColor) return;
      const toRow = findDropRow(store.board, col);
      if (toRow < 0) return;

      playDropFeedback();
      const animKey = startDropAnim(col, toRow, store.yourColor);
      window.setTimeout(() => clearDropAnim(animKey), 480);

      store.dropInColumn(roomId, col);
    },
    [canDrop, store.yourColor, store.board, roomId, startDropAnim, clearDropAnim, store],
  );

  const winKey = (r: number, c: number) =>
    store.winningCells.some((w) => w.row === r && w.col === c);

  const lastR = store.lastMove?.row;
  const lastC = store.lastMove?.col;

  const colorLabel =
    store.yourColor === 'R'
      ? t('connect_four_playing_red')
      : store.yourColor === 'Y'
        ? t('connect_four_playing_yellow')
        : '';

  const incomingGreetingMessage = useMemo(
    () => formatIncomingFloatingGreeting(store.chatGreetingOverlay, lastMsg),
    [store.chatGreetingOverlay, lastMsg],
  );

  return (
    <IonPage className="cf-page" style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest} aria-label={t('chess_cd_back')}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>
            {roomName || t('connect_four_title')}
          </IonTitle>
          <IonButtons slot="end">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 28,
                  padding: '0 6px',
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid var(--sovereign-border)',
                  borderRadius: '8px',
                }}
              >
                <ConnectionStrengthIndicator />
              </div>
              <IonText style={{ color: '#c9a84c', fontSize: 14, fontWeight: 800 }}>${betAmount}</IonText>
            </div>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        <FloatingIncomingMessages
          message={incomingGreetingMessage}
          active={store.phase === ConnectFourPhase.PLAY && !isSpectator}
        />
        {store.phase === ConnectFourPhase.WAITING && !store.gameOver && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            }}
          >
            <IonCard
              style={{
                width: '85%',
                maxWidth: '340px',
                '--background': '#1a2940',
                borderRadius: '24px',
                textAlign: 'center',
                border: '2px solid rgba(255,255,255,0.1)',
              }}
            >
              <IonCardContent style={{ padding: '32px 24px' }}>
                <IonText
                  style={{
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: '800',
                    display: 'block',
                    marginBottom: '16px',
                    letterSpacing: '2px',
                  }}
                >
                  {t('bs_waiting_title').toUpperCase()}
                </IonText>
                <IonSpinner
                  name="crescent"
                  style={{ color: '#c9a84c', marginBottom: '24px', width: '48px', height: '48px' }}
                />
                <IonText
                  style={{
                    color: '#8a9bbf',
                    fontSize: '15px',
                    display: 'block',
                    marginBottom: '32px',
                    lineHeight: '1.4',
                  }}
                >
                  {statusText}
                </IonText>
                <IonButton
                  expand="block"
                  onClick={onLeaveRequest}
                  style={{
                    '--background': 'transparent',
                    '--color': '#8a9bbf',
                    '--border-radius': '12px',
                    border: '1px solid rgba(138,155,191,0.3)',
                    fontWeight: 'bold',
                  }}
                >
                  {t('bs_leave_room')}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        <div style={{ opacity: store.phase === ConnectFourPhase.WAITING ? 0.3 : 1 }}>
        {isSpectator && store.phase !== ConnectFourPhase.WAITING && (
          <div style={{ padding: '8px 16px 0' }}>
            <SpectatorBadge isSpectator count={store.spectatorsCount} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <IonText style={{ color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="cf-color-dot" style={{ background: 'var(--cf-disc-r)', width: 10, height: 10 }} />
                {store.spectatorRedLabel || store.player1Name}
              </IonText>
              <IonText style={{ color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="cf-color-dot" style={{ background: 'var(--cf-disc-y)', width: 10, height: 10 }} />
                {store.spectatorYellowLabel || store.player2Name}
              </IonText>
            </div>
          </div>
        )}

        <div style={{ padding: '8px 16px', textAlign: 'center' }}>
          {store.yourColor && !isSpectator && (
            <div className="cf-color-badge" style={{ justifyContent: 'center', marginBottom: 6 }}>
              <span
                className="cf-color-dot"
                style={{
                  background: store.yourColor === 'R' ? 'var(--cf-disc-r)' : 'var(--cf-disc-y)',
                }}
              />
              <span>{colorLabel}</span>
            </div>
          )}
          <IonText color="medium">
            <p style={{ margin: 0, fontSize: 14 }}>{statusText}</p>
          </IonText>
          {store.phase === ConnectFourPhase.PLAY && (
            <TurnTimer
              seconds={store.turnTimeLeft}
              totalSeconds={store.turnTimerTotal}
              isMyTurn={store.isPlayerTurn && !isSpectator}
              onTimeout={() => {}}
              turnPlayerName={isSpectator ? (store.spectatorCurrentPlayer || store.turnHolder || undefined) : undefined}
              otherPlayerName={opponentLabel}
              disableLocalTick
              timeoutAlarm={false}
            />
          )}
        </div>

        {(store.phase === ConnectFourPhase.PLAY || store.phase === ConnectFourPhase.GAME_OVER) && (
          <div className="cf-board-wrap">
            <div
              className="cf-board-frame"
              style={{
                background: 'var(--cf-board-bg)',
                border: '2px solid rgba(233,195,73,0.30)',
                borderRadius: 12,
                padding: 8,
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
            <div className="cf-board" role="grid" aria-label={t('connect_four_title')}>
              {store.board.map((row, rowIdx) =>
                row.map((cell, colIdx) => {
                  const isWin = winKey(rowIdx, colIdx);
                  const isLast = lastR === rowIdx && lastC === colIdx;
                  const colClickable = canDrop;
                  const isAnimCell =
                    dropAnim != null && dropAnim.col === colIdx && dropAnim.toRow === rowIdx;
                  const showGhostDuringDrop = isAnimCell && dropAnim;
                  const dropRowsAbove = showGhostDuringDrop ? dropAnim.toRow : 0;
                  const staticDisc = cell && !showGhostDuringDrop;

                  return (
                    <button
                      key={`${rowIdx}-${colIdx}`}
                      type="button"
                      className={[
                        'cf-cell',
                        colClickable ? 'cf-col-btn' : '',
                        isWin ? 'cf-cell--win' : '',
                        hoverCol === colIdx && colClickable ? 'cf-cell--col-hover' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={!colClickable}
                      aria-label={`${t('connect_four_column')} ${colIdx + 1}`}
                      onMouseEnter={() => colClickable && setHoverCol(colIdx)}
                      onMouseLeave={() => setHoverCol((c) => (c === colIdx ? null : c))}
                      onClick={() => colClickable && handleColumnClick(colIdx)}
                    >
                      {staticDisc && (
                        <span
                          className={`cf-disc cf-disc--${cell.toLowerCase()} ${isLast ? 'cf-last-drop' : ''}`}
                        />
                      )}
                      {showGhostDuringDrop && (
                        <span
                          className={`cf-disc cf-disc--dropping cf-disc--${dropAnim.color.toLowerCase()}`}
                          style={{
                            ['--cf-drop-from' as string]: `calc(-${dropRowsAbove} * (var(--cf-cell-size) + var(--cf-gap)))`,
                          }}
                          onAnimationEnd={() => clearDropAnim(dropAnim.key)}
                        />
                      )}
                    </button>
                  );
                }),
              )}
            </div>
            </div>
          </div>
        )}

        {store.phase === ConnectFourPhase.PLAY && !isSpectator && (
          <ChatGreetingChips
            greetings={store.greetings}
            onSend={(id) => store.sendGreeting(roomId, id)}
            lastReceivedMessage={lastMsg}
            showIncomingBanner={false}
          />
        )}
        </div>

        <GameOverModal
          isOpen={store.phase === ConnectFourPhase.GAME_OVER}
          gameOver={store.gameOver}
          isSpectator={isSpectator}
          gameProfile="CONNECT_FOUR"
          onExit={onLeaveRequest}
        />

        <GenericErrorModal
          isOpen={store.apiErrorRawMessage != null}
          message={formatApiMessageForDisplay(store.apiErrorRawMessage, 'error_try_later_message')}
          onDismiss={() => store.clearGenericError()}
        />

        <IonAlert
          isOpen={!!store.opponentLeftMessage}
          header={t('bs_opponent_left_title')}
          message={store.opponentLeftMessage ?? ''}
          buttons={[{ text: t('ok'), handler: () => store.clearOpponentLeft() }]}
          onDidDismiss={() => store.clearOpponentLeft()}
        />
      </IonContent>
    </IonPage>
  );
}
