import React, { useEffect, useState } from 'react';
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
  RefresherEventDetail,
} from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
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
import { SovereignPrimaryButton, SovereignSecondaryButton } from '../../ui/components/SovereignButton';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import '../../ui/theme/variables.css';
import type { RoomStatus } from '../../data/models/ApiModels';

interface RoomsParams {
  gameId: string;
  gameName: string;
  minBet: string;
  userBalance: string;
  gameSocketCode: string;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  waiting: '#4caf50',
  started: 'var(--sovereign-gold)',
  finished: 'var(--sovereign-text-muted)',
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  waiting: 'Waiting',
  started: 'In Progress',
  finished: 'Finished',
};

const RoomsPage: React.FC = () => {
  const { gameId, gameName, minBet, userBalance, gameSocketCode } = useParams<RoomsParams>();
  const history = useHistory();
  const decodedGameName = decodeURIComponent(gameName);
  const minBetNum = parseFloat(minBet);
  const userBalanceNum = parseFloat(userBalance);

  const { rooms, isLoading, error, showCreateDialog, loadRooms, createRoom, joinRoom, spectateRoom, setShowCreateDialog, connectSocket, disconnectSocket, clearError } = useRoomsStore();

  const [filter, setFilter] = useState<'all' | 'waiting' | 'started'>('all');
  const [createName, setCreateName] = useState('');
  const [createBet, setCreateBet] = useState(minBetNum);
  const [createLimit, setCreateLimit] = useState(2);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', color: '' });
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [spectatingId, setSpectatingId] = useState<string | null>(null);

  useEffect(() => {
    loadRooms(gameId);
    connectSocket(gameId);
    return () => {
      disconnectSocket();
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
      history.push(
        `/play/${gameSocketCode}/${roomId}/${betAmount}/${encodeURIComponent(roomName)}/${encodeURIComponent(opponentName)}/true/false`,
      );
    } catch (err) {
      setToast({ isOpen: true, message: err instanceof Error ? err.message : 'Failed to join room', color: 'danger' });
    } finally {
      setJoiningId(null);
    }
  };

  const handleSpectate = async (roomId: string, roomName: string, betAmount: number) => {
    setSpectatingId(roomId);
    try {
      await spectateRoom(roomId);
      history.push(
        `/play/${gameSocketCode}/${roomId}/${betAmount}/${encodeURIComponent(roomName)}/Spectating/false/true`,
      );
    } catch (err) {
      setToast({ isOpen: true, message: err instanceof Error ? err.message : 'Failed to spectate room', color: 'danger' });
    } finally {
      setSpectatingId(null);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError('Room name is required.');
      return;
    }
    if (createBet < minBetNum) {
      setCreateError(`Minimum bet is $${minBetNum}.`);
      return;
    }
    if (createBet > userBalanceNum) {
      setCreateError('Bet exceeds your balance.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const room = await createRoom({
        gameId,
        betAmount: createBet,
        playerLimit: createLimit,
        name: createName.trim(),
      });
      setShowCreateDialog(false);
      setCreateName('');
      setCreateBet(minBetNum);
      setCreateLimit(2);
      history.push(
        `/play/${gameSocketCode}/${room.id}/${createBet}/${encodeURIComponent(room.name)}/Waiting/false/false`,
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create room.');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" style={{ color: 'var(--sovereign-gold)' }} />
          </IonButtons>
          <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700', fontSize: '17px' }}>
            {decodedGameName}
          </IonTitle>
          <IonButtons slot="end">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginRight: '12px',
                background: 'rgba(201,168,76,0.12)',
                border: '1px solid var(--sovereign-border)',
                borderRadius: '8px',
                padding: '4px 10px',
              }}
            >
              <IonIcon icon={cashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '14px' }} />
              <IonText>
                <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '13px' }}>
                  ${userBalanceNum.toFixed(2)}
                </span>
              </IonText>
            </div>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
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
              <IonLabel>All</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="waiting">
              <IonLabel>Waiting</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="started">
              <IonLabel>Started</IonLabel>
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
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <IonIcon
                icon={gameControllerOutline}
                style={{ fontSize: '64px', color: 'var(--sovereign-text-muted)', display: 'block', margin: '0 auto 16px' }}
              />
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '15px', margin: '0 0 8px 0' }}>
                  No rooms found
                </p>
              </IonText>
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: 0 }}>
                  Create one to get started!
                </p>
              </IonText>
            </div>
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
                          background: STATUS_COLORS[room.status],
                          color: room.status === 'waiting' ? '#fff' : '#0a1628',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {STATUS_LABELS[room.status]}
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
                          onClick={() => handleJoin(room.id, room.name, room.betAmount, opponentName)}
                          loading={joiningId === room.id}
                          expand="block"
                          style={{ flex: 1, margin: 0 } as React.CSSProperties}
                        >
                          <IonIcon icon={enterOutline} style={{ marginRight: '6px', fontSize: '16px' }} />
                          Join
                        </SovereignPrimaryButton>
                      )}
                      {canSpectate && (
                        <SovereignSecondaryButton
                          onClick={() => handleSpectate(room.id, room.name, room.betAmount)}
                          loading={spectatingId === room.id}
                          expand="block"
                          style={{ flex: 1, margin: 0 } as React.CSSProperties}
                        >
                          <IonIcon icon={eyeOutline} style={{ marginRight: '6px', fontSize: '16px' }} />
                          Watch
                        </SovereignSecondaryButton>
                      )}
                      {!canJoin && !canSpectate && room.status !== 'finished' && (
                        <IonText>
                          <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>Full</span>
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
              <IonTitle style={{ color: 'var(--sovereign-text)', fontWeight: '700' }}>Create Room</IonTitle>
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
                    ROOM NAME
                  </label>
                </IonText>
                <IonInput
                  value={createName}
                  onIonInput={(e) => setCreateName(e.detail.value ?? '')}
                  placeholder="Enter room name"
                  maxlength={40}
                  style={{
                    '--background': 'var(--sovereign-bg)',
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
                    BET AMOUNT (min ${minBetNum})
                  </label>
                </IonText>
                <IonInput
                  type="number"
                  value={createBet}
                  onIonInput={(e) => setCreateBet(parseFloat(e.detail.value ?? '0') || 0)}
                  min={minBetNum}
                  max={userBalanceNum}
                  step={0.01}
                  style={{
                    '--background': 'var(--sovereign-bg)',
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
                    Your balance: ${userBalanceNum.toFixed(2)}
                  </p>
                </IonText>
              </div>

              {/* Player Limit */}
              <div style={{ marginBottom: '28px' }}>
                <IonText>
                  <label style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    PLAYER LIMIT
                  </label>
                </IonText>
                <IonSelect
                  value={createLimit}
                  onIonChange={(e) => setCreateLimit(Number(e.detail.value))}
                  interface="popover"
                  style={{
                    '--background': 'var(--sovereign-bg)',
                    '--color': 'var(--sovereign-text)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    width: '100%',
                  } as React.CSSProperties}
                >
                  <IonSelectOption value={2}>2 Players</IonSelectOption>
                  <IonSelectOption value={4}>4 Players</IonSelectOption>
                </IonSelect>
              </div>

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

              <SovereignPrimaryButton onClick={handleCreate} loading={createLoading} expand="block">
                Create Room
              </SovereignPrimaryButton>

              <div style={{ height: '12px' }} />

              <SovereignSecondaryButton onClick={() => setShowCreateDialog(false)} expand="block">
                Cancel
              </SovereignSecondaryButton>
            </div>
          </IonContent>
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
