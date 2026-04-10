import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonActionSheet,
  useIonToast, IonModal, IonSpinner,
} from '@ionic/react';
import { arrowBackOutline, closeOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useChessStore, ChessPieceType, ChessPhase } from '../../../store/chessStore';
import type { GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import { 
  applyWsMessagePlaceholders, 
  formatApiMessageForDisplay 
} from '../../../i18n/ApiMessageDisplay';
import { useT } from '../../../i18n/translations';

const PIECE_SYMBOL: Record<string, string> = {
  [`${ChessPieceType.KING}_true`]: '♔', [`${ChessPieceType.QUEEN}_true`]: '♕', [`${ChessPieceType.ROOK}_true`]: '♖',
  [`${ChessPieceType.BISHOP}_true`]: '♗', [`${ChessPieceType.KNIGHT}_true`]: '♘', [`${ChessPieceType.PAWN}_true`]: '♙',
  [`${ChessPieceType.KING}_false`]: '♚', [`${ChessPieceType.QUEEN}_false`]: '♛', [`${ChessPieceType.ROOK}_false`]: '♜',
  [`${ChessPieceType.BISHOP}_false`]: '♝', [`${ChessPieceType.KNIGHT}_false`]: '♞', [`${ChessPieceType.PAWN}_false`]: '♟',
};

const LIGHT_SQ = '#f0d9b5';
const DARK_SQ = '#b58863';

interface Props {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  isSpectator: boolean;
  onLeaveRequest: () => void;
}

export default function ChessPage({ roomId, betAmount, roomName, opponentName, isSpectator, onLeaveRequest }: Props) {
  const { user } = useAuthStore();
  const store = useChessStore();
  const t = useT();
  const [present] = useIonToast();
  const chatRef = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    (window as any).currentRoomId = roomId;
    store.initGame(roomId, user?.username || '', betAmount, !!opponentName, opponentName, isSpectator);

    const chat = chatRef.current;
    if (chat) {
      chat.connect(roomId);
      chat.onMessage(setLastMsg);
    }
    apiRepository.getGreetings().then(setGreetings).catch(() => {});

    return () => {
      store.cleanup();
      chat?.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (store.navigateBack) onLeaveRequest();
  }, [store.navigateBack]);

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



  const handleLeaveRequest = () => {
    const s = store;
    const shouldWarnOnLeave = !s.isSpectator && s.opponentConfirmed && 
      (s.phase === ChessPhase.WAITING || s.phase === ChessPhase.PLAY);

    if (s.phase === ChessPhase.GAME_OVER) {
      onLeaveRequest();
    } else if (shouldWarnOnLeave) {
      setShowLeaveConfirm(true);
    } else {
      s.leaveRoom(roomId);
    }
  };

  // Orientation logic exactly like Android
  const playingWhite = store.isPlayerWhite;
  const displayRows = playingWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const displayCols = playingWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const getCellBg = (row: number, col: number) => {
    const isSelected = store.selectedRow === row && store.selectedCol === col;
    const isValidMove = store.validMoves.some((m) => m.toRow === row && m.toCol === col);
    const isLight = (row + col) % 2 === 0;
    const base = isLight ? LIGHT_SQ : DARK_SQ;
    if (isSelected) return '#c9a84c';
    if (isValidMove) return isLight ? '#cdd16f' : '#aaa23a';
    if (store.isCheck) {
      const piece = store.board[row][col].piece;
      if (piece?.type === ChessPieceType.KING && piece.isWhite === playingWhite) return '#e05050';
    }
    return base;
  };

  const cellSize = Math.min(Math.floor((window.innerWidth - 32) / 8), 52);

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={handleLeaveRequest}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>{roomName}</IonTitle>
          <IonButtons slot="end">
            <IonText style={{ color: '#c9a84c', fontSize: 14, paddingRight: 12 }}>${betAmount}</IonText>
          </IonButtons>
        </IonToolbar>
        
        {store.chatGreetingOverlay && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            background: 'rgba(201,168,76,0.95)',
            color: '#000',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'slideDown 0.3s ease-out'
          }}>
            {store.chatGreetingOverlay.type === 'FromOpponent' 
              ? `${store.chatGreetingOverlay.from}: ${store.chatGreetingOverlay.text}`
              : `${t('you')}: ${store.chatGreetingOverlay.text}`}
          </div>
        )}
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        {store.phase === ChessPhase.WAITING && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px',
            animation: 'fadeIn 0.3s ease-out'
          }}>
             <div style={{
               background: 'rgba(20, 32, 53, 0.85)',
               border: '1px solid rgba(201,168,76,0.3)',
               borderRadius: '16px',
               padding: '32px 28px',
               display: 'flex',
               flexDirection: 'column',
               alignItems: 'center',
               gap: '16px',
               boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
               width: '100%',
               maxWidth: '300px'
             }}>
               <IonText style={{ color: '#fff', fontSize: '20px', fontWeight: '800', letterSpacing: '2px' }}>
                 {t('bs_waiting_title')}
               </IonText>
               <IonSpinner name="crescent" style={{ color: '#c9a84c', width: '40px', height: '40px' }} />
               <IonText style={{ color: '#8a9bbf', fontSize: '14px', textAlign: 'center' }}>
                 {store.statusMessage || t('chess_status_waiting_opponent')}
               </IonText>
             </div>
             <IonButton 
               fill="outline" 
               style={{ marginTop: '24px', '--color': '#8a9bbf', '--border-color': 'rgba(138,155,191,0.4)' }}
               onClick={handleLeaveRequest}
             >
               {t('bs_leave_room')}
             </IonButton>
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

            {(store.castlingAvailable.kingSide || store.castlingAvailable.queenSide) && store.isPlayerTurn && !store.isMovePending && !store.castlingBannerDismissed && !store.castlingSuppressedForTurn && (
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
              {store.isCheck && <IonText style={{ color: '#e05050', fontSize: 12, fontWeight: '800' }}>CHECK!</IonText>}
            </div>

            <TurnTimer 
              seconds={store.turnTimeLeft} 
              totalSeconds={store.turnTimerTotal || 60} 
              isMyTurn={store.isPlayerTurn} 
              onTimeout={() => {}} 
              turnPlayerName={store.isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(8, ${cellSize}px)`,
              gridTemplateRows: `repeat(8, ${cellSize}px)`,
              border: '3px solid #8b6914',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              margin: '12px auto',
              width: 8 * cellSize,
            }}>
              {displayRows.map((row) =>
                displayCols.map((col) => {
                  const cell = store.board[row]?.[col] || { piece: null };
                  const piece = cell.piece;
                  const isValidMove = store.validMoves.some((m) => m.toRow === row && m.toCol === col);
                  const isLastMove = (store.lastMove && (
                    (store.lastMove.fromRow === row && store.lastMove.fromCol === col) ||
                    (store.lastMove.toRow === row && store.lastMove.toCol === col)
                  )) || (store.optimisticRookSlide && (
                    (store.optimisticRookSlide.fromRow === row && store.optimisticRookSlide.fromCol === col) ||
                    (store.optimisticRookSlide.toRow === row && store.optimisticRookSlide.toCol === col)
                  ));

                  return (
                    <div
                      key={`${row}-${col}`}
                      onClick={() => store.onCellTap(row, col, roomId)}
                      style={{
                        width: cellSize, height: cellSize,
                        background: getCellBg(row, col),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: !isSpectator ? 'pointer' : 'default',
                        position: 'relative',
                      }}
                    >
                      {isLastMove && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(201,168,76,0.3)', pointerEvents: 'none' }} />
                      )}
                      {isValidMove && !piece && (
                        <div style={{ width: cellSize * 0.25, height: cellSize * 0.25, borderRadius: '50%', background: 'rgba(0,0,0,0.2)' }} />
                      )}
                      {piece && (
                        <span style={{
                          fontSize: cellSize * 0.75,
                          lineHeight: 1,
                          color: piece.isWhite ? '#fff' : '#1a1a1a',
                          textShadow: piece.isWhite ? '0 1px 2px rgba(0,0,0,0.6)' : '0 1px 2px rgba(255,255,255,0.4)',
                          userSelect: 'none',
                          zIndex: 2,
                          transition: 'transform 0.1s ease-out',
                          transform: (store.selectedRow === row && store.selectedCol === col) ? 'scale(1.15)' : 'scale(1)'
                        }}>
                          {PIECE_SYMBOL[`${piece.type}_${piece.isWhite}`]}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!isSpectator && (
              <ChatGreetingChips 
                greetings={greetings} 
                onSend={(id) => store.sendGreeting(roomId, id)} 
                lastReceivedMessage={lastMsg} 
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

      <IonModal isOpen={showLeaveConfirm} onDidDismiss={() => setShowLeaveConfirm(false)} className="forfeit-modal">
        <div style={{ padding: '24px', background: '#0a1628', color: '#fff', borderRadius: '16px', border: '1px solid rgba(255,107,53,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <IonText style={{ color: '#FF6B35', fontSize: '20px', fontWeight: '800' }}>
              {t('bs_leave_confirm_title')}
            </IonText>
            <IonButton fill="clear" onClick={() => setShowLeaveConfirm(false)}>
              <IonIcon icon={closeOutline} style={{ color: '#8a9bbf' }} />
            </IonButton>
          </div>
          <IonText style={{ fontSize: '14px', color: '#8a9bbf', display: 'block', marginBottom: '24px', textAlign: 'center' }}>
            {applyWsMessagePlaceholders(t('bs_leave_confirm_message'), { betAmount: betAmount > 0 ? `$${betAmount}` : t('chess_leave_confirm_bet_fallback') })}
          </IonText>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <IonButton expand="block" style={{ '--background': '#fff', '--color': '#000', fontWeight: '700' }} onClick={() => setShowLeaveConfirm(false)}>
              {t('bs_leave_confirm_stay')}
            </IonButton>
            <IonButton expand="block" color="danger" fill="outline" style={{ fontWeight: '700', '--border-color': '#FF6B35', '--color': '#FF6B35' }} onClick={() => {
              setShowLeaveConfirm(false);
              store.leaveRoom(roomId);
            }}>
              {store.isLeaving ? <IonSpinner name="crescent" /> : t('bs_leave_confirm_leave')}
            </IonButton>
          </div>
        </div>
      </IonModal>

      <GameOverModal 
        isOpen={store.phase === ChessPhase.GAME_OVER} 
        gameOver={store.gameOver} 
        isSpectator={isSpectator} 
        onExit={onLeaveRequest} 
        gameProfile="CHESS" 
      />
    </IonPage>
  );
}
