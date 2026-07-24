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
      <div className="domino-table-seats__board" data-region="domino-board">{children}</div>
      <div
        className="domino-table-seats__ring"
        aria-label="players"
        role="list"
        data-region="player-perimeter"
      >
        {players.map((player, index) => {
          const slot = slots[index] ?? slots[0];
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
              role="listitem"
              aria-current={player.isCurrentTurn ? 'true' : undefined}
              aria-label={`${player.name}, ${player.tileCount} tiles${player.isCurrentTurn ? ', current turn' : ''}`}
            >
              {player.isCurrentTurn && (
                <span className="domino-table-seat__turn" aria-hidden>▶</span>
              )}
              <div className="domino-table-seat__name" title={player.name}>{player.name}</div>
              <span className="domino-table-seat__tiles" aria-hidden>×{player.tileCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
