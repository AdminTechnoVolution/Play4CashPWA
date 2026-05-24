import React from 'react';
import { IonIcon, IonText } from '@ionic/react';
import {
  trophyOutline,
  timeOutline,
  peopleOutline,
  cashOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import type { TournamentSummary } from '../../../data/models/ApiModels';
import { officialRemainingMs, useTournamentsStore } from '../../../store/tournamentsStore';
import { formatUSD } from '../../../util/formatCurrency';
import { useT } from '../../../i18n/translations';
import {
  canRegisterForTournament,
  formatTournamentCountdown,
  gameAssetCode,
  isUserRegistered,
  tournamentStatusKey,
  tournamentUrgency,
} from '../../../util/tournamentUtils';

type TournamentCardProps = {
  tournament: TournamentSummary;
  onClick?: () => void;
  compact?: boolean;
  showRegisteredBadge?: boolean;
};

export default function TournamentCard({
  tournament,
  onClick,
  compact = false,
  showRegisteredBadge = true,
}: TournamentCardProps) {
  const t = useT();
  const clockTick = useTournamentsStore((s) => s.clockTick);
  void clockTick;
  const remaining = officialRemainingMs(tournament);
  const urgency = tournamentUrgency(remaining);
  const registered = isUserRegistered(tournament);
  const asset = gameAssetCode(tournament.gameSocketCode);
  const fillPct = Math.min(100, Math.round((tournament.registeredCount / tournament.maxPlayers) * 100));

  const urgencyColor =
    urgency === 'live'
      ? '#4caf50'
      : urgency === 'imminent'
        ? '#ff9800'
        : urgency === 'soon'
          ? '#e8c96b'
          : 'var(--sovereign-gold)';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '18px',
        border: `1px solid ${registered ? 'rgba(76,175,80,0.45)' : 'var(--sovereign-border)'}`,
        background: 'linear-gradient(145deg, rgba(18,28,48,0.98) 0%, rgba(10,18,32,0.98) 100%)',
        boxShadow: urgency === 'imminent' || urgency === 'live'
          ? `0 0 24px ${urgencyColor}33`
          : '0 8px 24px rgba(0,0,0,0.35)',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: compact ? 0 : '14px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.22,
          backgroundImage: `url(/${asset}/bg_${asset}_home_card.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${urgencyColor}, transparent)`,
        }}
      />

      <div style={{ position: 'relative', padding: compact ? '14px 16px' : '18px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div
            style={{
              width: compact ? '40px' : '48px',
              height: compact ? '40px' : '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(232,201,107,0.25)',
            }}
          >
            <IonIcon icon={trophyOutline} style={{ color: '#1a1200', fontSize: compact ? '22px' : '26px' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <IonText>
              <h3
                style={{
                  margin: 0,
                  color: 'var(--sovereign-text)',
                  fontSize: compact ? '15px' : '17px',
                  fontWeight: 800,
                  lineHeight: 1.25,
                }}
              >
                {tournament.title}
              </h3>
            </IonText>
            {!compact && tournament.description && (
              <IonText>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--sovereign-text-muted)',
                    fontSize: '13px',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {tournament.description}
                </p>
              </IonText>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(201,168,76,0.15)',
              color: 'var(--sovereign-gold)',
              border: '1px solid rgba(201,168,76,0.25)',
            }}
          >
            {t(tournamentStatusKey(tournament.status))}
          </span>
          {showRegisteredBadge && registered && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(76,175,80,0.15)',
                color: '#81c784',
                border: '1px solid rgba(76,175,80,0.35)',
              }}
            >
              <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '14px' }} />
              {t('tournament_registered_badge')}
            </span>
          )}
          {canRegisterForTournament(tournament) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(33,150,243,0.12)',
                color: '#64b5f6',
                border: '1px solid rgba(33,150,243,0.25)',
              }}
            >
              {t('tournament_open_spots')}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <StatPill icon={timeOutline} label={t('tournament_countdown')} value={formatTournamentCountdown(remaining)} accent={urgencyColor} />
          <StatPill icon={cashOutline} label={t('tournament_buy_in')} value={formatUSD(tournament.buyIn)} />
          <StatPill icon={peopleOutline} label={t('tournament_slots')} value={`${tournament.registeredCount}/${tournament.maxPlayers}`} />
          <StatPill icon={trophyOutline} label={t('tournament_prize_pool')} value={formatUSD(tournament.grossPrizePool)} />
        </div>

        <div style={{ marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px' }}>{t('tournament_fill')}</span>
            <span style={{ color: 'var(--sovereign-gold)', fontSize: '11px', fontWeight: 700 }}>{fillPct}%</span>
          </div>
          <div
            style={{
              height: '6px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${fillPct}%`,
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #b8922a, #e8c96b)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
        <IonIcon icon={icon} style={{ fontSize: '13px', color: accent ?? 'var(--sovereign-text-muted)' }} />
        <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '10px', fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ color: accent ?? 'var(--sovereign-text)', fontSize: '13px', fontWeight: 800 }}>{value}</span>
    </div>
  );
}
