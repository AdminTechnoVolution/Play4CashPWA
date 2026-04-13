import { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonText, IonSpinner, IonCard, IonCardContent,
  useIonToast, IonAlert,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { useDominoStore, DominoPhase } from '../../../store/dominoStore';
import { ChatSocketManager } from '../../../data/network/ChatSocketManager';
import type { DominoTile, ChatMessage } from '../../../data/models/ApiModels';
import GameOverModal from '../components/GameOverModal';
import ChatGreetingChips from '../components/ChatGreetingChips';
import SpectatorBadge from '../components/SpectatorBadge';
import TurnTimer from '../components/TurnTimer';
import { useT, hasKey } from '../../../i18n/translations';
import { applyWsMessagePlaceholders, formatApiMessageForDisplay, formatCatalogInteger, tStatus } from '../../../i18n/ApiMessageDisplay';
import GenericErrorModal from '../../../ui/components/GenericErrorModal';
import ConnectionStrengthIndicator from '../../../ui/components/ConnectionStrengthIndicator';
import { BoardTileViz, EndIndicatorViz, HandTileViz, END_LEFT, END_RIGHT } from './DominoTileViews';
import GameSound from '../../../ui/game/GameSound';
import { registerPlayBackConsumer } from '../../../util/playBackNavigation';

function tilesEqual(t1: DominoTile, t2: DominoTile) {
  return (t1.a === t2.a && t1.b === t2.b) || (t1.a === t2.b && t1.b === t2.a);
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

export default function DominoPage({
  roomId,
  betAmount,
  roomName,
  opponentName,
  hasOpponent,
  isSpectator,
  onLeaveRequest,
}: Props) {
  const { user } = useAuthStore();
  const store = useDominoStore();
  const t = useT();
  const [present] = useIonToast();
  const chatRef = useRef(new ChatSocketManager());
  const [lastMsg, setLastMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!roomId) return;
    store.initGame(roomId, user?.username ?? '', {
      isSpectator,
      hasOpponent,
      initialOpponentName: opponentName,
      betAmount,
    });

    const chat = chatRef.current;
    chat.onChatEnvelope = (json) => store.handleChatEnvelope(json);
    chat.onMessage(setLastMsg);
    chat.connect(roomId);
    (window as unknown as { dominoChatSocket: ChatSocketManager }).dominoChatSocket = chat;

    return () => {
      store.cleanup();
      chat.disconnect();
      delete (window as unknown as { dominoChatSocket?: ChatSocketManager }).dominoChatSocket;
    };
  }, [roomId]);

  useEffect(() => {
    if (store.phase === DominoPhase.PLAY && !isSpectator) {
      store.loadGreetings();
    }
  }, [store.phase, isSpectator]);

  // Sound: tile placed (matches Android LaunchedEffect(state.lastPlayedTile))
  const prevLastTile = useRef(store.lastPlayedTile);
  useEffect(() => {
    if (store.lastPlayedTile && store.lastPlayedTile !== prevLastTile.current) {
      GameSound.tilePlace();
    }
    prevLastTile.current = store.lastPlayedTile;
  }, [store.lastPlayedTile]);

  useEffect(() => {
    if (store.navigateBack) onLeaveRequest();
  }, [store.navigateBack]);

  useEffect(() => {
    return registerPlayBackConsumer(() => {
      const st = useDominoStore.getState();
      if (st.opponentLeftMessage) {
        st.clearOpponentLeft();
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
    if (store.eliminationNotice) {
      present({
        message: store.eliminationNotice,
        duration: 3500,
        position: 'bottom',
        color: 'medium',
        onDidDismiss: () => store.clearEliminationNotice(),
      });
    }
  }, [store.eliminationNotice]);

  const isMyTurn = store.isPlayerTurn;
  const canDraw = isMyTurn && store.validMoves.length === 0 && store.boneyardCount > 0;
  const canPass = isMyTurn && store.validMoves.length === 0 && store.boneyardCount === 0;

  const pickVm = store.sidePickTile
    ? store.validMoves.find(
        (m) => m.tile.a === store.sidePickTile!.a && m.tile.b === store.sidePickTile!.b,
      )
    : null;
  const canPlaceLeft = !!pickVm?.sides.includes('left');
  const canPlaceRight = !!pickVm?.sides.includes('right');

  const handleTileClick = (tile: DominoTile) => {
    if (isSpectator || !isMyTurn) return;
    const vm = store.validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
    if (!vm) return;
    if (vm.sides.length === 1) {
      store.playSide(roomId, tile, vm.sides[0]);
    } else {
      store.selectTile(tile);
    }
  };

  const waitingTitleRaw = store.statusMessage;
  const waitingTitle =
    hasKey(waitingTitleRaw) ? t(waitingTitleRaw) : waitingTitleRaw;
  const showWaitingOverlay = store.phase === DominoPhase.WAITING && !store.gameOver;
  const showPlayBottom =
    store.phase === DominoPhase.PLAY && !showWaitingOverlay;

  return (
    <IonPage style={{ '--background': '#0a1628' }}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onLeaveRequest}><IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} /></IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#fff', fontSize: 16 }}>{t('domino_screen_title')} · {roomName}</IonTitle>
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
        {store.chatGreetingOverlay && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: 'rgba(201,168,76,0.95)', color: '#000', padding: '8px 16px',
            fontSize: 13, fontWeight: 600, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {store.chatGreetingOverlay.type === 'FromOpponent'
              ? `${store.chatGreetingOverlay.from}: ${store.chatGreetingOverlay.text}`
              : `${t('chat_greeting_you_sent')}: ${store.chatGreetingOverlay.text}`}
          </div>
        )}
      </IonHeader>

      <IonContent scrollY={false} fullscreen style={{ '--background': '#0a1628' }}>
        {showWaitingOverlay && (
          <div style={{
            display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
          }}>
            <IonCard style={{ width: '88%', maxWidth: '360px', '--background': '#1a2940', borderRadius: '24px', textAlign: 'center', border: '2px solid rgba(255,255,255,0.1)' }}>
              <IonCardContent style={{ padding: '28px 22px' }}>
                <IonText style={{ color: '#fff', fontSize: '18px', fontWeight: '800', display: 'block', marginBottom: '12px' }}>
                  {waitingTitle}
                </IonText>
                {!!store.waitingLobbySubtitle && (
                  <IonText style={{ color: '#8a9bbf', fontSize: '13px', display: 'block', marginBottom: '20px', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                    {store.waitingLobbySubtitle}
                  </IonText>
                )}
                <IonSpinner name="crescent" style={{ color: '#c9a84c', marginBottom: '20px', width: '44px', height: '44px' }} />
                <IonButton expand="block" onClick={onLeaveRequest} style={{ '--background': 'transparent', '--color': '#8a9bbf', '--border-radius': '12px', border: '1px solid rgba(138,155,191,0.3)', fontWeight: 'bold' }}>
                  {t('bs_leave_room')}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              flex: '1 1 auto',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: 12,
              paddingBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {isSpectator && (
              <SpectatorBadge count={store.spectatorsCount} />
            )}
            {isSpectator && (store.spectatorPlayerOneName || store.spectatorPlayerTwoName) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: '#8a9bbf' }}>
                {[store.spectatorPlayerOneName, store.spectatorPlayerTwoName, store.spectatorPlayerThreeName, store.spectatorPlayerFourName]
                  .filter(Boolean)
                  .map((n, i) => (
                    <span key={i} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>{n}</span>
                  ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
              <IonText style={{ color: isMyTurn ? '#c9a84c' : '#8a9bbf', fontSize: 13, fontWeight: '600' }}>
                {tStatus(store.statusMessage)}
              </IonText>
            </div>

            <TurnTimer
              seconds={store.turnTimeLeft}
              totalSeconds={store.turnTimerTotal}
              isMyTurn={isMyTurn}
              onTimeout={() => {}}
              turnPlayerName={isSpectator ? (store.spectatorCurrentPlayer || undefined) : undefined}
              otherPlayerName={
                store.turnHolder || store.currentPlayer || opponentName
              }
              disableLocalTick={!isSpectator}
              timeoutAlarm={false}
            />

            {store.phase === DominoPhase.PLAY && store.greetings.length > 0 && (
              <ChatGreetingChips
                greetings={store.greetings}
                onSend={(id) => store.sendGreeting(roomId, id)}
                lastReceivedMessage={lastMsg}
              />
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {store.opponents.map((op) => (
                <div key={op.username} style={{ padding: '4px 10px', background: '#131f35', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <IonText style={{ color: '#8a9bbf', fontSize: 12 }}>
                    {op.username}: {formatCatalogInteger(t('domino_tile_count'), op.tileCount)}
                  </IonText>
                </div>
              ))}
            </div>

            <div
              style={{
                borderRadius: 12,
                padding: 8,
                minHeight: 80,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(19, 31, 53, 0.55)',
              }}
            >
              <IonText style={{ color: '#8a9bbf', fontSize: 11, marginBottom: 6, display: 'block' }}>{t('play_room_label')}</IonText>
              {(store.board || []).length === 0 ? (
                <IonText style={{ color: '#4a5a7a', fontSize: 13 }}>{t('domino_board_empty')}</IonText>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px 3px',
                  }}
                >
                  <EndIndicatorViz value={store.leftEnd} isLeft active={!!store.sidePickTile && canPlaceLeft} />
                  {(store.board || []).map((t_tile, i) => {
                    const boardLen = (store.board || []).length;
                    const isLastPlayed =
                      i === boardLen - 1
                      && store.lastPlayedTile != null
                      && tilesEqual(store.lastPlayedTile, t_tile);
                    return (
                      <BoardTileViz
                        key={`${t_tile.a}-${t_tile.b}-${i}`}
                        left={t_tile.a}
                        right={t_tile.b}
                        cellPx={20}
                        highlight={isLastPlayed}
                      />
                    );
                  })}
                  <EndIndicatorViz value={store.rightEnd} isLeft={false} active={!!store.sidePickTile && canPlaceRight} />
                </div>
              )}
            </div>

            <IonText style={{ color: '#8a9bbf', fontSize: 12, textAlign: 'center', display: 'block' }}>
              {formatCatalogInteger(t('domino_boneyard_count'), store.boneyardCount)}
            </IonText>
          </div>

          {showPlayBottom && (
            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(10, 22, 40, 0.98)',
                padding: '10px 12px calc(12px + env(safe-area-inset-bottom))',
              }}
            >
              {isSpectator ? (
                <IonText style={{ color: '#8a9bbf', fontSize: 13, textAlign: 'center', display: 'block', padding: '8px 0' }}>
                  {t('spectator_domino_hidden_hand')}
                </IonText>
              ) : (
                <>
                  {!!store.sidePickTile && (
                    <IonText style={{ color: '#8a9bbf', fontSize: 12, textAlign: 'center', display: 'block', marginBottom: 6 }}>
                      {t('domino_select_side_hint')}
                    </IonText>
                  )}
                  <IonText style={{ color: '#8a9bbf', fontSize: 12, marginBottom: 6, display: 'block' }}>
                    {t('domino_your_hand')} ({(store.myHand || []).length})
                  </IonText>
                  <div
                    style={{
                      display: 'flex',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      flexWrap: 'nowrap',
                      gap: 7,
                      alignItems: 'center',
                      borderRadius: 10,
                      background: 'rgba(19, 31, 53, 0.45)',
                      padding: '8px 10px',
                      marginBottom: 8,
                    }}
                  >
                    {(store.myHand || []).map((tile, i) => {
                      const vm = store.validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
                      const isPlayable = !!vm && isMyTurn;
                      const isSelected =
                        store.sidePickTile?.a === tile.a && store.sidePickTile?.b === tile.b;
                      return (
                        <HandTileViz
                          key={i}
                          left={tile.a}
                          right={tile.b}
                          isSelected={isSelected}
                          isPlayable={isPlayable}
                          isPlayerTurn={isMyTurn}
                          dimUnplayable={isMyTurn && !isPlayable}
                          onClick={() => handleTileClick(tile)}
                        />
                      );
                    })}
                  </div>

                  {!!store.sidePickTile && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {canPlaceLeft && (
                        <IonButton
                          expand="block"
                          onClick={() => store.sidePickTile && store.playSide(roomId, store.sidePickTile, 'left')}
                          style={{
                            flex: 1,
                            '--background': END_LEFT,
                            '--color': '#fff',
                            '--border-radius': '10px',
                            fontWeight: 700,
                          }}
                        >
                          {t('domino_place_left')}
                        </IonButton>
                      )}
                      {canPlaceRight && (
                        <IonButton
                          expand="block"
                          onClick={() => store.sidePickTile && store.playSide(roomId, store.sidePickTile, 'right')}
                          style={{
                            flex: 1,
                            '--background': END_RIGHT,
                            '--color': '#fff',
                            '--border-radius': '10px',
                            fontWeight: 700,
                          }}
                        >
                          {t('domino_place_right')}
                        </IonButton>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    {canDraw && (
                      <IonButton
                        expand="block"
                        onClick={() => store.draw(roomId)}
                        style={{
                          flex: 1,
                          '--background': '#1565C0',
                          '--color': '#fff',
                          '--border-radius': '12px',
                          fontWeight: 700,
                        }}
                      >
                        {t('domino_draw_tile')}
                      </IonButton>
                    )}
                    {canPass && (
                      <IonButton
                        expand="block"
                        onClick={() => store.pass(roomId)}
                        fill="outline"
                        style={{
                          flex: 1,
                          '--border-color': 'rgba(255,255,255,0.35)',
                          '--color': '#8a9bbf',
                          '--border-radius': '12px',
                          fontWeight: 700,
                        }}
                      >
                        {t('domino_pass_turn')}
                      </IonButton>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </IonContent>

      <GameOverModal
        isOpen={!!store.gameOver && store.phase === DominoPhase.GAME_OVER}
        gameOver={store.gameOver}
        isSpectator={isSpectator}
        onExit={onLeaveRequest}
        gameProfile="DOMINO"
      />

      <GenericErrorModal
        isOpen={!!store.apiErrorRawMessage}
        message={formatApiMessageForDisplay(store.apiErrorRawMessage, '')}
        onDismiss={() => store.clearGenericError()}
      />

      <IonAlert
        isOpen={!!store.opponentLeftMessage}
        header={t('bs_opponent_left_title')}
        message={store.opponentLeftMessage || ''}
        buttons={[{ text: t('ok'), handler: () => store.clearOpponentLeft() }]}
        onDidDismiss={() => store.clearOpponentLeft()}
      />
    </IonPage>
  );
}
