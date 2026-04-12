import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/translations';
import { thresholdSeconds, triggerTimeoutWarning } from '../../../ui/game/turnTimeoutAlarm';

interface TurnTimerProps {
  seconds: number;
  totalSeconds?: number;
  isMyTurn: boolean;
  onTimeout: () => void;
  /** Spectator mode: name of the player whose turn it is now */
  turnPlayerName?: string;
  /** Opponent / current other player name — shown when it is not your turn (2-player and similar). */
  otherPlayerName?: string;
  /** Change this value to force-reset the countdown (use shot key for spectators) */
  resetKey?: string | number;
  /**
   * When true, remaining time only follows `seconds` from the parent (Zustand store ticks).
   * Use for chess / halma / domino players — avoids double local countdown.
   */
  disableLocalTick?: boolean;
  /**
   * Sound + vibration in the last 20% of the turn (Android TurnTimeoutAlarm).
   * Set false when the game store handles alarms on its own tick (chess, halma, domino).
   */
  timeoutAlarm?: boolean;
}

const TurnTimer: React.FC<TurnTimerProps> = ({
  seconds,
  totalSeconds,
  isMyTurn,
  onTimeout,
  turnPlayerName,
  otherPlayerName,
  resetKey,
  disableLocalTick = false,
  timeoutAlarm = true,
}) => {
  const t = useT();
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const capRef = useRef(0);
  const warnedRef = useRef(false);
  const prevRemForAlarm = useRef(0);
  const prevIsMyTurnRef = useRef(isMyTurn);
  const prevResetKeyRef = useRef(resetKey);
  const prevSecondsPropRef = useRef(seconds);
  const isFirstMountRef = useRef(true);

  const isSpectatorMode = turnPlayerName !== undefined;

  const timeSuffix = `${remaining}s`;
  const turnLabelLine = (() => {
    if (isSpectatorMode) {
      const name = (turnPlayerName || '').trim() || t('game_turn_timer_opponent_fallback');
      return t('game_turn_timer_spectator').replace('%1$s', name).replace('%2$s', timeSuffix);
    }
    if (isMyTurn) {
      return t('game_turn_timer_yours').replace('%s', timeSuffix);
    }
    const other = (otherPlayerName || '').trim() || t('game_turn_timer_opponent_fallback');
    return t('game_turn_timer_opponent').replace('%1$s', other).replace('%2$s', timeSuffix);
  })();

  // ── Sync from props + new-turn segment (matches Android TurnTimeoutAlarm.onCountdownStart) ──
  useEffect(() => {
    let newSegment = isFirstMountRef.current;
    if (isFirstMountRef.current) isFirstMountRef.current = false;

    if (!newSegment) {
      if (prevIsMyTurnRef.current !== isMyTurn || prevResetKeyRef.current !== resetKey) newSegment = true;
      else if (seconds > prevSecondsPropRef.current) newSegment = true;
    }

    prevIsMyTurnRef.current = isMyTurn;
    prevResetKeyRef.current = resetKey;
    prevSecondsPropRef.current = seconds;

    const cap = totalSeconds && totalSeconds > 0 ? totalSeconds : seconds;
    const eligible = isMyTurn && !isSpectatorMode;

    if (newSegment) {
      warnedRef.current = false;
      capRef.current = cap;
      prevRemForAlarm.current = seconds;
      if (timeoutAlarm) {
        const th = thresholdSeconds(cap);
        if (eligible && cap > 0 && cap <= th) {
          triggerTimeoutWarning();
          warnedRef.current = true;
        }
      }
    }

    setRemaining(seconds);
  }, [seconds, isMyTurn, resetKey, totalSeconds, isSpectatorMode, timeoutAlarm]);

  // ── Local 1s tick (Battleship; domino spectators if store does not tick) ──
  useEffect(() => {
    if (disableLocalTick) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

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
  }, [seconds, isMyTurn, resetKey, disableLocalTick]);

  // ── Last 20%: sound + vibration (Battleship / domino spectator — store handles chess/halma/domino players) ──
  useEffect(() => {
    if (!timeoutAlarm) {
      prevRemForAlarm.current = remaining;
      return;
    }
    const eligible = isMyTurn && !isSpectatorMode;
    if (!eligible) {
      prevRemForAlarm.current = remaining;
      return;
    }
    if (warnedRef.current) {
      prevRemForAlarm.current = remaining;
      return;
    }

    const cap = capRef.current;
    const th = thresholdSeconds(cap);
    const prev = prevRemForAlarm.current;
    if (cap > th && prev > th && remaining <= th) {
      triggerTimeoutWarning();
      warnedRef.current = true;
    }
    prevRemForAlarm.current = remaining;
  }, [remaining, isMyTurn, isSpectatorMode, timeoutAlarm]);

  /** Countdown is always “live” in player mode; spectator only when we know whose turn it is. */
  const isActive = isSpectatorMode ? !!turnPlayerName?.trim() : true;
  const barDen =
    totalSeconds && totalSeconds > 0
      ? totalSeconds
      : Math.max(capRef.current, seconds, 1);
  const percentage = barDen > 0 ? (remaining / barDen) * 100 : 0;
  const isLow = remaining <= 5 && isActive;
  const barColor = isActive
    ? isLow ? '#cf6679' : 'var(--sovereign-gold)'
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
            fontSize: '13px',
            color: isLow ? '#cf6679' : isActive ? 'var(--sovereign-gold)' : 'var(--sovereign-text-muted)',
            fontWeight: '700',
            letterSpacing: '0.02em',
            animation: isLow ? 'pulse 0.8s ease-in-out infinite' : 'none',
            flex: 1,
            minWidth: 0,
          }}
        >
          {turnLabelLine}
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
            width: `${Math.min(100, Math.max(0, percentage))}%`,
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
