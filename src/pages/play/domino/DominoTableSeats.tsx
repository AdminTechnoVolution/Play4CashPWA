import type { ReactNode } from 'react';
import { getSeatLayout } from '../uno/unoSeatLayout';
import './dominoSeats.css';

export interface DominoSeatPlayer {
  name: string;
  tileCount: number;
  isSelf: boolean;
  isCurrentTurn: boolean;
}

interface DominoTableSeatsProps {
  players: DominoSeatPlayer[];
  children: ReactNode;
}

/** UNO-style perimeter seating around the domino board using the authoritative players. */
export default function DominoTableSeats({ players, children }: DominoTableSeatsProps) {
  const slots = getSeatLayout(players.length);

  return (
    <div className="domino-table-seats" data-player-count={players.length}>
      <div className="domino-table-seats__board">{children}</div>
      <div className="domino-table-seats__ring" aria-label="players">
        {players.map((player, index) => {
          const slot = slots[index] ?? slots[0];
          const initials = player.name.slice(0, 2).toUpperCase();
          return (
            <div
              key={`${player.isSelf ? 'self' : 'opponent'}-${index}-${player.name}`}
              className={[
                'domino-table-seat',
                player.isSelf ? 'domino-table-seat--self' : '',
                player.isCurrentTurn ? 'domino-table-seat--current' : '',
              ].join(' ')}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              data-seat-index={index}
              data-self={player.isSelf ? 'true' : 'false'}
            >
              <div className="domino-table-seat__avatar" aria-hidden>{initials}</div>
              <div className="domino-table-seat__name" title={player.name}>{player.name}</div>
              <div className="domino-table-seat__tiles" aria-label={`${player.tileCount} tiles`}>
                <span className="domino-table-seat__mini-tile" aria-hidden />
                <span>×{player.tileCount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
