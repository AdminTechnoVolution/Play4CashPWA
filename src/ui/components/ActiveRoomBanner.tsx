import { useEffect, useRef, useState } from 'react';
import { IonToast } from '@ionic/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiRepository } from '../../data/network/ApiRepository';
import { savePlayContext } from '../../util/routingStorage';
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
 *  - One-shot per session: once dismissed or tapped, we don't poke again. The
 *    server is still the source of truth (unique partial index) so creating a
 *    new room while one is open is rejected with ERROR_USER_ALREADY_IN_ROOM.
 *  - Suppressed when the user is already inside `/play/*` — we don't want to
 *    nag them while they're playing.
 */
export default function ActiveRoomBanner() {
  const { user, authHydrated } = useAuthStore();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const checkedRef = useRef(false);
  const [active, setActive] = useState<{ id: string; socketCode: string; roomName: string; betAmount: number } | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!authHydrated || !user || checkedRef.current) return;
    checkedRef.current = true;
    (async () => {
      try {
        const room = await apiRepository.getActiveRoom();
        if (!room || !room.socketCode) return;
        setActive({
          id: room.id,
          socketCode: room.socketCode,
          roomName: room.name || '',
          betAmount: room.betAmount || 0,
        });
      } catch {
        // Network glitch: stay silent. Worst case the user finds the room
        // manually; we don't want a noisy error on app boot.
      }
    })();
  }, [authHydrated, user]);

  // Suppress while inside a play screen (the player is already where they need to be).
  const inPlay = location.pathname.startsWith('/play/');

  if (!active || dismissed || inPlay) return null;

  const handleResume = () => {
    savePlayContext({
      roomId: active.id,
      betAmount: active.betAmount,
      roomName: active.roomName,
      opponentName: '',
      hasOpponent: true,
      isSpectator: false,
      isPlayer1: false,
    });
    setDismissed(true);
    navigate(`/play/${active.socketCode}`);
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
