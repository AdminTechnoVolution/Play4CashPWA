interface SeatProps {
  playerId: string;
  username: string;
  cardCount: number;
  isCurrentTurn: boolean;
  isEliminated: boolean;
  hasUno: boolean;
  isOffender: boolean;
  canChallenge: boolean;
  onChallenge?: () => void;
  challengeLabel: string;
  unoLabel: string;
}

function Seat(p: SeatProps) {
  const initials = (p.username || '?').slice(0, 2).toUpperCase();
  return (
    <div
      className={[
        'uno-seat',
        p.isCurrentTurn ? 'uno-seat--current' : '',
        p.isEliminated ? 'uno-seat--eliminated' : '',
      ].join(' ')}
    >
      <div className="uno-seat__avatar">{initials}</div>
      <div className="uno-seat__name">{p.username || p.playerId}</div>
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
 * Renders all opponents (the current player is excluded — their hand renders separately
 * via `UnoHand`). Highlights the active turn, marks UNO holders, and exposes a "challenge"
 * pulsing button on any opponent currently in the miss-window.
 */
export default function UnoSeats(p: UnoSeatsProps) {
  const opponents = p.playerOrder.filter((id) => id !== p.myUserId);
  return (
    <div className="uno-seats" aria-label="opponents">
      {opponents.map((id) => (
        <Seat
          key={id}
          playerId={id}
          username={p.usernames[id] || ''}
          cardCount={p.handCount[id] ?? 0}
          isCurrentTurn={p.currentTurnPlayerId === id}
          isEliminated={p.eliminatedPlayers.includes(id)}
          hasUno={p.unoCalled.includes(id)}
          isOffender={p.pendingUnoOffender === id}
          canChallenge={p.pendingUnoOffender === id}
          onChallenge={() => p.onChallenge(id)}
          challengeLabel={p.challengeLabel}
          unoLabel={p.unoLabel}
        />
      ))}
    </div>
  );
}
