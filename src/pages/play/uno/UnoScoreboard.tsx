interface UnoScoreboardProps {
  playerOrder: string[];
  usernames: Record<string, string>;
  matchScores: Record<string, number>;
  matchTargetScore: number;
  myUserId: string;
  roundNumber: number;
  /** Current between-rounds context. */
  lastRoundWinnerUsername: string | null;
  lastRoundScoreDealt: number;
  countdownSec: number;
  playersReadyForNext: string[];
  onReady: () => void;
  // Labels (i18n already resolved by parent)
  titleLabel: string;
  roundLabel: string;
  pointsLabel: string;
  targetLabel: string;
  readyButtonLabel: string;
  readyConfirmedLabel: string;
  countdownLabel: string;
  winnerOfRoundLabel: string;
}

/**
 * Between-rounds scoreboard. Shows every player with their cumulative score, a progress
 * bar toward the match target, the round-winner banner, a countdown, and a ready button
 * that lets you skip the wait.
 */
export default function UnoScoreboard(p: UnoScoreboardProps) {
  const t = useT();
  const sorted = [...p.playerOrder].sort(
    (a, b) => (p.matchScores[b] ?? 0) - (p.matchScores[a] ?? 0),
  );
  const meReady = p.playersReadyForNext.includes(p.myUserId);

  return (
    <div className="uno-scoreboard" role="dialog" aria-label={p.titleLabel}>
      <div className="uno-scoreboard__panel">
        <h2 className="uno-scoreboard__title">{p.titleLabel}</h2>

        {p.lastRoundWinnerUsername && (
          <div className="uno-scoreboard__round-winner">
            <span className="uno-scoreboard__round-winner-emoji" aria-hidden>
              🏆
            </span>
            <span>
              {p.winnerOfRoundLabel
                .replace('{{username}}', p.lastRoundWinnerUsername)
                .replace('{{score}}', String(p.lastRoundScoreDealt))}
            </span>
          </div>
        )}

        <div className="uno-scoreboard__round-num">
          {p.roundLabel.replace('{{round}}', String(p.roundNumber))}
        </div>

        <ul className="uno-scoreboard__list">
          {sorted.map((id, index) => {
            const score = p.matchScores[id] ?? 0;
            const pct = Math.min(100, (score / Math.max(1, p.matchTargetScore)) * 100);
            const isMe = id === p.myUserId;
            const isReady = p.playersReadyForNext.includes(id);
            return (
              <li
                key={id}
                className={[
                  'uno-scoreboard__row',
                  isMe ? 'uno-scoreboard__row--me' : '',
                  isReady ? 'uno-scoreboard__row--ready' : '',
                ].join(' ')}
              >
                <div className="uno-scoreboard__row-head">
                  <span className="uno-scoreboard__name">
                    {p.usernames[id]?.trim() ||
                      (isMe
                        ? t('multiplayer_you')
                        : t('multiplayer_opponent_number').replace('%d', String(index + 1)))}
                    {isReady && <span className="uno-scoreboard__ready-tick"> ✓</span>}
                  </span>
                  <span className="uno-scoreboard__score">
                    {score} <small>/ {p.matchTargetScore}</small>
                  </span>
                </div>
                <div className="uno-scoreboard__bar">
                  <div className="uno-scoreboard__bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="uno-scoreboard__footer">
          <div className="uno-scoreboard__countdown">
            {p.countdownLabel.replace('{{seconds}}', String(Math.max(0, p.countdownSec)))}
          </div>
          <button
            type="button"
            className="uno-scoreboard__ready-btn"
            onClick={p.onReady}
            disabled={meReady}
          >
            {meReady ? p.readyConfirmedLabel : p.readyButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useT } from '../../../i18n/translations';
