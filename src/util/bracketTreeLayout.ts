import type { TournamentBracketMatch, TournamentBracketResponse } from '../data/models/ApiModels';
import { groupMatchesByRound, sortedBracketGroups } from './tournamentUtils';

export const BRACKET_MATCH_W = 136;
export const BRACKET_MATCH_H = 54;
export const BRACKET_COL_GAP = 44;
export const BRACKET_ROW_UNIT = 68;

export type BracketTreeMatchNode = {
  match: TournamentBracketMatch;
  x: number;
  y: number;
  roundIndex: number;
  matchIndex: number;
};

export type BracketTreeConnector = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type BracketTreeSection = {
  id: string;
  label: string;
  labelKey?: string;
  labelArg?: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  nodes: BracketTreeMatchNode[];
  connectors: BracketTreeConnector[];
};

export type BracketTreeLayout = {
  sections: BracketTreeSection[];
  bridgeConnectors: BracketTreeConnector[];
  width: number;
  height: number;
  championUserId: string | null;
  championName: string | null;
};

function nonByeMatches(matches: TournamentBracketMatch[]): TournamentBracketMatch[] {
  return matches.filter((m) => !m.isBye);
}

function layoutSingleElimSection(
  id: string,
  label: string,
  matches: TournamentBracketMatch[],
  opts?: { labelKey?: string; labelArg?: number; mirror?: boolean },
): BracketTreeSection | null {
  const filtered = nonByeMatches(matches);
  if (filtered.length === 0) return null;

  const rounds = groupMatchesByRound(filtered);
  if (rounds.length === 0) return null;

  const firstCount = Math.max(1, rounds[0].matches.length);
  const totalHeight = firstCount * BRACKET_ROW_UNIT * 2 ** (rounds.length - 1);
  const nodes: BracketTreeMatchNode[] = [];
  const connectors: BracketTreeConnector[] = [];
  const nodeById = new Map<string, BracketTreeMatchNode>();

  rounds.forEach((round, rIdx) => {
    const count = round.matches.length;
    const span = totalHeight / count;
    round.matches.forEach((match, mIdx) => {
      const y = span * mIdx + span / 2;
      const x = opts?.mirror
        ? (rounds.length - 1 - rIdx) * (BRACKET_MATCH_W + BRACKET_COL_GAP)
        : rIdx * (BRACKET_MATCH_W + BRACKET_COL_GAP);
      const node: BracketTreeMatchNode = {
        match,
        x,
        y,
        roundIndex: round.roundIndex,
        matchIndex: match.matchIndex ?? mIdx,
      };
      nodes.push(node);
      nodeById.set(match.id, node);
    });
  });

  for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
    const round = rounds[rIdx];
    const nextRound = rounds[rIdx + 1];
    round.matches.forEach((match, mIdx) => {
      const from = nodeById.get(match.id);
      if (!from || !match.winnerUserId) return;

      const nextMatch =
        nextRound.matches.find(
          (nm) =>
            nm.playerA?.userId === match.winnerUserId || nm.playerB?.userId === match.winnerUserId,
        ) ?? nextRound.matches[Math.floor(mIdx / 2)];

      const to = nextMatch ? nodeById.get(nextMatch.id) : undefined;
      if (!to) return;

      if (opts?.mirror) {
        connectors.push({
          x1: from.x,
          y1: from.y,
          x2: to.x + BRACKET_MATCH_W,
          y2: to.y,
        });
      } else {
        connectors.push({
          x1: from.x + BRACKET_MATCH_W,
          y1: from.y,
          x2: to.x,
          y2: to.y,
        });
      }
    });
  }

  const width = rounds.length * BRACKET_MATCH_W + Math.max(0, rounds.length - 1) * BRACKET_COL_GAP;
  return {
    id,
    label,
    labelKey: opts?.labelKey,
    labelArg: opts?.labelArg,
    offsetX: 0,
    offsetY: 0,
    width,
    height: totalHeight,
    nodes,
    connectors,
  };
}

function findGrandFinal(bracket: TournamentBracketResponse): TournamentBracketMatch | null {
  const finals = nonByeMatches(bracket.finalsMatches);
  if (finals.length === 0) return null;
  const grand = finals.find((m) => m.roundName === 'grand_final');
  return grand ?? finals.sort((a, b) => (b.roundIndex ?? 0) - (a.roundIndex ?? 0))[0];
}

function usernameForUserId(
  bracket: TournamentBracketResponse,
  userId: string | null | undefined,
): string | null {
  if (!userId) return null;
  const all = [...bracket.groupMatches, ...bracket.finalsMatches];
  for (const m of all) {
    if (m.playerA?.userId === userId) return m.playerA.username;
    if (m.playerB?.userId === userId) return m.playerB.username;
  }
  return null;
}

/** Builds a converging bracket: groups on left/right feeding into center finals + champion. */
export function buildBracketTreeLayout(bracket: TournamentBracketResponse): BracketTreeLayout {
  const groups = sortedBracketGroups(bracket);
  const groupSections: BracketTreeSection[] = [];
  const bridgeConnectors: BracketTreeConnector[] = [];

  const groupCount = groups.length;
  const leftGroups = groups.filter((_, i) => i < Math.ceil(groupCount / 2));
  const rightGroups = groups.filter((_, i) => i >= Math.ceil(groupCount / 2));

  let leftBlockH = 0;
  let leftBlockW = 0;
  leftGroups.forEach((g) => {
    const matches = bracket.groupMatches.filter((m) => m.groupNumber === g.groupNumber);
    const section = layoutSingleElimSection(`group-${g.groupNumber}`, `Group ${g.groupNumber}`, matches, {
      labelKey: 'tournament_group_n',
      labelArg: g.groupNumber,
    });
    if (!section) return;
    section.offsetY = leftBlockH + (leftGroups.length > 1 ? 28 : 0);
    leftBlockH = section.offsetY + section.height + 32;
    leftBlockW = Math.max(leftBlockW, section.width);
    groupSections.push(section);
  });

  let rightBlockH = 0;
  let rightBlockW = 0;
  rightGroups.forEach((g) => {
    const matches = bracket.groupMatches.filter((m) => m.groupNumber === g.groupNumber);
    const section = layoutSingleElimSection(`group-${g.groupNumber}`, `Group ${g.groupNumber}`, matches, {
      labelKey: 'tournament_group_n',
      labelArg: g.groupNumber,
      mirror: true,
    });
    if (!section) return;
    section.offsetY = rightBlockH + (rightGroups.length > 1 ? 28 : 0);
    rightBlockH = section.offsetY + section.height + 32;
    rightBlockW = Math.max(rightBlockW, section.width);
    groupSections.push(section);
  });

  const finalsSection = layoutSingleElimSection('finals', 'Finals', bracket.finalsMatches, {
    labelKey: 'tournament_finals_phase',
  });

  const grandFinal = findGrandFinal(bracket);
  const championUserId =
    grandFinal?.status === 'finished' || grandFinal?.status === 'forfeited'
      ? grandFinal.winnerUserId
      : null;
  const championName = usernameForUserId(bracket, championUserId);

  const sidePad = 24;
  const centerGap = 56;
  const leftX = sidePad;
  const finalsX = leftX + leftBlockW + centerGap;
  const rightX = finalsSection ? finalsX + finalsSection.width + centerGap : finalsX + centerGap;

  leftGroups.forEach((g) => {
    const section = groupSections.find((s) => s.id === `group-${g.groupNumber}`);
    if (!section) return;
    section.offsetX = leftX;
    if (leftGroups.length === 1) {
      section.offsetY = finalsSection
        ? Math.max(0, (Math.max(leftBlockH, finalsSection.height) - section.height) / 2)
        : 40;
    }
  });

  rightGroups.forEach((g) => {
    const section = groupSections.find((s) => s.id === `group-${g.groupNumber}`);
    if (!section) return;
    section.offsetX = rightX;
    if (rightGroups.length === 1) {
      section.offsetY = finalsSection
        ? Math.max(0, (Math.max(rightBlockH, finalsSection.height) - section.height) / 2)
        : 40;
    }
  });

  if (finalsSection) {
    finalsSection.offsetX = finalsX;
    finalsSection.offsetY = Math.max(40, (Math.max(leftBlockH, rightBlockH) - finalsSection.height) / 2);
  }

  const allSections = [...groupSections, ...(finalsSection ? [finalsSection] : [])];

  // Bridge lines from last group-round winners into first finals match(es)
  if (finalsSection && grandFinal) {
    const finalsStartX = finalsSection.offsetX;
    const grandNode = finalsSection.nodes.find((n) => n.match.id === grandFinal.id);

    for (const g of groups) {
      const groupMatches = nonByeMatches(
        bracket.groupMatches.filter((m) => m.groupNumber === g.groupNumber),
      );
      if (groupMatches.length === 0) continue;
      const lastRoundIdx = Math.max(...groupMatches.map((m) => m.roundIndex ?? 0));
      const groupFinalMatch = groupMatches.find((m) => (m.roundIndex ?? 0) === lastRoundIdx);
      if (!groupFinalMatch?.winnerUserId) continue;

      const section = groupSections.find((s) => s.id === `group-${g.groupNumber}`);
      const fromNode = section?.nodes.find((n) => n.match.id === groupFinalMatch.id);
      if (!fromNode || !section || !grandNode) continue;

      const isLeft = leftGroups.some((lg) => lg.groupNumber === g.groupNumber);
      const fromX = isLeft ? section.offsetX + fromNode.x + BRACKET_MATCH_W : section.offsetX + fromNode.x;
      const fromY = section.offsetY + fromNode.y;
      const toX = isLeft ? finalsStartX + grandNode.x : finalsStartX + grandNode.x + BRACKET_MATCH_W;
      const toY = finalsSection.offsetY + grandNode.y;

      bridgeConnectors.push({ x1: fromX, y1: fromY, x2: toX, y2: toY });
    }
  }

  const contentH = Math.max(leftBlockH, rightBlockH, finalsSection ? finalsSection.offsetY + finalsSection.height : 0, 200);
  const contentW = rightX + rightBlockW + sidePad;

  const championPad = championUserId ? 72 : 0;
  const totalW = contentW;
  const totalH = contentH + championPad + 24;

  return {
    sections: allSections,
    bridgeConnectors,
    width: totalW,
    height: totalH,
    championUserId,
    championName,
  };
}

export function connectorPath(c: BracketTreeConnector): string {
  const midX = (c.x1 + c.x2) / 2;
  return `M ${c.x1} ${c.y1} H ${midX} V ${c.y2} H ${c.x2}`;
}
