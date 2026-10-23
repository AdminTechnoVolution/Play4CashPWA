import { useCallback, useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiRepository } from '../../data/network/ApiRepository';
import type { RoomResponse } from '../../data/models/ApiModels';
import { saveGameContext, savePlayContext } from '../../util/routingStorage';
import { useT } from '../../i18n/translations';

/**
 * Phase C: surfaces a "you have a match in progress" affordance when the user
 * already participates in a `waiting`/`started` room. Without this, a player who
 * closed the tab mid-match (or switched devices) lands on the dashboard and has
 * to manually find their way back into the room.
 *
 * UX choices (intentional):
 *  - Non-intrusive `IonToast` rather than a blocking modal — the user can keep
 *    browsing the dashboard if they want.
 *  - Waiting rooms remain dismissible, while a started room is authoritative
 *    and is resumed automatically on boot, focus, or visibility restoration.
 *  - Suppressed when the user is already inside `/play/*` — we don't want to
 *    nag them while they're playing.
 */
export default function ActiveRoomBanner() {
  const { user, authHydrated } = useAuthStore();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState<RoomResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const enterRoom = useCallback(
    (room: Awaited<ReturnType<typeof apiRepository.getActiveRoom>>, replace = false) => {
      if (!room?.socketCode) return;
      const ownIndex = room.players.findIndex((player) => player.id === user?.id);
      const opponent = room.players.find((player) => player.id !== user?.id);
      savePlayContext({
        roomId: room.id,
        betAmount: room.betAmount,
        roomName: room.name || '',
        opponentName: opponent?.username || '',
        hasOpponent: room.players.length > 1,
        isSpectator: false,
        isPlayer1: ownIndex === 0,
      });
      if (room.gameId) {
        saveGameContext({ gameId: room.gameId, gameName: room.name || '' });
      }
      setDismissed(true);
      navigate(`/play/${room.socketCode}`, { replace });
    },
    [navigate, user?.id],
  );

  useEffect(() => {
    if (!authHydrated || !user) return;
    let cancelled = false;
    const checkActiveRoom = async () => {
      try {
        const room = await apiRepository.getActiveRoom();
        if (cancelled) return;
        if (!room || !room.socketCode) {
          setActive(null);
          return;
        }
        const status = room.status.trim().toLowerCase();
        if (status !== 'waiting' && status !== 'started') {
          setActive(null);
          return;
        }
        if (status === 'started' && !location.pathname.startsWith('/play/')) {
          enterRoom(room, true);
          return;
        }
        setActive(room);
      } catch {
        // A later focus/visibility transition retries transient failures.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkActiveRoom();
    };
    void checkActiveRoom();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkActiveRoom);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkActiveRoom);
    };
  }, [authHydrated, enterRoom, location.pathname, user]);

  // Suppress while inside a play screen (the player is already where they need to be).
  const inPlay = location.pathname.startsWith('/play/');

  if (!active || dismissed || inPlay) return null;

  const handleResume = () => {
    enterRoom(active, false);
  };

  return (
    <IonToast
      isOpen
      message={t('active_room_banner_message')}
      position="top"
      duration={0}
      color="warning"
      buttons={[
        {
          text: t('active_room_banner_resume'),
          handler: handleResume,
        },
        {
          text: t('active_room_banner_dismiss'),
          role: 'cancel',
          handler: () => setDismissed(true),
        },
      ]}
    />
  );
}
