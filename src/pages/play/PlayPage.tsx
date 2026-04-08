import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IonAlert, IonLoading, IonModal, IonText } from '@ionic/react';
import { useT } from '../../i18n/translations';
import { SovereignPrimaryButton, SovereignDangerButton } from '../../ui/components/SovereignButton';
import { apiRepository } from '../../data/network/ApiRepository';
import { useBattleshipStore } from '../../store/battleshipStore';
import { useChessStore } from '../../store/chessStore';
import { useDominoStore } from '../../store/dominoStore';
import { useHalmaStore, HalmaPhase } from '../../store/halmaStore';
import type { RoomStatusResponse } from '../../data/models/ApiModels';
import BattleshipPage from './battleship/BattleshipPage';
import ChessPage from './chess/ChessPage';
import DominoPage from './domino/DominoPage';
import HalmaPage from './halma/HalmaPage';
import { getPlayContext, clearPlayContext } from '../../util/routingStorage';

// ── Leave-context snapshot (called at the moment the user requests to leave) ──
function getLeaveContext(gameSocketCode: string): {
  gameIsOver: boolean;
  isPastPlacement: boolean;
  opponentConfirmed: boolean;
} {
  switch (gameSocketCode) {
    case 'chess': {
      const s = useChessStore.getState();
      return { gameIsOver: !!s.gameOver, isPastPlacement: true, opponentConfirmed: true };
    }
    case 'domino': {
      const s = useDominoStore.getState();
      return { gameIsOver: !!s.gameOver, isPastPlacement: true, opponentConfirmed: true };
    }
    case 'halma': {
      const s = useHalmaStore.getState();
      return { 
        gameIsOver: s.phase === HalmaPhase.GAME_OVER, 
        isPastPlacement: true, 
        opponentConfirmed: s.opponentConfirmed 
      };
    }
    default: { // battleship (and any unknown code)
      const s = useBattleshipStore.getState();
      return {
        gameIsOver: s.phase === 'finished' || !!s.gameOver,
        isPastPlacement: s.phase === 'waiting' || s.phase === 'battle',
        opponentConfirmed: s.opponentConfirmed
      };
    }
  }
}

export default function PlayPage() {
  const { gameSocketCode = '' } = useParams<{ gameSocketCode: string }>();
  const navigate    = useNavigate();
  const t           = useT();

  const playCtx = getPlayContext();

  useEffect(() => {
    if (!playCtx || !gameSocketCode) {
      console.warn('[PlayPage] Missing play context, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [playCtx, gameSocketCode, navigate]);

  // ── Protection / Fallback ──────────────────────────────────────────────────
  if (!playCtx || !gameSocketCode) {
    return null;
  }

  const {
    roomId,
    betAmount: bet,
    roomName: room,
    opponentName: opponent,
    hasOpponent,
    isSpectator,
    isPlayer1,
  } = playCtx;

  // ── Leave state ─────────────────────────────────────────────────────────────
  const [checkingLeave,    setCheckingLeave]    = useState(false);
  const [showForfeit,      setShowForfeit]      = useState(false);
  const [showFinished,     setShowFinished]     = useState(false);
  const [finishedStatus,   setFinishedStatus]   = useState<RoomStatusResponse | null>(null);

  // ── Best-effort leave API + navigate back ───────────────────────────────────
  const doLeave = async (silent = false) => {
    try {
      const status = await apiRepository.leaveRoom(roomId);
      const serverFinished = !!status.winner || ['finished', 'completed', 'game_over'].includes(status.status?.toLowerCase() ?? '');

      if (serverFinished && !isSpectator && !silent) {
        // If the game ended because we left (or just now), show the result alert
        setFinishedStatus(status);
        setShowFinished(true);
        return;
      }
    } catch (e) {
      console.error('[PlayPage] Error during leaveRoom:', e);
    }
    clearPlayContext();
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
    const { gameIsOver, isPastPlacement, opponentConfirmed: liveOpponentConfirmed } = getLeaveContext(gameSocketCode);

    // Rule 1: game already over locally → leave with no warning, and no redundant alert
    if (gameIsOver) {
      await doLeave(true);
      return;
    }

    // Rule 2: real game in progress with an opponent (Android HalmaScreen.kt:124)
    const shouldWarn = !isSpectator && liveOpponentConfirmed && isPastPlacement;
    if (shouldWarn) {
      setCheckingLeave(true);
      try {
        const status = await apiRepository.getRoomStatus(roomId);
        const serverFinished =
          !!status.winner ||
          ['finished', 'completed', 'game_over'].includes(status.status?.toLowerCase() ?? '');

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
    isPlayer1,
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
      <IonModal
        isOpen={showForfeit}
        onDidDismiss={() => setShowForfeit(false)}
        style={{ 
          '--height': 'fit-content', 
          '--width': '90%', 
          '--max-width': '340px', 
          '--border-radius': '16px',
          '--background': 'var(--sovereign-surface)',
          padding: '16px'
        }}
      >
        <div style={{ padding: '24px', background: 'var(--sovereign-surface)', textAlign: 'center' }}>
          <IonText>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--sovereign-gold)' }}>
              {t('bs_leave_confirm_title')}
            </h2>
          </IonText>
          <IonText>
            <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '15px', lineHeight: '1.4', margin: '0 0 24px 0' }}>
              {t('bs_leave_confirm_message').replace('%s', `$${bet.toFixed(2)}`)}
            </p>
          </IonText>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SovereignPrimaryButton onClick={() => setShowForfeit(false)}>
              {t('bs_leave_confirm_stay')}
            </SovereignPrimaryButton>
            <SovereignDangerButton onClick={() => { setShowForfeit(false); doLeave(); }}>
              {t('bs_leave_confirm_leave')}
            </SovereignDangerButton>
          </div>
        </div>
      </IonModal>

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
