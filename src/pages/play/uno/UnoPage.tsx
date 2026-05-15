import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
  IonButtons,
  useIonToast,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useT, hasKey } from '../../../i18n/translations';
import { useAuthStore } from '../../../store/authStore';
import { useUnoStore, UnoPhase } from '../../../store/unoStore';
import type { UnoColor, ChatMessage } from '../../../data/models/ApiModels';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import UnoHand from './UnoHand';
import UnoTable from './UnoTable';
import UnoSeats from './UnoSeats';
import UnoColorPicker from './UnoColorPicker';
import UnoScoreboard from './UnoScoreboard';
import UnoMatchWinnerModal from './UnoMatchWinnerModal';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import ConnectionStrengthIndicator from '../../../ui/components/ConnectionStrengthIndicator';
import { formatApiMessageForDisplay } from '../../../i18n/ApiMessageDisplay';
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

export default function UnoPage(props: UnoPageProps) {
  const t = useT();
  const me = useAuthStore((s) => s.user);
  const [present] = useIonToast();
  const chatRef = useRef(new ChatSocketManager());
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

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
  const chatGreetingOverlay = useUnoStore((s) => s.chatGreetingOverlay);
  const chatErrorToast = useUnoStore((s) => s.chatErrorToast);
  const greetings = useUnoStore((s) => s.greetings);
  const spectatorsCount = useUnoStore((s) => s.spectatorsCount);
  const statusMessage = useUnoStore((s) => s.statusMessage);

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
  const clearChatErrorToast = useUnoStore((s) => s.clearChatErrorToast);

  useEffect(() => {
    initGame(props.roomId, me?.username ?? '', {
      isSpectator: props.isSpectator,
      hasOpponent: props.hasOpponent,
      initialOpponentName: props.opponentName,
      betAmount: props.betAmount,
      isPlayer1: props.isPlayer1,
    });

    const chat = chatRef.current;
    chat.onChatEnvelope = (json) => useUnoStore.getState().handleChatEnvelope(json);
    chat.onMessage(setLastMsg);
    chat.connect(props.roomId);
    (window as unknown as { unoChatSocket?: ChatSocketManager }).unoChatSocket = chat;

    return () => {
      cleanup();
      chat.disconnect();
      delete (window as unknown as { unoChatSocket?: ChatSocketManager }).unoChatSocket;
    };
  }, [initGame, cleanup, props.roomId, props.isSpectator, props.hasOpponent, props.opponentName, props.betAmount, props.isPlayer1, me?.username]);

  useEffect(() => {
    if (phase === UnoPhase.PLAY && !props.isSpectator) {
      useUnoStore.getState().loadGreetings();
    }
  }, [phase, props.isSpectator]);

  useEffect(() => {
    if (!chatErrorToast) return;
    present({
      message: chatErrorToast,
      duration: 2500,
      position: 'bottom',
      color: 'warning',
      onDidDismiss: () => clearChatErrorToast(),
    });
  }, [chatErrorToast, present, clearChatErrorToast]);

  const canTakeStack = isPlayerTurn && drawStackPending > 0 && !props.isSpectator;
  const canDraw = isPlayerTurn && drawStackPending === 0 && !props.isSpectator;
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

  const waitingBody = statusMessage
    ? hasKey(statusMessage)
      ? t(statusMessage)
      : statusMessage
    : '';

  const bannerFromStatus =
    statusMessage && (hasKey(statusMessage) ? t(statusMessage) : statusMessage);

  const turnLabel =
    phase === UnoPhase.PLAY
      ? isPlayerTurn
        ? t('uno_your_turn')
        : currentTurnUsername
          ? t('uno_player_turn').replace('{{username}}', currentTurnUsername)
          : ''
      : phase === UnoPhase.WAITING
        ? t('uno_status_waiting_opponent')
        : phase === UnoPhase.GAME_OVER
          ? bannerFromStatus || ''
          : '';

  const timerLow = turnTimeLeft > 0 && turnTimeLeft <= 10;

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={props.onLeaveRequest} aria-label={t('bs_leave_room')}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>
            <span style={{ display: 'block', lineHeight: 1.15 }}>{props.roomName}</span>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a9bbf', letterSpacing: 2 }}>
              UNO
            </span>
          </IonTitle>
          <IonButtons slot="end">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 28,
                  padding: '0 6px',
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid var(--sovereign-border)',
                  borderRadius: 8,
                }}
              >
                <ConnectionStrengthIndicator />
              </div>
              <IonText style={{ color: '#c9a84c', fontSize: 14 }}>${props.betAmount}</IonText>
            </div>
          </IonButtons>
        </IonToolbar>

        {chatGreetingOverlay && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10,
              background: 'rgba(201,168,76,0.95)',
              color: '#000',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {chatGreetingOverlay.type === 'FromOpponent'
              ? `${chatGreetingOverlay.from}: ${chatGreetingOverlay.text}`
              : `${t('you')}: ${chatGreetingOverlay.text}`}
          </div>
        )}
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' }}>
        {phase === UnoPhase.WAITING && (
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
              zIndex: 30,
            }}
          >
            <IonCard
              style={{
                width: '85%',
                maxWidth: 340,
                '--background': '#1a2940',
                borderRadius: 24,
                textAlign: 'center',
                border: '2px solid rgba(255,255,255,0.1)',
              }}
            >
              <IonCardContent style={{ padding: '32px 24px' }}>
                <IonText
                  style={{
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 800,
                    display: 'block',
                    marginBottom: 16,
                    letterSpacing: 2,
                  }}
                >
                  {t('bs_waiting_title').toUpperCase()}
                </IonText>
                <IonSpinner name="crescent" style={{ color: '#c9a84c', marginBottom: 24, width: 48, height: 48 }} />
                <IonText
                  style={{
                    color: '#8a9bbf',
                    fontSize: 15,
                    display: 'block',
                    marginBottom: 32,
                    lineHeight: 1.4,
                  }}
                >
                  {waitingBody}
                </IonText>
                <IonButton
                  expand="block"
                  onClick={props.onLeaveRequest}
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

        <div className="uno-page">
          <div className="uno-chat-strip">
            {props.isSpectator && <SpectatorBadge count={spectatorsCount} />}
            {phase === UnoPhase.PLAY && !props.isSpectator && greetings.length > 0 && (
              <ChatGreetingChips
                greetings={greetings}
                onSend={(id) => useUnoStore.getState().sendGreeting(props.roomId, id)}
                lastReceivedMessage={lastMsg}
              />
            )}
          </div>

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

          <div className="uno-banner">{phase !== UnoPhase.WAITING ? turnLabel : ''}</div>

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

          {phase === UnoPhase.PLAY && turnTimeLeft > 0 && (
            <div className={`uno-timer ${timerLow ? 'uno-timer--low' : ''}`} aria-label="turn timer">
              {turnTimeLeft}s
            </div>
          )}

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

          {showCallUnoBtn && (
            <button className="uno-call-btn" type="button" onClick={callUno} aria-label={t('uno_call_button')}>
              ¡UNO!
            </button>
          )}

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

          <UnoColorPicker
            open={pendingWildIndex !== null}
            title={t('uno_choose_color')}
            cancelLabel={t('cancel')}
            onPick={(c) => confirmWildColor(c)}
            onCancel={cancelWildPick}
            labels={colorLabels}
          />

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

          <UnoMatchWinnerModal
            open={phase === UnoPhase.GAME_OVER && !!gameOver && !!matchWinnerId}
            isWinner={!!gameOver?.youWon}
            winnerUsername={matchWinnerId ? usernames[matchWinnerId] || '' : ''}
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

          <IonAlert
            isOpen={phase === UnoPhase.GAME_OVER && !!gameOver && !matchWinnerId}
            backdropDismiss={false}
            header={gameOver?.youWon ? t('bs_you_won') : gameOver?.isDraw ? t('bs_draw') : t('bs_you_lost')}
            message={
              gameOver?.reason ? formatApiMessageForDisplay(gameOver.reason, '') : ''
            }
            buttons={[{ text: t('ok'), handler: () => props.onLeaveRequest() }]}
          />

          <IonToast
            isOpen={!!toast}
            message={toast || ''}
            duration={2000}
            onDidDismiss={clearToast}
            position="top"
          />
          <IonToast
            isOpen={!!apiErrorRawMessage}
            message={formatApiMessageForDisplay(apiErrorRawMessage, '')}
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
