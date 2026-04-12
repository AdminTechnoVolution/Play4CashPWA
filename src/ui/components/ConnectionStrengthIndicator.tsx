import React, { useMemo } from 'react';
import { useNetworkConnection } from '../../hooks/useNetworkConnection';
import { useT } from '../../i18n/translations';

/** 0–4 filled bars from offline / effectiveType (Network Information API). */
function barsFromState(online: boolean, effectiveType: string): number {
  if (!online) return 0;
  const et = effectiveType.toLowerCase();
  if (et === 'slow-2g' || et === '2g') return 1;
  if (et === '3g') return 2;
  if (et === '4g') return 4;
  return 3;
}

function barColor(level: number, filled: boolean): string {
  if (!filled) return 'rgba(255,255,255,0.12)';
  if (level <= 1) return '#ffb74d';
  if (level === 2) return '#c9a84c';
  return '#81c784';
}

export default function ConnectionStrengthIndicator() {
  const t = useT();
  const { online, effectiveType, downlinkMbps, rttMs, saveData } = useNetworkConnection();

  const level = useMemo(() => barsFromState(online, effectiveType), [online, effectiveType]);

  const title = useMemo(() => {
    if (!online) return t('connection_offline');
    const parts: string[] = [];
    if (effectiveType) {
      parts.push(effectiveType.replace(/-/g, ' ').toUpperCase());
    }
    if (downlinkMbps != null) {
      parts.push(t('connection_downlink_label').replace('%s', String(downlinkMbps)));
    }
    if (rttMs != null) {
      parts.push(t('connection_rtt_label').replace('%s', String(rttMs)));
    }
    if (saveData) parts.push(t('connection_save_data_on'));
    if (parts.length === 0) return t('connection_online_meter_unavailable');
    return parts.join(' · ');
  }, [online, effectiveType, downlinkMbps, rttMs, saveData, t]);

  const heights = [5, 8, 11, 14];

  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2,
        height: 16,
        minWidth: 22,
        padding: '0 2px',
        cursor: 'default',
      }}
    >
      {heights.map((h, i) => {
        const filled = i < level;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 1,
              background: barColor(level, filled),
              opacity: filled ? 1 : 0.85,
            }}
          />
        );
      })}
    </div>
  );
}
