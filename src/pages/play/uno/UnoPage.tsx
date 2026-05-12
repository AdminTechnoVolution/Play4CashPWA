import { useEffect, useMemo } from 'react';
import { IonAlert, IonContent, IonPage, IonToast } from '@ionic/react';
import { useT } from '../../../i18n/translations';
import { useAuthStore } from '../../../store/authStore';
import { useUnoStore, UnoPhase } from '../../../store/unoStore';
import type { UnoColor } from '../../../data/models/ApiModels';
import UnoHand from './UnoHand';
import UnoTable from './UnoTable';
import UnoSeats from './UnoSeats';
import UnoColorPicker from './UnoColorPicker';
import UnoScoreboard from './UnoScoreboard';
import UnoMatchWinnerModal from './UnoMatchWinnerModal';
import { SovereignSecondaryButton } from '../../../ui/components/SovereignButton';
import './uno.css';

interface UnoPageProps {
  roomId: string;
  betAmount: number;
  roomName: string;
  opponentName: string;
  hasOpponent: boolean;
  isSpectator: boolean;
  isPlayer1: boolean;
  onLeaveRequest: () => void;
}

/**
 * Single-screen UNO game UI. Layout (top → bottom):
 *   1. Header (title, bet, leave)
 *   2. Opponents row (UnoSeats with hand counts + UNO/challenge badges)
 *   3. Felt table with central piles (UnoTable: discard, draw, direction, +N badge)
 *   4. Action area (turn timer, take-stack / pass / draw context buttons)
 *   5. Player's own fanned hand (UnoHand)
 *   + Floating "¡UNO!" call button when self is in the miss-window
 *   + Color picker overlay when a Wild needs a color
 */
export default function UnoPage(props: UnoPageProps) {
  const t = useT();
  const me = useAuthStore((s) => s.user);

  const initGame = useUnoStore((s) => s.initGame);
  const cleanup = useUnoStore((s) => s.cleanup);
  const phase = useUnoStore((s) => s.phase);
  const hand = useUnoStore((s) => s.hand);
  const topDiscard = useUnoStore((s) => s.topDiscard);
  const drawPileCount = useUnoStore((s) => s.drawPileCount);
  const currentColor = useUnoStore((s) => s.currentColor);
  const direction = useUnoStore((s) => s.direction);
  const drawStackPending = useUnoStore((s) => s.drawStackPending);
  const isPlayerTurn = useUnoStore((s) => s.isPlayerTurn);
  const playerOrder = useUnoStore((s) => s.playerOrder);
  const usernames = useUnoStore((s) => s.usernames);
  const handCount = useUnoStore((s) => s.handCount);
  const eliminatedPlayers = useUnoStore((s) => s.eliminatedPlayers);
  const unoCalled = useUnoStore((s) => s.unoCalled);
  const pendingUnoOffender = useUnoStore((s) => s.pendingUnoOffender);
  const currentTurnPlayerId = useUnoStore((s) => s.currentTurnPlayerId);
  const currentTurnUsername = useUnoStore((s) => s.currentTurnUsername);
  const turnTimeLeft = useUnoStore((s) => s.turnTimeLeft);
  const pendingWildIndex = useUnoStore((s) => s.pendingWildIndex);
  const toast = useUnoStore((s) => s.toast);
  const apiErrorRawMessage = useUnoStore((s) => s.apiErrorRawMessage);
  const myUserId = useUnoStore((s) => s.myUserId);
  const gameOver = useUnoStore((s) => s.gameOver);
  const matchScores = useUnoStore((s) => s.matchScores);
  const roundNumber = useUnoStore((s) => s.roundNumber);
  const matchTargetScore = useUnoStore((s) => s.matchTargetScore);
  const matchWinnerId = useUnoStore((s) => s.matchWinnerId);
  const nextRoundCountdownSec = useUnoStore((s) => s.nextRoundCountdownSec);
  const playersReadyForNext = useUnoStore((s) => s.playersReadyForNext);
  const lastRoundWinnerUsername = useUnoStore((s) => s.lastRoundWinnerUsername);
  const lastRoundScoreDealt = useUnoStore((s) => s.lastRoundScoreDealt);
  const matchPrize = useUnoStore((s) => s.matchPrize);

  const selectCardForPlay = useUnoStore((s) => s.selectCardForPlay);
  const confirmWildColor = useUnoStore((s) => s.confirmWildColor);
  const cancelWildPick = useUnoStore((s) => s.cancelWildPick);
  const drawCard = useUnoStore((s) => s.drawCard);
  const passTurn = useUnoStore((s) => s.passTurn);
  const takeDrawStack = useUnoStore((s) => s.takeDrawStack);
  const callUno = useUnoStore((s) => s.callUno);
  const challengeUnoMiss = useUnoStore((s) => s.challengeUnoMiss);
  const startNextRound = useUnoStore((s) => s.startNextRound);
  const clearToast = useUnoStore((s) => s.clearToast);
  const clearError = useUnoStore((s) => s.clearError);

  // Init / cleanup mirrors the pattern of other game pages — connect on mount, hard-disconnect on unmount.
  useEffect(() => {
    initGame(props.roomId, me?.username ?? '', {
      isSpectator: props.isSpectator,
      hasOpponent: props.hasOpponent,
      initialOpponentName: props.opponentName,
      betAmount: props.betAmount,
      isPlayer1: props.isPlayer1,
    });
    return () => cleanup();
  }, [initGame, cleanup, props.roomId, props.isSpectator, props.hasOpponent, props.opponentName, props.betAmount, props.isPlayer1, me?.username]);

  const canTakeStack = isPlayerTurn && drawStackPending > 0 && !props.isSpectator;
  const canDraw = isPlayerTurn && drawStackPending === 0 && !props.isSpectator;
  // No legal move + no stack pending → "pass" allowed (server validates, this is a hint).
  const showPass = isPlayerTurn && drawStackPending === 0 && hand.length > 0 && !props.isSpectator;

  const colorLabels: Record<UnoColor, string> = useMemo(
    () => ({
      R: t('uno_color_red'),
      G: t('uno_color_green'),
      B: t('uno_color_blue'),
      Y: t('uno_color_yellow'),
    }),
    [t],
  );

  const showCallUnoBtn = !props.isSpectator && pendingUnoOffender === myUserId;
  const turnLabel =
    phase === UnoPhase.PLAY
      ? isPlayerTurn
        ? t('uno_your_turn')
        : currentTurnUsername
          ? t('uno_player_turn').replace('{{username}}', currentTurnUsername)
          : ''
      : phase === UnoPhase.WAITING
        ? t('uno_status_waiting_opponent')
        : '';

  const timerLow = turnTimeLeft > 0 && turnTimeLeft <= 10;

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="uno-page">
          {/* Header */}
          <div className="uno-header">
            <button className="uno-header__leave" onClick={props.onLeaveRequest} type="button">
              {t('bs_leave')}
            </button>
            <div>
              <div className="uno-header__title">UNO</div>
              <div className="uno-header__bet">
                {props.roomName} · ${props.betAmount}
              </div>
            </div>
            <div style={{ width: 60 }} />
          </div>

          {/* Felt + opponents + table */}
          <div className="uno-table" />
          <UnoSeats
            playerOrder={playerOrder}
            myUserId={myUserId}
            usernames={usernames}
            handCount={handCount}
            eliminatedPlayers={eliminatedPlayers}
            unoCalled={unoCalled}
            pendingUnoOffender={pendingUnoOffender}
            currentTurnPlayerId={currentTurnPlayerId}
            onChallenge={challengeUnoMiss}
            challengeLabel={t('uno_challenge_button')}
            unoLabel={t('uno_label_uno')}
          />

          <div className="uno-banner">{turnLabel}</div>

          <UnoTable
            topDiscard={topDiscard}
            drawPileCount={drawPileCount}
            currentColor={currentColor}
            direction={direction}
            drawStackPending={drawStackPending}
            canDraw={canDraw}
            onDrawClick={drawCard}
            drawCountLabel={t('uno_draw_pile')}
            discardCountLabel={t('uno_discard_pile')}
          />

          {/* Turn timer */}
          {phase === UnoPhase.PLAY && turnTimeLeft > 0 && (
            <div className={`uno-timer ${timerLow ? 'uno-timer--low' : ''}`} aria-label="turn timer">
              {turnTimeLeft}s
            </div>
          )}

          {/* Action bar (take-stack / pass) */}
          <div className="uno-actions">
            {canTakeStack && (
              <SovereignSecondaryButton onClick={takeDrawStack}>
                {t('uno_take_stack').replace('{{count}}', String(drawStackPending))}
              </SovereignSecondaryButton>
            )}
            {showPass && (
              <SovereignSecondaryButton onClick={passTurn}>{t('uno_pass')}</SovereignSecondaryButton>
            )}
          </div>

          {/* Big "¡UNO!" call button — visible only when YOU forgot UNO */}
          {showCallUnoBtn && (
            <button className="uno-call-btn" type="button" onClick={callUno} aria-label={t('uno_call_button')}>
              ¡UNO!
            </button>
          )}

          {/* Player hand */}
          {!props.isSpectator && (
            <UnoHand
              hand={hand}
              topDiscard={topDiscard}
              currentColor={currentColor}
              drawStackPending={drawStackPending}
              isMyTurn={isPlayerTurn}
              onCardPlay={selectCardForPlay}
            />
          )}

          {/* Color picker for Wild plays */}
          <UnoColorPicker
            open={pendingWildIndex !== null}
            title={t('uno_choose_color')}
            cancelLabel={t('cancel')}
            onPick={(c) => confirmWildColor(c)}
            onCancel={cancelWildPick}
            labels={colorLabels}
          />

          {/* Between-rounds scoreboard */}
          {phase === UnoPhase.BETWEEN_ROUNDS && (
            <UnoScoreboard
              playerOrder={playerOrder}
              usernames={usernames}
              matchScores={matchScores}
              matchTargetScore={matchTargetScore}
              myUserId={myUserId}
              roundNumber={roundNumber}
              lastRoundWinnerUsername={lastRoundWinnerUsername}
              lastRoundScoreDealt={lastRoundScoreDealt}
              countdownSec={nextRoundCountdownSec}
              playersReadyForNext={playersReadyForNext}
              onReady={startNextRound}
              titleLabel={t('uno_round_ended_title')}
              roundLabel={t('uno_round_label')}
              pointsLabel={t('uno_points_label')}
              targetLabel={t('uno_target_label')}
              readyButtonLabel={t('uno_ready_btn')}
              readyConfirmedLabel={t('uno_ready_confirmed')}
              countdownLabel={t('uno_next_round_in')}
              winnerOfRoundLabel={t('uno_winner_of_round')}
            />
          )}

          {/* Match-end modal (replaces the Phase 1 generic alert) */}
          <UnoMatchWinnerModal
            open={phase === UnoPhase.GAME_OVER && !!gameOver && !!matchWinnerId}
            isWinner={!!gameOver?.youWon}
            winnerUsername={
              matchWinnerId ? usernames[matchWinnerId] || '' : ''
            }
            prize={matchPrize}
            finalScores={matchScores}
            usernames={usernames}
            playerOrder={playerOrder}
            titleWinLabel={t('uno_match_winner_title_win')}
            titleLoseLabel={t('uno_match_winner_title_lose')}
            prizeLabel={t('uno_match_prize')}
            finalScoresLabel={t('uno_final_scores')}
            closeLabel={t('ok')}
            onClose={props.onLeaveRequest}
          />

          {/* Generic alert for non-match game-over (e.g. draws / forfeit) */}
          <IonAlert
            isOpen={phase === UnoPhase.GAME_OVER && !!gameOver && !matchWinnerId}
            backdropDismiss={false}
            header={gameOver?.youWon ? t('bs_you_won') : gameOver?.isDraw ? t('bs_draw') : t('bs_you_lost')}
            message={gameOver?.reason ? t(gameOver.reason) : ''}
            buttons={[{ text: t('ok'), handler: () => props.onLeaveRequest() }]}
          />

          {/* Toasts */}
          <IonToast
            isOpen={!!toast}
            message={toast || ''}
            duration={2000}
            onDidDismiss={clearToast}
            position="top"
          />
          <IonToast
            isOpen={!!apiErrorRawMessage}
            message={apiErrorRawMessage || ''}
            duration={2500}
            color="danger"
            onDidDismiss={clearError}
            position="middle"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}
