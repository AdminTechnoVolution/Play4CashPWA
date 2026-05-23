import { describe, expect, it } from 'vitest';
import {
  countConnectFourDiscs,
  deriveConnectFourOpponentName,
  isConnectFourResyncOnlyPayload,
  parseConnectFourMoveRevision,
  payloadIndicatesConnectFourPlay,
  resolveConnectFourBoard,
  resolveConnectFourYourTurn,
  shouldApplyConnectFourPlayPayload,
} from './connectFourPayloadLogic';
import type { ConnectFourCell } from '../../../data/models/connectFourModels';

function parseBoard(raw: unknown): ConnectFourCell[][] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => null));
  }
  return raw.map((row) => {
    if (!Array.isArray(row)) return Array(7).fill(null);
    return row.map((c) => (c === 'R' || c === 'Y' ? c : null)) as ConnectFourCell[];
  });
}

describe('connectFourPayloadLogic', () => {
  it('deriveConnectFourOpponentName replaces Waiting placeholder from players roster', () => {
    const name = deriveConnectFourOpponentName(
      'Alice',
      'Bob',
      'user-a',
      [
        { userId: 'user-a', username: 'Alice' },
        { userId: 'user-b', username: 'Bob' },
      ],
      'Waiting',
    );
    expect(name).toBe('Bob');
  });

  it('resolveConnectFourYourTurn preserves prior turn when field absent', () => {
    expect(resolveConnectFourYourTurn({}, true)).toBe(true);
    expect(resolveConnectFourYourTurn({}, false)).toBe(false);
    expect(resolveConnectFourYourTurn({ yourTurn: true }, false)).toBe(true);
  });

  it('resolveConnectFourBoard preserves prior board when board absent', () => {
    const prior = parseBoard([[null, 'R', null, null, null, null, null]]);
    const next = resolveConnectFourBoard({}, prior, parseBoard);
    expect(next[0][1]).toBe('R');
  });

  it('payloadIndicatesConnectFourPlay accepts mid-game board updates in PLAY', () => {
    expect(
      payloadIndicatesConnectFourPlay({ board: [[null]] }, 'PLAY', false),
    ).toBe(true);
  });

  it('parseConnectFourMoveRevision reads camelCase and snake_case', () => {
    expect(parseConnectFourMoveRevision({ moveRevision: 3 })).toBe(3);
    expect(parseConnectFourMoveRevision({ move_revision: 5 })).toBe(5);
    expect(parseConnectFourMoveRevision({})).toBeNull();
  });

  it('isConnectFourResyncOnlyPayload detects resync-only pushes', () => {
    expect(isConnectFourResyncOnlyPayload({ resyncOnly: true })).toBe(true);
    expect(isConnectFourResyncOnlyPayload({ board: [[null]] })).toBe(false);
  });

  it('shouldApplyConnectFourPlayPayload rejects stale revision during PLAY', () => {
    const current = parseBoard([[null, 'R', null, null, null, null, null]]);
    expect(
      shouldApplyConnectFourPlayPayload(
        { moveRevision: 2, board: current },
        4,
        current,
        'PLAY',
        parseBoard,
      ),
    ).toBe(false);
    expect(
      shouldApplyConnectFourPlayPayload(
        { moveRevision: 5, board: current },
        4,
        current,
        'PLAY',
        parseBoard,
      ),
    ).toBe(true);
  });

  it('shouldApplyConnectFourPlayPayload rejects board with fewer discs than current', () => {
    const current = parseBoard([[null, 'R', 'Y', null, null, null, null]]);
    const stale = [[null, 'R', null, null, null, null, null]];
    expect(
      shouldApplyConnectFourPlayPayload({ board: stale }, 0, current, 'PLAY', parseBoard),
    ).toBe(false);
    expect(countConnectFourDiscs(current)).toBe(2);
    expect(countConnectFourDiscs(parseBoard(stale))).toBe(1);
  });

  it('race: move v4 then stale join v3 — v3 rejected when revision known', () => {
    const boardV4 = parseBoard([
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, null, 'R', null, null, null],
      [null, null, 'Y', 'R', null, null, null],
    ]);
    let revision = 0;
    const apply = (data: Record<string, unknown>) => {
      if (isConnectFourResyncOnlyPayload(data)) return revision;
      if (
        !shouldApplyConnectFourPlayPayload(data, revision, boardV4, 'PLAY', parseBoard)
      ) {
        return revision;
      }
      const incoming = parseConnectFourMoveRevision(data);
      if (incoming != null) revision = Math.max(revision, incoming);
      return revision;
    };
    apply({ moveRevision: 3, board: boardV4 });
    apply({ moveRevision: 4, board: boardV4 });
    expect(revision).toBe(4);
    apply({ moveRevision: 3, board: parseBoard([[null, 'R', null, null, null, null, null]]) });
    expect(revision).toBe(4);
  });
});
