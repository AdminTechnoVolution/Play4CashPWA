import { useEffect, useRef, useState, useMemo } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonActionSheet,
  useIonToast, IonSpinner, IonCard, IonCardContent, IonAlert,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useChessStore, ChessPieceType, ChessPhase } from '../../../store/chessStore';
import type { ChatMessage } from '../../../data/models/ApiModels';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import FloatingIncomingMessages from '../components/FloatingIncomingMessages';
import SpectatorBadge from '../components/SpectatorBadge';
import { formatIncomingFloatingGreeting } from '../../../util/ChatGreetingModels';
import { formatApiMessageForDisplay } from '../../../i18n/ApiMessageDisplay';
import { useT } from '../../../i18n/translations';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import ConnectionStrengthIndicator from '../../../ui/components/ConnectionStrengthIndicator';
import GameSound from '../../../ui/game/GameSound';
import { registerPlayBackConsumer } from '../../../util/playBackNavigation';
import { ChessPieceSvg } from './ChessPieces';

// Inject CSS keyframes for selected piece glow (Android SelectedPieceGlow — alpha pulse 0.35↔0.85)
let chessGlowInjected = false;
function ensureChessGlowStyle() {
  if (chessGlowInjected) return;
  chessGlowInjected = true;
  const s = document.createElement('style');
  s.textContent = `@keyframes chessSelGlow{0%,100%{opacity:.35}50%{opacity:.85}}.chess-sel-glow{animation:chessSelGlow 1.3s ease-in-out infinite}`;
  document.head.appendChild(s);
}

// Android-matching dark teal palette (ChessScreen.kt lines 108–111)
const LIGHT_SQ = 'rgba(45,74,94,0.50)';
const DARK_SQ  = 'rgba(30,58,78,0.50)';
const CELL_GAP = 2;
const CELL_RADIUS = 4;
const BOARD_BG = '#152A3F';
const COLOR_SELECTED = 'rgba(233,195,73,0.50)';
const COLOR_LAST_MOVE = 'rgba(129,200,132,0.50)';
const COLOR_CHECK = 'rgba(229,57,53,0.60)';
const COLOR_VALID_MOVE_DOT = 'rgba(129,200,132,0.92)';
const COLOR_VALID_CAPTURE_RING = '#66BB6A';
const COLOR_VALID_CAPTURE_BG = 'rgba(76,175,80,0.35)';

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  /** Android navigateToPlayHasOpponent — creator already had opponent in room */
  hasOpponent: boolean;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function ChessPage({ roomId, betAmount, roomName, opponentName, hasOpponent, isSpectator, onLeaveRequest }: Props) {
  ensureChessGlowStyle();
  const { user } = useAuthStore();
  const store = useChessStore();
  const t = useT();
  const [present] = useIonToast();
  const chatRef = useRef(new ChatSocketManager());
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    (window as any).currentRoomId = roomId;
    // Android ChessViewModel init: hasOpponent, initialOpponentName, isSpectatorJoin
    store.initGame(roomId, user?.username || '', betAmount, hasOpponent, opponentName, isSpectator);

    const chat = chatRef.current;
    chat.onChatEnvelope = (json) => store.handleChatEnvelope(json);
    chat.onMessage(setLastMsg);
    chat.connect(roomId);
    (window as any).chessChatSocket = chat;

    return () => {
      store.cleanup();
      chat?.disconnect();
      (window as any).chessChatSocket = null;
    };
  }, [roomId]);

  /** Android: LaunchedEffect(phase PLAY) { viewModel.loadGreetings() } */
  useEffect(() => {
    if (store.phase === ChessPhase.PLAY && !isSpectator) {
      store.loadGreetings();
    }
  }, [store.phase, isSpectator]);

  useEffect(() => {
    if (store.navigateBack) onLeaveRequest();
  }, [store.navigateBack]);

  useEffect(() => {
    return registerPlayBackConsumer(() => {
      const st = useChessStore.getState();
      if (st.promotionPending) {
        st.dismissPromotion();
        return true;
      }
      if (st.opponentLeftMessage) {
        st.clearOpponentLeft();
        return true;
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (store.illegalMoveToast) {
      present({
        message: formatApiMessageForDisplay(store.illegalMoveToast, ''),
        duration: 2000,
        position: 'bottom',
        color: 'danger',
        onDidDismiss: () => store.clearIllegalMoveToast(),
      });
    }
  }, [store.illegalMoveToast]);

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

  // Sound: piece move (matches Android LaunchedEffect(state.lastMove))
  const lastMoveRef = useRef(store.lastMove);
  useEffect(() => {
    if (store.lastMove && store.lastMove !== lastMoveRef.current) {
      GameSound.pieceMove();
    }
    lastMoveRef.current = store.lastMove;
  }, [store.lastMove]);

  // Orientation logic exactly like Android
  const playingWhite = store.isPlayerWhite;
  const displayRows = playingWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const displayCols = playingWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const getCellBg = (row: number, col: number) => {
    const piece = store.board[row]?.[col]?.piece;
    const isSelected = store.selectedRow === row && store.selectedCol === col;
    const isValidDest = store.validMoves.some((m) => m.toRow === row && m.toCol === col);
    const isCaptureTarget = isValidDest && piece != null;
    const isLastMove = (store.lastMove && (
      (store.lastMove.fromRow === row && store.lastMove.fromCol === col) ||
      (store.lastMove.toRow === row && store.lastMove.toCol === col)
    )) || (store.optimisticRookSlide && (
      (store.optimisticRookSlide.fromRow === row && store.optimisticRookSlide.fromCol === col) ||
      (store.optimisticRookSlide.toRow === row && store.optimisticRookSlide.toCol === col)
    ));
    const isCheckCell = store.isCheck && piece?.type === ChessPieceType.KING &&
      (
        store.isPlayerTurn
          ? ((piece.isWhite && playingWhite) || (!piece.isWhite && !playingWhite))
          : ((piece.isWhite && !playingWhite) || (!piece.isWhite && playingWhite))
      );

    if (isCheckCell) return COLOR_CHECK;
    if (isSelected) return COLOR_SELECTED;
    if (isCaptureTarget) return COLOR_VALID_CAPTURE_BG;
    if (isLastMove) return COLOR_LAST_MOVE;
    return (row + col) % 2 === 0 ? LIGHT_SQ : DARK_SQ;
  };

  // 8 cells + 7 gaps + 16px board padding + outer padding
  const cellSize = Math.min(Math.floor((window.innerWidth - 32 - 16 - 7 * CELL_GAP) / 8), 42);

  const incomingGreetingMessage = useMemo(
    () => formatIncomingFloatingGreeting(store.chatGreetingOverlay, lastMsg),
    [store.chatGreetingOverlay, lastMsg],
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
              <IonText style={{ color: '#c9a84c', fontSize: 14 }}>${betAmount}</IonText>
            </div>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        <FloatingIncomingMessages
          message={incomingGreetingMessage}
          active={store.phase === ChessPhase.PLAY && !isSpectator}
        />
        {store.phase === ChessPhase.WAITING && !store.gameOver && (
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
        )}

        {store.phase !== ChessPhase.WAITING && (
          <div style={{ padding: '8px 16px' }}>
            {isSpectator && (
              <div style={{ marginBottom: 12 }}>
                <SpectatorBadge />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <IonText style={{ color: '#fff', fontSize: 12 }}>⚪ {store.spectatorWhiteLabel}</IonText>
                  <IonText style={{ color: '#fff', fontSize: 12 }}>⚫ {store.spectatorBlackLabel}</IonText>
                </div>
              </div>
            )}

            {(store.castlingAvailable.kingSide || store.castlingAvailable.queenSide) &&
              store.phase === ChessPhase.PLAY &&
              store.isPlayerTurn &&
              !store.isMovePending &&
              store.promotionPending == null &&
              !store.castlingBannerDismissed &&
              !store.castlingSuppressedForTurn && (
              <div style={{
                padding: '10px 14px',
                marginBottom: 12,
                background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))',
                borderRadius: 10,
                border: '1px solid rgba(201,168,76,0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div>
                  <IonText style={{ color: '#c9a84c', fontWeight: '700', fontSize: '13px', display: 'block' }}>
                    {t('chess_castling_banner_title')}
                  </IonText>
                  <IonText style={{ color: '#8a9bbf', fontSize: '11px' }}>
                    {t('chess_castling_suggest_desc')}
                  </IonText>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {store.castlingAvailable.kingSide && (
                    <IonButton size="small" fill="outline" style={{ '--color': '#c9a84c', '--border-color': '#c9a84c', fontSize: '11px', height: '28px' }} onClick={() => store.playCastling(roomId, true)}>
                      O-O
                    </IonButton>
                  )}
                  {store.castlingAvailable.queenSide && (
                    <IonButton size="small" fill="outline" style={{ '--color': '#c9a84c', '--border-color': '#c9a84c', fontSize: '11px', height: '28px' }} onClick={() => store.playCastling(roomId, false)}>
                      O-O-O
                    </IonButton>
                  )}
                  <IonButton size="small" fill="clear" style={{ '--color': '#8a9bbf', fontSize: '11px' }} onClick={() => store.dismissCastlingSuggestion()}>
                    ✕
                  </IonButton>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <IonText style={{ color: store.isPlayerTurn ? '#c9a84c' : '#8a9bbf', fontSize: 13, fontWeight: '600' }}>
                {store.statusMessage || (store.isPlayerTurn ? t('chess_your_turn') : t('chess_opponent_turn'))}
              </IonText>
            </div>

            <TurnTimer 
              seconds={store.turnTimeLeft} 
              totalSeconds={store.turnTimerTotal || 60} 
              isMyTurn={store.isPlayerTurn} 
              onTimeout={() => {}} 
              turnPlayerName={store.isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
              otherPlayerName={store.opponentName || opponentName}
              disableLocalTick
              timeoutAlarm={false}
            />

            {/* Board frame — matches Android ChessBoard outer Box */}
            <div style={{
              background: BOARD_BG,
              border: '2px solid rgba(233,195,73,0.30)',
              borderRadius: 12,
              padding: 8,
              margin: '12px auto',
              width: 8 * cellSize + 7 * CELL_GAP + 16,
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(8, ${cellSize}px)`,
                gridTemplateRows: `repeat(8, ${cellSize}px)`,
                gap: CELL_GAP,
              }}>
                {displayRows.map((row) =>
                  displayCols.map((col) => {
                    const cell = store.board[row]?.[col] || { piece: null };
                    const piece = cell.piece;
                    const isSelected = store.selectedRow === row && store.selectedCol === col;
                    const isValidDest = store.validMoves.some((m) => m.toRow === row && m.toCol === col);
                    const isCaptureTarget = isValidDest && piece != null;

                    return (
                      <div
                        key={`${row}-${col}`}
                        onClick={() => store.onCellTap(row, col, roomId)}
                        style={{
                          width: cellSize, height: cellSize,
                          background: getCellBg(row, col),
                          borderRadius: CELL_RADIUS,
                          border: '1px solid rgba(233,195,73,0.20)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: !isSpectator ? 'pointer' : 'default',
                          position: 'relative',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Valid move dot (empty square) — Android 9dp circle */}
                        {isValidDest && !piece && (
                          <div style={{
                            width: 9, height: 9,
                            borderRadius: '50%',
                            background: COLOR_VALID_MOVE_DOT,
                            zIndex: 2,
                          }} />
                        )}
                        {/* Capture ring — Android 2.5dp stroke circle */}
                        {isCaptureTarget && (
                          <div style={{
                            position: 'absolute',
                            width: cellSize - 5, height: cellSize - 5,
                            borderRadius: '50%',
                            border: `2.5px solid ${COLOR_VALID_CAPTURE_RING}`,
                            pointerEvents: 'none',
                            zIndex: 1,
                          }} />
                        )}
                        {/* Selected piece glow — Android SelectedPieceGlow */}
                        {isSelected && piece && (
                          <div className="chess-sel-glow" style={{
                            position: 'absolute',
                            width: cellSize - 4, height: cellSize - 4,
                            borderRadius: '50%',
                            background: 'rgba(233,195,73,0.55)',
                            pointerEvents: 'none',
                            zIndex: 1,
                          }} />
                        )}
                        {piece && (
                          <div style={{ position: 'relative', zIndex: 3, userSelect: 'none', pointerEvents: 'none' }}>
                            <ChessPieceSvg
                              type={piece.type}
                              isWhite={piece.isWhite}
                              size={cellSize - 2}
                              isSelected={isSelected}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {!isSpectator && (
              <ChatGreetingChips 
                greetings={store.greetings} 
                onSend={(id) => store.sendGreeting(roomId, id)} 
                lastReceivedMessage={lastMsg}
                showIncomingBanner={false}
              />
            )}
          </div>
        )}
      </IonContent>

      <IonActionSheet
        isOpen={!!store.promotionPending}
        header={t('chess_promotion_title')}
        backdropDismiss={false}
        buttons={[
          { text: `♕ ${t('chess_promotion_queen')}`, handler: () => store.onPromotionSelected(roomId, 'q') },
          { text: `♖ ${t('chess_promotion_rook')}`, handler: () => store.onPromotionSelected(roomId, 'r') },
          { text: `♗ ${t('chess_promotion_bishop')}`, handler: () => store.onPromotionSelected(roomId, 'b') },
          { text: `♘ ${t('chess_promotion_knight')}`, handler: () => store.onPromotionSelected(roomId, 'n') },
          { text: t('cancel'), role: 'cancel', handler: () => store.dismissPromotion() }
        ]}
        onDidDismiss={() => store.dismissPromotion()}
      />


      <GameOverModal 
        isOpen={store.phase === ChessPhase.GAME_OVER} 
        gameOver={store.gameOver} 
        isSpectator={isSpectator} 
        onExit={onLeaveRequest} 
        gameProfile="CHESS" 
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
    </IonPage>
  );
}
