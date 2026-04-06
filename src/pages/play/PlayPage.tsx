import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IonAlert, IonLoading } from '@ionic/react';
import { apiRepository } from '../../data/network/ApiRepository';
import { useBattleshipStore } from '../../store/battleshipStore';
import { useChessStore } from '../../store/chessStore';
import { useDominoStore } from '../../store/dominoStore';
import { useHalmaStore } from '../../store/halmaStore';
import type { RoomStatusResponse } from '../../data/models/ApiModels';
import BattleshipPage from './battleship/BattleshipPage';
import ChessPage from './chess/ChessPage';
import DominoPage from './domino/DominoPage';
import HalmaPage from './halma/HalmaPage';

// ── Leave-context snapshot (called at the moment the user requests to leave) ──
function getLeaveContext(gameSocketCode: string): {
  gameIsOver: boolean;
  isPastPlacement: boolean;
} {
  switch (gameSocketCode) {
    case 'chess': {
      const s = useChessStore.getState();
      return { gameIsOver: !!s.gameOver, isPastPlacement: true };
    }
    case 'domino': {
      const s = useDominoStore.getState();
      return { gameIsOver: !!s.gameOver, isPastPlacement: true };
    }
    case 'halma': {
      const s = useHalmaStore.getState();
      return { gameIsOver: !!s.gameOver, isPastPlacement: true };
    }
    default: { // battleship (and any unknown code)
      const s = useBattleshipStore.getState();
      return {
        gameIsOver: s.phase === 'finished' || !!s.gameOver,
        isPastPlacement: s.phase === 'waiting' || s.phase === 'battle',
      };
    }
  }
}

export default function PlayPage() {
  const {
    gameSocketCode = '',
    roomId         = '',
    betAmount      = '0',
    roomName       = '',
    opponentName   = '',
    hasOpponent: hasOpponentParam = 'false',
    isSpectator: isSpectatorParam = 'false',
  } = useParams<{
    gameSocketCode: string;
    roomId: string;
    betAmount: string;
    roomName: string;
    opponentName: string;
    hasOpponent: string;
    isSpectator: string;
  }>();

  const navigate    = useNavigate();
  const isSpectator = isSpectatorParam === 'true';
  const hasOpponent = hasOpponentParam  === 'true';
  const bet         = parseFloat(betAmount);
  const opponent    = decodeURIComponent(opponentName);
  const room        = decodeURIComponent(roomName);

  // ── Leave state ─────────────────────────────────────────────────────────────
  const [checkingLeave,    setCheckingLeave]    = useState(false);
  const [showForfeit,      setShowForfeit]      = useState(false);
  const [showFinished,     setShowFinished]     = useState(false);
  const [finishedStatus,   setFinishedStatus]   = useState<RoomStatusResponse | null>(null);

  // ── Best-effort leave API + navigate back ───────────────────────────────────
  const doLeave = async () => {
    try { await apiRepository.leaveRoom(roomId); } catch { /* best-effort */ }
    navigate(-1);
  };

  // ── Android-equivalent leave validation ─────────────────────────────────────
  // Android flow:
  //   1. phase == GAME_OVER               → leave immediately, no warning
  //   2. !spectator && opponent && active → check server status first
  //      a. Server reports finished        → show outcome dialog (won/lost)
  //      b. Server reports active          → show forfeit warning
  //   3. spectator || placement || alone  → leave immediately, no warning
  const handleLeaveRequest = async () => {
    const { gameIsOver, isPastPlacement } = getLeaveContext(gameSocketCode);

    // Rule 1: game already over locally → leave with no warning
    if (gameIsOver) {
      await doLeave();
      return;
    }

    // Rule 2: real game in progress with an opponent
    const shouldWarn = !isSpectator && hasOpponent && isPastPlacement;
    if (shouldWarn) {
      setCheckingLeave(true);
      try {
        const status = await apiRepository.getRoomStatus(roomId);
        const serverFinished =
          !!status.winner ||
          ['finished', 'completed', 'game_over'].includes(status.status ?? '');

        setCheckingLeave(false);
        if (serverFinished) {
          // Game already ended on server — show result, no forfeit penalty
          setFinishedStatus(status);
          setShowFinished(true);
        } else {
          // Game still active — warn about forfeit
          setShowForfeit(true);
        }
      } catch {
        setCheckingLeave(false);
        // If status check fails, show forfeit warning as safe default
        setShowForfeit(true);
      }
      return;
    }

    // Rule 3: spectator / placement phase / no opponent → leave directly
    await doLeave();
  };

  // ── Determine won/lost for the finished dialog ──────────────────────────────
  const iWon = finishedStatus?.winner
    ? finishedStatus.winner !== opponent   // winner is me (not the opponent)
    : null;                                // null = draw / unknown

  const finishedHeader =
    iWon === true  ? '🏆 You Won!'  :
    iWon === false ? '💀 You Lost'  :
    'Game Over';

  const finishedMessage =
    finishedStatus?.winnerReason
      ? finishedStatus.winnerReason
      : iWon === true
        ? `${opponent} has forfeited.`
        : 'The game has already ended.';

  // ── Shared game page props ──────────────────────────────────────────────────
  const gameProps = {
    roomId,
    betAmount: bet,
    roomName: room,
    opponentName: opponent,
    hasOpponent,
    isSpectator,
    onLeaveRequest: handleLeaveRequest,
  };

  return (
    <>
      {gameSocketCode === 'chess'  && <ChessPage  {...gameProps} />}
      {gameSocketCode === 'halma'  && <HalmaPage  {...gameProps} />}
      {gameSocketCode === 'domino' && <DominoPage {...gameProps} />}
      {!['chess', 'halma', 'domino'].includes(gameSocketCode) && <BattleshipPage {...gameProps} />}

      {/* Checking server status */}
      <IonLoading isOpen={checkingLeave} message="Checking game status…" />

      {/* Forfeit warning — game active, opponent present */}
      <IonAlert
        isOpen={showForfeit}
        header="Leave Game?"
        message={`If you leave now you will forfeit the match and lose $${bet.toFixed(2)}.`}
        buttons={[
          {
            text: 'Stay',
            role: 'cancel',
            handler: () => setShowForfeit(false),
          },
          {
            text: 'Leave',
            role: 'destructive',
            cssClass: 'alert-button-danger',
            handler: () => { setShowForfeit(false); doLeave(); },
          },
        ]}
        onDidDismiss={() => setShowForfeit(false)}
      />

      {/* Game already finished on server — no forfeit, just show result */}
      <IonAlert
        isOpen={showFinished}
        header={finishedHeader}
        message={finishedMessage}
        buttons={[
          {
            text: 'OK',
            handler: () => { setShowFinished(false); doLeave(); },
          },
        ]}
        onDidDismiss={() => { setShowFinished(false); doLeave(); }}
      />
    </>
  );
}
