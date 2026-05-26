import { IonButton, IonIcon, IonSegment, IonSegmentButton, IonSkeletonText, IonSpinner } from '@ionic/react';
import { checkmarkCircleOutline, eyeOutline, peopleOutline, playCircleOutline, trophyOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import type { TournamentBracketGroup, TournamentBracketMatch, TournamentBracketResponse, TournamentSummary } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';
import {
  bracketHasMatchContent,
  bracketHasVisibleContent,
  canJoinBracketMatch,
  canSpectateTournamentMatch,
  formatTournamentMatchStatus,
  formatTournamentRoundName,
  groupMatchesByRound,
  groupParticipantsFor,
  isMyBracketMatch,
  sortedBracketGroups,
  usernameForUserId,
} from '../../../util/tournamentUtils';
import TournamentBracketTreeView from './TournamentBracketTreeView';

type Props = {
  bracket: TournamentBracketResponse | null;
  tournament: TournamentSummary | null;
  userId?: string;
  loading?: boolean;
  loadFailed?: boolean;
  onJoinMatch: (match: TournamentBracketMatch, roomId: string) => void;
  onSpectate: (match: TournamentBracketMatch) => void;
  joiningRoomId?: string | null;
  spectatingRoomId?: string | null;
};

function PlayerLine({
  name,
  isWinner,
  isMe,
  t,
}: {
  name: string;
  isWinner: boolean;
  isMe: boolean;
  t: (key: string) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
      {isWinner && (
        <IonIcon icon={checkmarkCircleOutline} style={{ color: '#81c784', fontSize: '16px', flexShrink: 0 }} />
      )}
      <span
        style={{
          color: isWinner ? '#a5d6a7' : isMe ? 'var(--sovereign-gold)' : 'var(--sovereign-text)',
          fontWeight: isMe || isWinner ? 800 : 600,
          fontSize: '14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
        {isMe && (
          <span style={{ color: 'var(--sovereign-text-muted)', fontWeight: 600, fontSize: '11px' }}>
            {' '}
            ({t('tournament_bracket_you')})
          </span>
        )}
      </span>
    </div>
  );
}

function MatchCard({
  match,
  tournament,
  userId,
  onJoinMatch,
  onSpectate,
  joiningRoomId,
  spectatingRoomId,
  t,
}: {
  match: TournamentBracketMatch;
  tournament: TournamentSummary | null;
  userId?: string;
  onJoinMatch: (match: TournamentBracketMatch, roomId: string) => void;
  onSpectate: (match: TournamentBracketMatch) => void;
  joiningRoomId?: string | null;
  spectatingRoomId?: string | null;
  t: (key: string) => string;
}) {
  if (match.isBye) return null;

  const canJoin = canJoinBracketMatch(match, tournament, userId);
  const joinRoomId = canJoin ? tournament?.myActiveMatch?.roomId ?? null : null;
  const canWatch = !canJoin && canSpectateTournamentMatch(match.status, match.roomId);
  const isMine = isMyBracketMatch(match, userId);
  const statusLabel = formatTournamentMatchStatus(match.status, t);
  const roundLabel = formatTournamentRoundName(match.roundName, t);
  const live = match.status === 'ready' || match.status === 'started';

  const playerAName = match.playerA?.username || t('tournament_bracket_tbd');
  const playerBName = match.playerB?.username || t('tournament_bracket_tbd');

  return (
    <div
      style={{
        borderRadius: '14px',
        padding: '14px',
        marginBottom: '10px',
        border: isMine
          ? '1px solid rgba(232,201,107,0.45)'
          : live
            ? '1px solid rgba(76,175,80,0.4)'
            : '1px solid rgba(255,255,255,0.08)',
        background: isMine ? 'rgba(232,201,107,0.08)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--sovereign-gold)', textTransform: 'uppercase' }}>
            {roundLabel}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--sovereign-text-muted)' }}>{statusLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {canJoin && joinRoomId && (
            <IonButton
              size="small"
              color="success"
              disabled={joiningRoomId === joinRoomId}
              onClick={() => onJoinMatch(match, joinRoomId)}
            >
              <IonIcon icon={playCircleOutline} slot="start" />
              {t('tournament_go_to_match')}
            </IonButton>
          )}
          {canWatch && match.roomId && (
            <IonButton
              size="small"
              fill="outline"
              disabled={spectatingRoomId === match.roomId}
              onClick={() => onSpectate(match)}
            >
              <IonIcon icon={eyeOutline} slot="start" />
              {t('tournament_spectate_match')}
            </IonButton>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <PlayerLine
          name={playerAName}
          isWinner={!!match.winnerUserId && match.winnerUserId === match.playerA?.userId}
          isMe={!!userId && match.playerA?.userId === userId}
          t={t}
        />
        <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', fontWeight: 700, paddingLeft: '2px' }}>
          vs
        </span>
        <PlayerLine
          name={playerBName}
          isWinner={!!match.winnerUserId && match.winnerUserId === match.playerB?.userId}
          isMe={!!userId && match.playerB?.userId === userId}
          t={t}
        />
      </div>
    </div>
  );
}

function GroupRoster({
  group,
  userId,
  t,
}: {
  group: TournamentBracketGroup;
  userId?: string;
  t: (key: string) => string;
}) {
  const players = groupParticipantsFor(group);
  if (players.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--sovereign-text-muted)' }}>
        {t('tournament_bracket_group_empty')}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {players.map((p) => {
        const isMe = !!userId && p.userId === userId;
        return (
          <div
            key={p.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              border: isMe ? '1px solid rgba(232,201,107,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: isMe ? 'rgba(232,201,107,0.08)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <IonIcon icon={peopleOutline} style={{ fontSize: 16, color: 'var(--sovereign-text-muted)', flexShrink: 0 }} />
              <span
                style={{
                  color: isMe ? 'var(--sovereign-gold)' : 'var(--sovereign-text)',
                  fontWeight: isMe ? 800 : 600,
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.username}
                {isMe && (
                  <span style={{ color: 'var(--sovereign-text-muted)', fontWeight: 600, fontSize: '11px' }}>
                    {' '}
                    ({t('tournament_bracket_you')})
                  </span>
                )}
              </span>
            </div>
            {p.seed != null && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sovereign-text-muted)', flexShrink: 0 }}>
                #{p.seed}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TournamentBracketView({
  bracket,
  tournament,
  userId,
  loading,
  loadFailed,
  onJoinMatch,
  onSpectate,
  joiningRoomId,
  spectatingRoomId,
}: Props) {
  const t = useT();
  const hasMatches = bracketHasMatchContent(bracket);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>(() => (hasMatches ? 'tree' : 'list'));

  useEffect(() => {
    if (bracket && !bracketHasMatchContent(bracket)) {
      setViewMode('list');
    }
  }, [bracket]);

  const groups = bracket ? sortedBracketGroups(bracket) : [];
  const hasContent = bracketHasVisibleContent(bracket);
  const registrationPhase = !!bracket && hasContent && !hasMatches;

  if (loading && !bracket) {
    return (
      <div style={{ padding: '16px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <IonSkeletonText animated style={{ width: '40%', height: '18px', marginBottom: '10px' }} />
            <IonSkeletonText animated style={{ width: '100%', height: '88px', borderRadius: '14px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (loadFailed && !bracket) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--sovereign-text-muted)' }}>
        <IonIcon icon={trophyOutline} style={{ fontSize: '48px', marginBottom: '12px' }} />
        <p style={{ margin: 0 }}>{t('tournament_bracket_error')}</p>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--sovereign-text-muted)' }}>
        <IonIcon icon={trophyOutline} style={{ fontSize: '48px', marginBottom: '12px' }} />
        <p style={{ margin: 0 }}>{t('tournament_bracket_empty')}</p>
      </div>
    );
  }

  const groupSections = groups.map((group) => {
    const matches = bracket.groupMatches
      .filter((m) => m.groupNumber === group.groupNumber)
      .sort((a, b) => (a.roundIndex ?? 0) - (b.roundIndex ?? 0) || (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
    const winnerName = usernameForUserId(bracket, group.winnerUserId);
    return { group, matches, winnerName };
  });

  const finalsRounds = groupMatchesByRound(bracket.finalsMatches);

  return (
    <div
      style={{
        padding: viewMode === 'tree' ? '12px 8px 32px' : '12px 16px 32px',
        maxWidth: viewMode === 'tree' ? 'none' : '640px',
        margin: '0 auto',
      }}
    >
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--sovereign-text-muted)' }}>
          <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: '12px' }}>{t('tournament_bracket_refreshing')}</span>
        </div>
      )}

      {registrationPhase && (
        <p
          style={{
            margin: '0 0 14px',
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(232,201,107,0.08)',
            border: '1px solid rgba(232,201,107,0.25)',
            fontSize: '13px',
            color: 'var(--sovereign-text-muted)',
            lineHeight: 1.45,
          }}
        >
          {t('tournament_bracket_registration_phase')}
        </p>
      )}

      {hasContent && hasMatches && (
        <IonSegment
          value={viewMode}
          onIonChange={(e) => setViewMode((e.detail.value as 'tree' | 'list') ?? 'tree')}
          style={{ marginBottom: '14px', '--background': 'rgba(255,255,255,0.04)' } as React.CSSProperties}
        >
          <IonSegmentButton value="tree">
            <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('tournament_bracket_view_tree')}</span>
          </IonSegmentButton>
          <IonSegmentButton value="list">
            <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('tournament_bracket_view_list')}</span>
          </IonSegmentButton>
        </IonSegment>
      )}

      {!hasContent && (
        <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--sovereign-text-muted)' }}>
          <p style={{ margin: 0 }}>{t('tournament_bracket_empty')}</p>
        </div>
      )}

      {hasContent && hasMatches && viewMode === 'tree' && (
        <TournamentBracketTreeView
          bracket={bracket}
          tournament={tournament}
          userId={userId}
          onJoinMatch={onJoinMatch}
          onSpectate={onSpectate}
          joiningRoomId={joiningRoomId}
          spectatingRoomId={spectatingRoomId}
        />
      )}

      {hasContent && viewMode === 'list' && (
        <>
      {groupSections.map(({ group, matches, winnerName }) => (
        <section key={group.groupNumber} style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              gap: '8px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--sovereign-text)' }}>
              {t('tournament_group_n').replace('%d', String(group.groupNumber))}
            </h2>
            {winnerName && (
              <span style={{ fontSize: '12px', color: '#81c784', fontWeight: 700 }}>
                {t('tournament_bracket_group_winner')}: {winnerName}
              </span>
            )}
          </div>
          {matches.length === 0 ? (
            <GroupRoster group={group} userId={userId} t={t} />
          ) : (
            matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tournament={tournament}
                userId={userId}
                onJoinMatch={onJoinMatch}
                onSpectate={onSpectate}
                joiningRoomId={joiningRoomId}
                spectatingRoomId={spectatingRoomId}
                t={t}
              />
            ))
          )}
        </section>
      ))}

      {finalsRounds.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, color: 'var(--sovereign-text)' }}>
            {t('tournament_finals_phase')}
          </h2>
          {finalsRounds.map((round) => (
            <div key={round.roundIndex} style={{ marginBottom: '16px' }}>
              {finalsRounds.length > 1 && (
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: 'var(--sovereign-gold)' }}>
                  {formatTournamentRoundName(round.roundName, t)}
                </p>
              )}
              {round.matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  tournament={tournament}
                  userId={userId}
                  onJoinMatch={onJoinMatch}
                  onSpectate={onSpectate}
                  joiningRoomId={joiningRoomId}
                  spectatingRoomId={spectatingRoomId}
                  t={t}
                />
              ))}
            </div>
          ))}
        </section>
      )}
        </>
      )}
    </div>
  );
}
