import { orderPlayersForTable, getSeatLayout } from './unoSeatLayout';
import { useT } from '../../../i18n/translations';

interface SeatProps {
  username: string;
  cardCount: number;
  isCurrentTurn: boolean;
  isEliminated: boolean;
  isSelf: boolean;
  hasUno: boolean;
  isOffender: boolean;
  canChallenge: boolean;
  onChallenge?: () => void;
  challengeLabel: string;
  unoLabel: string;
  slotX: number;
  slotY: number;
}

function Seat(p: SeatProps) {
  const initials = p.username.slice(0, 2).toUpperCase();
  return (
    <div
      className={[
        'uno-seat',
        p.isSelf ? 'uno-seat--self' : '',
        p.isCurrentTurn ? 'uno-seat--current' : '',
        p.isEliminated ? 'uno-seat--eliminated' : '',
      ].join(' ')}
      style={{ left: `${p.slotX}%`, top: `${p.slotY}%` }}
    >
      <div className="uno-seat__avatar">{initials}</div>
      <div className="uno-seat__name">{p.username}</div>
      <div className="uno-seat__cards" aria-label={`${p.cardCount} cards`}>
        <span className="uno-seat__minicard" />
        <span>×{p.cardCount}</span>
      </div>
      {p.hasUno && <div className="uno-seat__badge-uno">{p.unoLabel}</div>}
      {p.isOffender && p.canChallenge && (
        <button
          type="button"
          className="uno-seat__badge-miss"
          onClick={p.onChallenge}
          aria-label={p.challengeLabel}
        >
          {p.challengeLabel}
        </button>
      )}
    </div>
  );
}

interface UnoSeatsProps {
  playerOrder: string[];
  myUserId: string;
  usernames: Record<string, string>;
  handCount: Record<string, number>;
  eliminatedPlayers: string[];
  unoCalled: string[];
  pendingUnoOffender: string | null;
  currentTurnPlayerId: string;
  onChallenge: (offenderId: string) => void;
  challengeLabel: string;
  unoLabel: string;
}

/**
 * Renders every seated player around the felt (including the local user).
 * Positions follow `unoSeatLayout` rules for 2–10 players.
 */
export default function UnoSeats(p: UnoSeatsProps) {
  const t = useT();
  const ordered = orderPlayersForTable(p.playerOrder, p.myUserId);
  const slots = getSeatLayout(ordered.length);

  return (
    <div className="uno-seats" aria-label="players">
      {ordered.map((id, index) => {
        const slot = slots[index] ?? slots[0];
        const isSelf = id === p.myUserId;
        return (
          <Seat
            key={id}
            username={
              p.usernames[id]?.trim() ||
              (isSelf
                ? t('multiplayer_you')
                : t('multiplayer_opponent_number').replace('%d', String(index)))
            }
            cardCount={p.handCount[id] ?? 0}
            isCurrentTurn={p.currentTurnPlayerId === id}
            isEliminated={p.eliminatedPlayers.includes(id)}
            isSelf={isSelf}
            hasUno={p.unoCalled.includes(id)}
            isOffender={p.pendingUnoOffender === id}
            canChallenge={!isSelf && p.pendingUnoOffender === id}
            onChallenge={() => p.onChallenge(id)}
            challengeLabel={p.challengeLabel}
            unoLabel={p.unoLabel}
            slotX={slot.x}
            slotY={slot.y}
          />
        );
      })}
    </div>
  );
}
