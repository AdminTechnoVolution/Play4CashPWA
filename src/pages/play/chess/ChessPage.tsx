import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonActionSheet,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useChessStore } from '../../../store/chessStore';
import type { ChessPiece, GreetingResponse, ChatMessage } from '../../../data/models/ApiModels';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import { apiRepository } from '../../../data/network/ApiRepository';
import GameOverModal from '../components/GameOverModal';
import TurnTimer from '../components/TurnTimer';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import { useT } from '../../../i18n/translations';
import { applyWsMessagePlaceholders } from '../../../i18n/ApiMessageDisplay';

const PIECE_SYMBOL: Record<string, string> = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
};

const LIGHT_SQ = '#f0d9b5';
const DARK_SQ  = '#b58863';

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
  const chatRef = useRef(new ChatSocketManager());
  const [greetings, setGreetings] = useState<GreetingResponse[]>([]);
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);
  const [showPromotion, setShowPromotion] = useState(false);

  const myColor = store.myColor;
  const isMyTurn = store.currentPlayer === myColor;

  useEffect(() => {
    const username = user?.username ?? '';
    store.initGame(roomId, myColor, username);
    const chat = chatRef.current;
    chat.connect(roomId);
    chat.onMessage(setLastMsg);
    apiRepository.getGreetings().then(setGreetings).catch(() => {});
    return () => { store.cleanup(); chat.disconnect(); };
  }, [roomId]);

  useEffect(() => {
    if (store.promotionPending) setShowPromotion(true);
  }, [store.promotionPending]);

  // Flip board display for black player
  const displayRows = myColor === 'black' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const displayCols = myColor === 'black' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const getCellBg = (row: number, col: number) => {
    const isSelected = store.selectedCell?.row === row && store.selectedCell?.col === col;
    const isValidMove = store.validMoves.some((m) => m.row === row && m.col === col);
    const isLight = (row + col) % 2 === 0;
    const base = isLight ? LIGHT_SQ : DARK_SQ;
    if (isSelected) return '#c9a84c';
    if (isValidMove) return isLight ? '#cdd16f' : '#aaa23a';
    if (store.isCheck) {
      const king = store.board[row][col];
      if ((myColor === 'white' && king === 'wK') || (myColor === 'black' && king === 'bK')) return '#e05050';
    }
    return base;
  };

  const cellSize = Math.min(Math.floor((window.innerWidth - 32) / 8), 52);

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
        <div style={{ padding: '8px 16px' }}>
          {isSpectator && <SpectatorBadge />}

          {/* Castling hint */}
          {(store.canCastleKingside || store.canCastleQueenside) && isMyTurn && (
            <div style={{ padding: '6px 12px', marginBottom: 8, background: 'rgba(201,168,76,0.1)', borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)' }}>
              <IonText style={{ color: '#c9a84c', fontSize: 12 }}>
                {t('chess_castling_banner_title')}:{' '}
                {[
                  store.canCastleKingside && t('chess_castling_kingside'),
                  store.canCastleQueenside && t('chess_castling_queenside'),
                ].filter(Boolean).join(' / ')}
              </IonText>
            </div>
          )}

          {/* Turn indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <IonText style={{ color: isMyTurn && !isSpectator ? '#c9a84c' : '#8a9bbf', fontSize: 13 }}>
              {isSpectator
                ? applyWsMessagePlaceholders(t('spectator_chess_turn_x'), { username: store.currentPlayer })
                : isMyTurn
                  ? `▶ ${t('ws.games.yourTurn')}`
                  : `${opponentName}'s ${t('chess_opponent_turn')}`}
            </IonText>
          </div>

          <TurnTimer seconds={30} isMyTurn={isMyTurn} onTimeout={() => {}} />

          {/* Board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(8, ${cellSize}px)`,
            gridTemplateRows: `repeat(8, ${cellSize}px)`,
            border: '2px solid #8b6914',
            borderRadius: 4,
            overflow: 'hidden',
            margin: '0 auto',
            width: 8 * cellSize,
          }}>
            {displayRows.map((row) =>
              displayCols.map((col) => {
                const piece = store.board[row]?.[col] as ChessPiece;
                const isValidMove = store.validMoves.some((m) => m.row === row && m.col === col);
                return (
                  <div
                    key={`${row}-${col}`}
                    onClick={() => !isSpectator && store.selectCell(row, col, roomId)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: getCellBg(row, col),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: !isSpectator ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    {isValidMove && !piece && (
                      <div style={{ width: cellSize * 0.3, height: cellSize * 0.3, borderRadius: '50%', background: 'rgba(0,0,0,0.25)' }} />
                    )}
                    {piece && (
                      <span style={{
                        fontSize: cellSize * 0.72,
                        lineHeight: 1,
                        color: piece.startsWith('w') ? '#fff' : '#1a1a1a',
                        textShadow: piece.startsWith('w') ? '0 1px 2px rgba(0,0,0,0.6)' : '0 1px 2px rgba(255,255,255,0.4)',
                        userSelect: 'none',
                      }}>
                        {PIECE_SYMBOL[piece] ?? piece[1]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <ChatGreetingChips greetings={greetings} onSend={(id) => chatRef.current.sendGreeting(roomId, id)} lastReceivedMessage={lastMsg} />
        </div>
      </IonContent>

      {/* Promotion picker */}
      <IonActionSheet
        isOpen={showPromotion}
        header={t('chess_promotion_title')}
        buttons={[
          { text: `♕ ${t('chess_promotion_queen')}`, handler: () => { store.setPromotion(roomId, 'q'); setShowPromotion(false); } },
          { text: `♖ ${t('chess_promotion_rook')}`, handler: () => { store.setPromotion(roomId, 'r'); setShowPromotion(false); } },
          { text: `♗ ${t('chess_promotion_bishop')}`, handler: () => { store.setPromotion(roomId, 'b'); setShowPromotion(false); } },
          { text: `♘ ${t('chess_promotion_knight')}`, handler: () => { store.setPromotion(roomId, 'n'); setShowPromotion(false); } },
        ]}
        onDidDismiss={() => setShowPromotion(false)}
      />

      <GameOverModal isOpen={!!store.gameOver} gameOver={store.gameOver} isSpectator={isSpectator} onExit={onLeaveRequest} gameProfile="CHESS" />
    </IonPage>
  );
}
