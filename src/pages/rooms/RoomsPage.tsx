import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonIcon,
  IonText,
  IonFab,
  IonFabButton,
  IonModal,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonToast,
  IonCard,
  IonCardContent,
  RefresherEventDetail,
} from '@ionic/react';
import { useParams, useNavigate } from "react-router-dom";
import {
  addOutline,
  peopleOutline,
  eyeOutline,
  cashOutline,
  enterOutline,
  closeOutline,
  gameControllerOutline,
} from 'ionicons/icons';
import { useRoomsStore } from '../../store/roomsStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { LobbySocketManager } from '../../data/network/LobbySocketManager';
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import ConnectionStrengthIndicator from '../../ui/components/ConnectionStrengthIndicator';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { useT, hasKey } from '../../i18n/translations';
import {
  formatApiMessageForDisplay,
  formatRoomBetMinMessage,
  classifyRoomLobbyStatus,
  RoomLobbyKind,
} from '../../i18n/ApiMessageDisplay';
import { getGameContext, savePlayContext } from '../../util/routingStorage';
import { formatUSD } from '../../util/formatCurrency';
import '../../ui/theme/variables.css';
type RoomStatus = 'waiting' | 'started' | 'finished';

interface RoomsParams {
  gameId: string;
  gameName: string;
  gameSocketCode: string;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  waiting: '#4caf50',
  started: 'var(--sovereign-gold)',
  finished: 'var(--sovereign-text-muted)',
};

/** Create-room modal: Domino seats */
const DOMINO_CREATE_PLAYER_OPTIONS = [2, 4] as const;
/** Create-room modal: UNO seats (must match API `UNO_ALLOWED_PLAYER_COUNTS`) */
const UNO_CREATE_PLAYER_OPTIONS = [2, 4, 6, 8, 10] as const;

const RoomsPage: React.FC = () => {
  const { gameSocketCode = '' } = useParams<{ gameSocketCode: string }>();
  const navigate = useNavigate();
  
  // Get context from sessionStorage
  const gameCtx = getGameContext();
  const gameId = gameCtx?.gameId || '';
  const gameName = gameCtx?.gameName || '';
  const t = useT();
  const decodedGameName = decodeURIComponent(gameName);

  // Read balance and minBet from local store — no need to pass through URL
  const { account, games, refreshAccount, loadDashboard } = useDashboardStore();
  const userBalanceNum = account?.balance ?? 0;
  const minBetNum = games.find((g) => g.id === gameId)?.minBet ?? 0;
  const catalogGame = games.find((g) => g.id === gameId);
  const unoMatchTargetCatalog =
    gameSocketCode === 'uno' && typeof catalogGame?.unoMatchTarget === 'number'
      ? catalogGame.unoMatchTarget
      : undefined;

  const playCtxExtras =
    gameSocketCode === 'uno' && unoMatchTargetCatalog != null
      ? { unoMatchTarget: unoMatchTargetCatalog }
      : {};

  const { rooms, isLoading, error, showCreateDialog, loadRooms, createRoom, joinRoom, spectateRoom, setShowCreateDialog, addOrUpdateRoom, updateRoom, removeRoom, clearError } = useRoomsStore();
  const lobbySocketRef = useRef<LobbySocketManager | null>(null);

  useEffect(() => {
    refreshAccount();
    if (gameId) loadRooms(gameId);
  }, [gameId]);

  useEffect(() => {
    if (!gameId || games.length > 0) return;
    void loadDashboard();
  }, [gameId, games.length, loadDashboard]);

  const [filter, setFilter] = useState<'all' | 'waiting' | 'started'>('all');
  const [createName, setCreateName] = useState('');
  const [createBet, setCreateBet] = useState(minBetNum);
  const [createLimit, setCreateLimit] = useState(2);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [spectatingId, setSpectatingId] = useState<string | null>(null);

  /** Matches PlayPage routing: upfront stake + join confirm for chess / halma / domino / uno. */
  const showJoinStakeConfirm = ['chess', 'halma', 'domino', 'uno', 'connect-four'].includes(
    (gameSocketCode || '').toLowerCase(),
  );
  const [joinConfirmRoom, setJoinConfirmRoom] = useState<{
    id: string;
    name: string;
    betAmount: number;
    opponentName: string;
  } | null>(null);
  
  // Reset form and default to minBet when modal opens
  useEffect(() => {
    if (showCreateDialog) {
      setCreateName('');
      setCreateBet(minBetNum);
      setCreateLimit(2);
      setCreateError('');
    }
  }, [showCreateDialog, minBetNum, gameSocketCode]);

  const createRoomPlayerOptions =
    gameSocketCode === 'domino'
      ? DOMINO_CREATE_PLAYER_OPTIONS
      : gameSocketCode === 'uno'
        ? UNO_CREATE_PLAYER_OPTIONS
        : null;

  useEffect(() => {
    if (!showCreateDialog || !createRoomPlayerOptions) return;
    const allowed = createRoomPlayerOptions as readonly number[];
    if (!allowed.includes(createLimit)) {
      setCreateLimit(createRoomPlayerOptions[0]);
    }
  }, [showCreateDialog, createRoomPlayerOptions, createLimit]);

  useEffect(() => {
    if (!gameId || !gameSocketCode) {
      console.warn('[RoomsPage] Missing game context, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }
    loadRooms(gameId);

    // Own the socket lifecycle directly — same pattern as game pages
    const socket = new LobbySocketManager();
    lobbySocketRef.current = socket;
    socket.connect(gameId);

    socket.onConnect(() => {
      // socket is live — future room changes will arrive in real time
    });
    socket.onRoomCreated((room) => {
      if (room.gameId !== undefined && String(room.gameId) !== String(gameId)) return;
      addOrUpdateRoom(room);
    });
    socket.onRoomUpdated((room) => {
      if (room.gameId !== undefined && String(room.gameId) !== String(gameId)) return;
      updateRoom(room);
    });
    socket.onRoomDeleted((roomId) => {
      removeRoom(roomId);
    });

    return () => {
      socket.offAll();
      socket.disconnect();
      lobbySocketRef.current = null;
    };
  }, [gameId]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadRooms(gameId);
    event.detail.complete();
  };


  const handleJoin = async (roomId: string, roomName: string, betAmount: number, opponentName: string) => {
    setJoiningId(roomId);
    try {
      await joinRoom(roomId);
      savePlayContext({
        roomId,
        betAmount,
        roomName,
        opponentName,
        hasOpponent: true,
        isSpectator: false,
        isPlayer1: false,
        ...playCtxExtras,
      });
      navigate(`/play/${gameSocketCode}`);
    } catch (err) {
      setToast({ 
        isOpen: true, 
        message: formatApiMessageForDisplay(err instanceof Error ? err.message : null, 'error_join_room_failed'), 
        color: 'danger' 
      });
    } finally {
      setJoiningId(null);
    }
  };

  const handleSpectate = async (roomId: string, roomName: string, betAmount: number, firstPlayerName: string) => {
    console.log('[SPECTATOR][3] handleSpectate → roomId:', roomId, 'roomName:', roomName, 'betAmount:', betAmount, 'firstPlayerName:', firstPlayerName);
    setSpectatingId(roomId);
    try {
      await spectateRoom(roomId);
      savePlayContext({
        roomId,
        betAmount,
        roomName,
        opponentName: firstPlayerName,
        hasOpponent: true,
        isSpectator: true,
        isPlayer1: false,
        ...playCtxExtras,
      });
      navigate(`/play/${gameSocketCode}`);
    } catch (err) {
      console.error('[SPECTATOR][ERROR] spectateRoom failed:', err);
      setToast({ 
        isOpen: true, 
        message: formatApiMessageForDisplay(err instanceof Error ? err.message : null, 'error_spectate_room_failed'), 
        color: 'danger' 
      });
    } finally {
      setSpectatingId(null);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError(t('room_error_name_required'));
      return;
    }
    if (createBet < minBetNum) {
      setCreateError(formatRoomBetMinMessage(minBetNum));
      return;
    }
    if (createBet > userBalanceNum) {
      setCreateError(t('room_bet_exceeds_balance_error').replace('%s', `$${formatUSD(userBalanceNum)}`));
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const roomId = await createRoom({
        game_id: gameId,
        bet_amount: createBet,
        public: true,
        name: createName.trim(),
        player_limit: createLimit,
      });
      const roomName = createName.trim();
      setShowCreateDialog(false);
      
      savePlayContext({
        roomId,
        betAmount: createBet,
        roomName,
        opponentName: 'Waiting',
        hasOpponent: false,
        isSpectator: false,
        isPlayer1: true,
        ...playCtxExtras,
      });
      
      setCreateName('');
      setCreateBet(minBetNum);
      setCreateLimit(2);
      navigate(`/play/${gameSocketCode}`);
    } catch (err) {
      setCreateError(
        formatApiMessageForDisplay(err instanceof Error ? err.message : null, 'error_create_room_failed', {
          minBet: minBetNum,
        }),
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const getLocalizedStatusLabel = (status: string) => {
    const kind = classifyRoomLobbyStatus(status);
    switch (kind) {
      case 'WAITING':
        return t('rooms_filter_waiting');
      case 'STARTED':
        return t('rooms_filter_started');
      case 'FINISHED':
        return t('APP.ROOMS.STATUS_FINISHED');
      default:
        // Use formatApiMessageForDisplay to resolve raw keys or English literals
        return formatApiMessageForDisplay(status, '');
    }
  };

  const getStatusColor = (status: string) => {
    const kind = classifyRoomLobbyStatus(status);
    if (kind === 'WAITING') return '#4caf50';
    if (kind === 'STARTED') return 'var(--sovereign-gold)';
    if (kind === 'FINISHED') return 'var(--sovereign-text-muted)';
    return 'var(--sovereign-text-muted)';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '17px' }}>
            <span style={{ display: 'block', lineHeight: 1.15 }}>{decodedGameName}</span>
            {unoMatchTargetCatalog != null && (
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--sovereign-text-muted)',
                  marginTop: 2,
                }}
              >
                {t('uno_lobby_match_target').replace('{{points}}', String(unoMatchTargetCatalog))}
              </span>
            )}
          </IonTitle>
          <IonButtons slot="end">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginRight: '12px',
              }}
            >
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid var(--sovereign-border)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                }}
              >
                <IonIcon icon={cashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '14px' }} />
                <IonText>
                  <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '13px' }}>
                    ${formatUSD(userBalanceNum)}
                  </span>
                </IonText>
              </div>
            </div>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' } as React.CSSProperties}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Filter segment */}
        <div style={{ padding: '16px 16px 8px' }}>
          <IonSegment
            value={filter}
            onIonChange={(e) => setFilter(e.detail.value as typeof filter)}
            style={{ '--background': 'var(--sovereign-surface)', borderRadius: '10px' } as React.CSSProperties}
          >
            <IonSegmentButton value="all">
              <IonLabel>{t('rooms_filter_all')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="waiting">
              <IonLabel>{t('rooms_filter_waiting')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="started">
              <IonLabel>{t('rooms_filter_started')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <div style={{ padding: '8px 16px 80px' }}>
          {isLoading ? (
            <IonList style={{ background: 'transparent' }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--sovereign-surface)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '10px',
                  }}
                >
                  <IonSkeletonText animated style={{ width: '50%', height: '18px', marginBottom: '8px', borderRadius: '6px' }} />
                  <IonSkeletonText animated style={{ width: '35%', height: '14px', borderRadius: '6px' }} />
                </div>
              ))}
            </IonList>
          ) : filteredRooms.length === 0 ? (
            <IonCard
              style={{
                background: 'var(--sovereign-surface)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '16px',
                margin: '20px 16px',
                textAlign: 'center',
                animation: 'fadeInUp 0.6s ease',
              }}
            >
              <IonCardContent style={{ padding: '32px 24px' }}>
                <IonIcon
                  icon={gameControllerOutline}
                  style={{ fontSize: '64px', color: 'var(--sovereign-gold)', display: 'block', margin: '0 auto 16px', filter: 'drop-shadow(0 0 12px rgba(233,195,73,0.3))' }}
                />
                <IonText>
                  <h3 style={{ color: 'var(--sovereign-gold)', fontSize: '20px', fontWeight: '800', margin: '0 0 10px 0' }}>
                    {t('rooms_empty_title')}
                  </h3>
                </IonText>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                    {t('rooms_empty_subtitle')}
                  </p>
                </IonText>
                
                <SovereignPrimaryButton onClick={() => setShowCreateDialog(true)}>
                  <IonIcon icon={addOutline} slot="start" style={{ fontSize: '20px' }} />
                  {t('create_room')}
                </SovereignPrimaryButton>
              </IonCardContent>
            </IonCard>
          ) : (
            <IonList style={{ background: 'transparent' }}>
              {filteredRooms.map((room) => {
                const isFull = room.players.length >= room.playerLimit;
                const canJoin = room.status === 'waiting' && !isFull;
                const canSpectate = room.status === 'started';
                const opponentName = room.players.find((p) => p.username)?.username ?? 'Unknown';

                return (
                  <div
                    key={room.id}
                    style={{
                      background: 'var(--sovereign-surface)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '10px',
                      animation: 'fadeInUp 0.4s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <IonText>
                          <h4 style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '15px', margin: '0 0 4px 0' }}>
                            {room.name}
                          </h4>
                        </IonText>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={peopleOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px' }} />
                            <IonText>
                              <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>
                                {room.players.length}/{room.playerLimit}
                              </span>
                            </IonText>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={cashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '14px' }} />
                            <IonText>
                              <span style={{ color: 'var(--sovereign-gold)', fontSize: '13px', fontWeight: '600' }}>
                                ${room.betAmount}
                              </span>
                            </IonText>
                          </div>
                          {room.spectatorsCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IonIcon icon={eyeOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px' }} />
                              <IonText>
                                <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>
                                  {room.spectatorsCount}
                                </span>
                              </IonText>
                            </div>
                          )}
                        </div>
                      </div>

                      <IonBadge
                        style={{
                          background: getStatusColor(room.status),
                          color: classifyRoomLobbyStatus(room.status) === 'WAITING' ? '#fff' : '#0a1628',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {getLocalizedStatusLabel(room.status)}
                      </IonBadge>
                    </div>

                    {/* Room players */}
                    {room.players.length > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        {room.players.map((player) => (
                          <IonText key={player.id}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '12px',
                                color: 'var(--sovereign-text-muted)',
                                marginRight: '6px',
                              }}
                            >
                              {player.username}
                            </span>
                          </IonText>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {canJoin && (
                        <SovereignPrimaryButton
                          onClick={() => {
                            if (showJoinStakeConfirm) {
                              setJoinConfirmRoom({
                                id: room.id,
                                name: room.name,
                                betAmount: room.betAmount,
                                opponentName,
                              });
                            } else {
                              void handleJoin(room.id, room.name, room.betAmount, opponentName);
                            }
                          }}
                          loading={joiningId === room.id}
                          expand="block"
                          style={{ flex: 1, margin: 0 } as React.CSSProperties}
                        >
                          <IonIcon icon={enterOutline} style={{ marginRight: '6px', fontSize: '16px' }} />
                          {t('join_room')}
                        </SovereignPrimaryButton>
                      )}
                      {canSpectate && (
                        <SovereignSecondaryButton
                          onClick={() => handleSpectate(room.id, room.name, room.betAmount, opponentName)}
                          loading={spectatingId === room.id}
                          expand="block"
                          style={{ flex: 1, margin: 0 } as React.CSSProperties}
                        >
                          <IonIcon icon={eyeOutline} style={{ marginRight: '6px', fontSize: '16px' }} />
                          {t('rooms_watch_live')}
                        </SovereignSecondaryButton>
                      )}
                      {!canJoin && !canSpectate && room.status !== 'finished' && (
                        <IonText>
                          <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>{t('room_full')}</span>
                        </IonText>
                      )}
                    </div>
                  </div>
                );
              })}
            </IonList>
          )}
        </div>

        {/* FAB */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: '16px', marginRight: '8px' }}>
          <IonFabButton
            onClick={() => setShowCreateDialog(true)}
            style={{
              '--background': 'var(--sovereign-gold)',
              '--background-activated': 'var(--sovereign-gold-light)',
              '--color': '#0a1628',
              '--box-shadow': '0 4px 16px rgba(201,168,76,0.5)',
            } as React.CSSProperties}
          >
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        {/* Create Room Modal */}
        <IonModal
          isOpen={showCreateDialog}
          onDidDismiss={() => { setShowCreateDialog(false); setCreateError(''); }}
          breakpoints={[0, 1]}
          initialBreakpoint={1}
        >
          <IonHeader>
            <IonToolbar style={{ '--background': 'var(--sovereign-surface)', '--border-color': 'var(--sovereign-border)' } as React.CSSProperties}>
              <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>{t('create_room')}</IonTitle>
              <IonButtons slot="end">
                <IonIcon
                  icon={closeOutline}
                  onClick={() => setShowCreateDialog(false)}
                  style={{ color: 'var(--sovereign-text-muted)', fontSize: '24px', cursor: 'pointer', marginRight: '12px' }}
                />
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent style={{ '--background': 'var(--sovereign-surface)' } as React.CSSProperties}>
            <div style={{ padding: '24px 20px' }}>
              {/* Room Name */}
              <div style={{ marginBottom: '20px' }}>
                <IonText>
                  <label style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    {t('label_room').toUpperCase()}
                  </label>
                </IonText>
                  <IonInput
                    value={createName}
                    onIonInput={(e) => setCreateName(e.detail.value ?? '')}
                    placeholder={t('placeholder_enter_room_name')}
                    maxlength={40}
                  style={{
                    '--background': 'transparent',
                    '--color': 'var(--sovereign-text)',
                    '--placeholder-color': 'var(--sovereign-text-muted)',
                    '--border-radius': '10px',
                    '--padding-start': '14px',
                    '--padding-end': '14px',
                    '--padding-top': '12px',
                    '--padding-bottom': '12px',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                  } as React.CSSProperties}
                />
              </div>

              {/* Bet Amount */}
              <div style={{ marginBottom: '20px' }}>
                <IonText>
                  <label style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    {t('label_bet').toUpperCase()} (min ${minBetNum})
                  </label>
                </IonText>
                <IonInput
                  type="number"
                  value={String(createBet)}
                  onIonInput={(e) => setCreateBet(parseFloat(e.detail.value ?? '0') || 0)}
                  min={String(minBetNum)}
                  max={String(userBalanceNum)}
                  step="0.01"
                  style={{
                    '--background': 'transparent',
                    '--color': 'var(--sovereign-text)',
                    '--placeholder-color': 'var(--sovereign-text-muted)',
                    '--border-radius': '10px',
                    '--padding-start': '14px',
                    '--padding-end': '14px',
                    '--padding-top': '12px',
                    '--padding-bottom': '12px',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                  } as React.CSSProperties}
                />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px', margin: '6px 0 0 2px' }}>
                    {t('your_balance')}: ${formatUSD(userBalanceNum)}
                  </p>
                </IonText>
              </div>

              {/* Player limit — Domino (2/4) and UNO (2–10 even); backend validates */}
              {createRoomPlayerOptions && (
                <div style={{ marginBottom: '28px' }}>
                  <IonText>
                    <label style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      {t('room_player_limit_label').toUpperCase()}
                    </label>
                  </IonText>
                  <IonSelect
                    value={createLimit}
                    onIonChange={(e) => setCreateLimit(Number(e.detail.value))}
                    interface="popover"
                    style={{
                      '--background': 'transparent',
                      '--color': 'var(--sovereign-text)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      width: '100%',
                    } as React.CSSProperties}
                  >
                    {createRoomPlayerOptions.map((n) => (
                      <IonSelectOption key={n} value={n}>
                        {t('room_player_limit_option').replace('%d', String(n))}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              )}

              {createError && (
                <div
                  style={{
                    background: 'rgba(207,102,121,0.12)',
                    border: '1px solid rgba(207,102,121,0.4)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                  }}
                >
                  <IonText>
                    <p style={{ color: 'var(--sovereign-error)', fontSize: '13px', margin: 0 }}>{createError}</p>
                  </IonText>
                </div>
              )}

              {gameSocketCode === 'uno' && unoMatchTargetCatalog != null && (
                <div
                  style={{
                    background: 'rgba(201,168,76,0.10)',
                    border: '1px solid rgba(201,168,76,0.25)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                  }}
                >
                  <IonText>
                    <p style={{ color: 'var(--sovereign-gold)', fontSize: '13px', margin: 0, lineHeight: 1.45, fontWeight: 600 }}>
                      {t('uno_lobby_match_target').replace('{{points}}', String(unoMatchTargetCatalog))}
                    </p>
                  </IonText>
                </div>
              )}

              {['chess', 'halma', 'domino', 'uno', 'connect-four'].includes(gameSocketCode) && (
                <div style={{
                  background: 'rgba(255,107,53,0.10)',
                  border: '1px solid rgba(255,107,53,0.30)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ color: '#ff8a5c', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                      {t('rooms_create_bet_deduction_warning')}
                    </p>
                    <p style={{ color: '#ff8a5c', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                      {t('rooms_join_forfeit_warning')}
                    </p>
                  </div>
                </div>
              )}

              <SovereignPrimaryButton onClick={handleCreate} loading={createLoading} expand="block">
                {t('create_room')}
              </SovereignPrimaryButton>

              <div style={{ height: '12px' }} />

              <SovereignSecondaryButton onClick={() => setShowCreateDialog(false)} expand="block">
                {t('cancel')}
              </SovereignSecondaryButton>
            </div>
          </IonContent>
        </IonModal>

        {/* Join confirmation (Android JoinConfirmDialog) — chess / halma / domino / uno */}
        <IonModal
          isOpen={!!joinConfirmRoom}
          onDidDismiss={() => setJoinConfirmRoom(null)}
          style={{
            '--height': 'fit-content',
            '--width': '90%',
            '--max-width': '380px',
            '--border-radius': '16px',
            '--background': 'var(--sovereign-surface)',
          } as React.CSSProperties}
        >
          <div
            style={{
              padding: '24px 20px 28px',
              background: 'var(--sovereign-surface)',
              textAlign: 'center',
            }}
          >
            <IonIcon
              icon={gameControllerOutline}
              style={{
                fontSize: 36,
                color: 'var(--sovereign-gold)',
                display: 'block',
                margin: '0 auto 12px',
              }}
            />
            <IonText>
              <h2
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  margin: '0 0 14px 0',
                  color: 'var(--sovereign-text)',
                }}
              >
                {t('rooms_join_confirm_title')}
              </h2>
            </IonText>
            <IonText>
              <p
                style={{
                  color: 'var(--sovereign-text-muted)',
                  fontSize: 15,
                  lineHeight: 1.45,
                  margin: '0 0 12px 0',
                }}
              >
                {t('rooms_join_confirm_message').replace('%s', joinConfirmRoom?.name ?? '')}
              </p>
            </IonText>
            {joinConfirmRoom && joinConfirmRoom.betAmount > 0 && (
              <IonText>
                <p
                  style={{
                    color: 'var(--sovereign-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.45,
                    margin: '0 0 22px 0',
                    padding: '12px 14px',
                    background: 'rgba(201,168,76,0.10)',
                    border: '1px solid rgba(201,168,76,0.22)',
                    borderRadius: 10,
                    textAlign: 'left',
                  }}
                >
                  {t('rooms_join_confirm_stake_notice').replace(
                    '%s',
                    `$${formatUSD(joinConfirmRoom.betAmount)}`,
                  )}
                </p>
              </IonText>
            )}
            {joinConfirmRoom && joinConfirmRoom.betAmount <= 0 && <div style={{ height: 8 }} />}
            {gameSocketCode === 'uno' && unoMatchTargetCatalog != null && (
              <IonText>
                <p
                  style={{
                    color: 'var(--sovereign-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.45,
                    margin: '0 0 14px 0',
                    fontWeight: 600,
                  }}
                >
                  {t('uno_lobby_match_target').replace('{{points}}', String(unoMatchTargetCatalog))}
                </p>
              </IonText>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SovereignPrimaryButton
                onClick={() => {
                  const r = joinConfirmRoom;
                  setJoinConfirmRoom(null);
                  if (r) void handleJoin(r.id, r.name, r.betAmount, r.opponentName);
                }}
                loading={joiningId === joinConfirmRoom?.id}
                expand="block"
              >
                {t('rooms_join_confirm_button')}
              </SovereignPrimaryButton>
              <SovereignSecondaryButton onClick={() => setJoinConfirmRoom(null)} expand="block">
                {t('cancel')}
              </SovereignSecondaryButton>
            </div>
          </div>
        </IonModal>

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          duration={3000}
          color={toast.color}
          onDidDismiss={() => setToast({ ...toast, isOpen: false })}
        />
      </IonContent>

      <GenericErrorModal isOpen={!!error} message={error ?? ''} onDismiss={clearError} />
    </IonPage>
  );
};

export default RoomsPage;
