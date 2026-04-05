import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/translations';

interface TurnTimerProps {
  seconds: number;
  isMyTurn: boolean;
  onTimeout: () => void;
}

const TurnTimer: React.FC<TurnTimerProps> = ({ seconds, isMyTurn, onTimeout }) => {
  const t = useT();
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds, isMyTurn]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [seconds, isMyTurn]);

  const percentage = (remaining / seconds) * 100;
  const isLow = remaining <= 5 && isMyTurn;
  const barColor = isMyTurn
    ? isLow
      ? '#cf6679'
      : 'var(--sovereign-gold)'
    : 'rgba(138, 155, 191, 0.5)';

  return (
    <div
      style={{
        padding: '6px 16px',
        background: 'var(--sovereign-surface)',
        borderBottom: '1px solid var(--sovereign-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: isMyTurn ? 'var(--sovereign-gold)' : 'var(--sovereign-text-muted)',
            fontWeight: '600',
          }}
        >
          {t('APP.GAME.TURN_TIMER')}
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: '700',
            color: isLow ? '#cf6679' : isMyTurn ? 'var(--sovereign-gold)' : 'var(--sovereign-text-muted)',
            animation: isLow ? 'pulse 0.8s ease-in-out infinite' : 'none',
          }}
        >
          {remaining}s
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 1s linear, background 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};

export default TurnTimer;
