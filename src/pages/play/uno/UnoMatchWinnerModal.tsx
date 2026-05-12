interface UnoMatchWinnerModalProps {
  open: boolean;
  isWinner: boolean;
  winnerUsername: string;
  prize: number;
  finalScores: Record<string, number>;
  usernames: Record<string, string>;
  playerOrder: string[];
  /** All resolved i18n labels passed in by parent. */
  titleWinLabel: string;
  titleLoseLabel: string;
  prizeLabel: string;
  finalScoresLabel: string;
  closeLabel: string;
  onClose: () => void;
}

/**
 * Match-end celebration modal. Different headline for winner vs loser, displays prize
 * amount when applicable, and a final scoreboard so everyone sees their final standing.
 */
export default function UnoMatchWinnerModal(p: UnoMatchWinnerModalProps) {
  if (!p.open) return null;

  const sorted = [...p.playerOrder].sort(
    (a, b) => (p.finalScores[b] ?? 0) - (p.finalScores[a] ?? 0),
  );

  return (
    <div className="uno-match-winner" role="dialog" aria-label={p.isWinner ? p.titleWinLabel : p.titleLoseLabel}>
      <div className={`uno-match-winner__panel ${p.isWinner ? 'uno-match-winner__panel--win' : ''}`}>
        <div className="uno-match-winner__crown" aria-hidden>
          {p.isWinner ? '🏆' : '🎯'}
        </div>
        <h2 className="uno-match-winner__title">
          {p.isWinner ? p.titleWinLabel : p.titleLoseLabel.replace('{{username}}', p.winnerUsername)}
        </h2>

        {p.isWinner && p.prize > 0 && (
          <div className="uno-match-winner__prize">
            {p.prizeLabel.replace('{{amount}}', `$${p.prize.toFixed(2)}`)}
          </div>
        )}

        <div className="uno-match-winner__final-scores-title">{p.finalScoresLabel}</div>
        <ul className="uno-match-winner__list">
          {sorted.map((id, idx) => (
            <li key={id} className={`uno-match-winner__row ${idx === 0 ? 'uno-match-winner__row--top' : ''}`}>
              <span className="uno-match-winner__rank">{idx + 1}.</span>
              <span className="uno-match-winner__name">{p.usernames[id] || id}</span>
              <span className="uno-match-winner__score">{p.finalScores[id] ?? 0}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="uno-match-winner__close" onClick={p.onClose}>
          {p.closeLabel}
        </button>
      </div>
    </div>
  );
}
