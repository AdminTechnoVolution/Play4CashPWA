import { IonButton, IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, eyeOutline, playCircleOutline, trophyOutline } from 'ionicons/icons';
import { useMemo } from 'react';
import type { TournamentBracketMatch, TournamentBracketResponse, TournamentSummary } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';
import {
  BRACKET_MATCH_H,
  BRACKET_MATCH_W,
  buildBracketTreeLayout,
  connectorPath,
  type BracketTreeMatchNode,
} from '../../../util/bracketTreeLayout';
import {
  canJoinBracketMatch,
  canSpectateTournamentMatch,
  formatTournamentMatchStatus,
  isMyBracketMatch,
} from '../../../util/tournamentUtils';

type Props = {
  bracket: TournamentBracketResponse;
  tournament: TournamentSummary | null;
  userId?: string;
  onJoinMatch: (match: TournamentBracketMatch, roomId: string) => void;
  onSpectate: (match: TournamentBracketMatch) => void;
  joiningRoomId?: string | null;
  spectatingRoomId?: string | null;
};

function TreeMatchNode({
  node,
  userId,
  tournament,
  onJoinMatch,
  onSpectate,
  joiningRoomId,
  spectatingRoomId,
  t,
}: {
  node: BracketTreeMatchNode;
  userId?: string;
  tournament: TournamentSummary | null;
  onJoinMatch: (match: TournamentBracketMatch, roomId: string) => void;
  onSpectate: (match: TournamentBracketMatch) => void;
  joiningRoomId?: string | null;
  spectatingRoomId?: string | null;
  t: (key: string) => string;
}) {
  const { match } = node;
  const canJoin = canJoinBracketMatch(match, tournament, userId);
  const joinRoomId = canJoin ? tournament?.myActiveMatch?.roomId ?? null : null;
  const canWatch = !canJoin && canSpectateTournamentMatch(match.status, match.roomId);
  const isMine = isMyBracketMatch(match, userId);
  const live = match.status === 'ready' || match.status === 'started';
  const finished = match.status === 'finished' || match.status === 'forfeited';

  const playerA = match.playerA?.username || t('tournament_bracket_tbd');
  const playerB = match.playerB?.username || t('tournament_bracket_tbd');
  const winnerA = !!match.winnerUserId && match.winnerUserId === match.playerA?.userId;
  const winnerB = !!match.winnerUserId && match.winnerUserId === match.playerB?.userId;

  const rowStyle = (isWinner: boolean, isMe: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: isWinner || isMe ? 800 : 600,
    color: isWinner ? '#a5d6a7' : isMe ? 'var(--sovereign-gold)' : 'var(--sovereign-text)',
    background: isWinner ? 'rgba(129,199,132,0.12)' : 'transparent',
    borderRadius: 4,
    minHeight: 22,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y - BRACKET_MATCH_H / 2,
        width: BRACKET_MATCH_W,
        height: BRACKET_MATCH_H,
        borderRadius: 10,
        border: isMine
          ? '1px solid rgba(232,201,107,0.55)'
          : live
            ? '1px solid rgba(76,175,80,0.5)'
            : '1px solid rgba(255,255,255,0.12)',
        background: isMine ? 'rgba(232,201,107,0.1)' : 'rgba(10,22,40,0.92)',
        boxShadow: live ? '0 0 12px rgba(76,175,80,0.15)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div style={rowStyle(winnerA, !!userId && match.playerA?.userId === userId)}>
        {winnerA && <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 12, flexShrink: 0 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerA}</span>
      </div>
      <div
        style={{
          height: 1,
          margin: '0 6px',
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      <div style={rowStyle(winnerB, !!userId && match.playerB?.userId === userId)}>
        {winnerB && <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 12, flexShrink: 0 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerB}</span>
      </div>

      {(canJoin || canWatch) && (
        <div style={{ position: 'absolute', right: 2, top: 2, display: 'flex', gap: 2 }}>
          {canJoin && joinRoomId && (
            <button
              type="button"
              aria-label={t('tournament_go_to_match')}
              disabled={joiningRoomId === joinRoomId}
              onClick={() => onJoinMatch(match, joinRoomId)}
              style={{
                border: 'none',
                background: 'rgba(76,175,80,0.25)',
                borderRadius: 6,
                padding: 4,
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              <IonIcon icon={playCircleOutline} style={{ fontSize: 14, color: '#81c784' }} />
            </button>
          )}
          {canWatch && match.roomId && (
            <button
              type="button"
              aria-label={t('tournament_spectate_match')}
              disabled={spectatingRoomId === match.roomId}
              onClick={() => onSpectate(match)}
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: 4,
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              <IonIcon icon={eyeOutline} style={{ fontSize: 14, color: 'var(--sovereign-text-muted)' }} />
            </button>
          )}
        </div>
      )}

      {live && !canJoin && !canWatch && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 6,
            fontSize: 9,
            fontWeight: 700,
            color: '#81c784',
            textTransform: 'uppercase',
          }}
        >
          {formatTournamentMatchStatus(match.status, t)}
        </div>
      )}

      {finished && !match.winnerUserId && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 6,
            fontSize: 9,
            color: 'var(--sovereign-text-muted)',
          }}
        >
          {formatTournamentMatchStatus(match.status, t)}
        </div>
      )}
    </div>
  );
}

export default function TournamentBracketTreeView({
  bracket,
  tournament,
  userId,
  onJoinMatch,
  onSpectate,
  joiningRoomId,
  spectatingRoomId,
}: Props) {
  const t = useT();
  const layout = useMemo(() => buildBracketTreeLayout(bracket), [bracket]);

  const championY = layout.height - 56;

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        padding: '8px 0 16px',
        margin: '0 -4px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: Math.max(layout.width, 320),
          height: layout.height,
          minWidth: '100%',
        }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden
        >
          {layout.sections.map((section) =>
            section.connectors.map((c, i) => (
              <path
                key={`${section.id}-c-${i}`}
                d={connectorPath({
                  x1: section.offsetX + c.x1,
                  y1: section.offsetY + c.y1,
                  x2: section.offsetX + c.x2,
                  y2: section.offsetY + c.y2,
                })}
                fill="none"
                stroke="rgba(232,201,107,0.35)"
                strokeWidth={2}
              />
            )),
          )}
          {layout.bridgeConnectors.map((c, i) => (
            <path
              key={`bridge-${i}`}
              d={connectorPath(c)}
              fill="none"
              stroke="rgba(129,199,132,0.45)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ))}
        </svg>

        {layout.sections.map((section) => (
          <div key={section.id}>
            <div
              style={{
                position: 'absolute',
                left: section.offsetX,
                top: section.offsetY - 22,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--sovereign-gold)',
              }}
            >
              {section.labelKey && section.labelArg != null
                ? t(section.labelKey).replace('%d', String(section.labelArg))
                : section.labelKey
                  ? t(section.labelKey)
                  : section.label}
            </div>
            <div
              style={{
                position: 'absolute',
                left: section.offsetX,
                top: section.offsetY,
                width: section.width,
                height: section.height,
              }}
            >
              {section.nodes.map((node) => (
                <TreeMatchNode
                  key={node.match.id}
                  node={node}
                  userId={userId}
                  tournament={tournament}
                  onJoinMatch={onJoinMatch}
                  onSpectate={onSpectate}
                  joiningRoomId={joiningRoomId}
                  spectatingRoomId={spectatingRoomId}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}

        {layout.championUserId && layout.championName && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: championY,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              minWidth: 160,
            }}
          >
            <div
              style={{
                width: 2,
                height: 20,
                background: 'linear-gradient(180deg, rgba(232,201,107,0.5), rgba(232,201,107,0.1))',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 14,
                border: '1px solid rgba(232,201,107,0.5)',
                background: 'linear-gradient(135deg, rgba(232,201,107,0.18), rgba(10,22,40,0.95))',
                boxShadow: '0 4px 20px rgba(232,201,107,0.15)',
              }}
            >
              <IonIcon icon={trophyOutline} style={{ fontSize: 22, color: 'var(--sovereign-gold)' }} />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--sovereign-gold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('tournament_bracket_champion')}
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--sovereign-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 140,
                  }}
                >
                  {layout.championName}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <p
        style={{
          margin: '12px 16px 0',
          fontSize: 11,
          color: 'var(--sovereign-text-muted)',
          textAlign: 'center',
        }}
      >
        {t('tournament_bracket_tree_hint')}
      </p>
    </div>
  );
}
