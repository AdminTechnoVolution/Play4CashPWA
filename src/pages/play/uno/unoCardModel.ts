import type { UnoCardCode, UnoColor } from '../../../data/models/ApiModels';

/**
 * Parses the wire encoding into a render model. The API uses a compact string scheme;
 * keep all parsing in this single helper so the UI never re-implements it.
 */
export interface UnoCardModel {
  /** Background color for the card body. `null` = wild (black body). */
  color: UnoColor | null;
  /** Big glyph rendered inside the white oval. e.g. '5', '↻', '⊘', '+2', 'W', '+4'. */
  glyph: string;
  /** Logical card kind for accessibility / a11y labels. */
  kind: 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
}

const GLYPH_SKIP = '⊘';
const GLYPH_REVERSE = '↻';

export function parseUnoCard(code: UnoCardCode): UnoCardModel {
  if (code === 'W') return { color: null, glyph: 'W', kind: 'wild' };
  if (code === 'W4') return { color: null, glyph: '+4', kind: 'wild4' };

  const colorChar = code[0];
  const color: UnoColor | null =
    colorChar === 'R' || colorChar === 'G' || colorChar === 'B' || colorChar === 'Y' ? colorChar : null;
  const rest = code.slice(1);

  if (rest === 'Skip') return { color, glyph: GLYPH_SKIP, kind: 'skip' };
  if (rest === 'Reverse') return { color, glyph: GLYPH_REVERSE, kind: 'reverse' };
  if (rest === 'Draw2') return { color, glyph: '+2', kind: 'draw2' };
  return { color, glyph: rest, kind: 'number' };
}

/** CSS color tokens for the UNO palette. Tuned to read clearly against `--sovereign-bg`. */
export const UNO_COLOR_BG: Record<UnoColor, string> = {
  R: '#d92d20',
  G: '#1f9d55',
  B: '#1d6fdf',
  Y: '#e8b500',
};
export const UNO_COLOR_BG_DARK: Record<UnoColor, string> = {
  R: '#9b1f17',
  G: '#147038',
  B: '#13509f',
  Y: '#a98300',
};

export const UNO_COLOR_LABEL_KEY: Record<UnoColor, string> = {
  R: 'uno_color_red',
  G: 'uno_color_green',
  B: 'uno_color_blue',
  Y: 'uno_color_yellow',
};

/** A11y label for a parsed card; consumers feed the result through i18n. */
export function unoCardA11yKey(code: UnoCardCode): string {
  const m = parseUnoCard(code);
  if (m.kind === 'wild') return 'uno_a11y_wild';
  if (m.kind === 'wild4') return 'uno_a11y_wild4';
  if (m.kind === 'skip') return 'uno_a11y_skip';
  if (m.kind === 'reverse') return 'uno_a11y_reverse';
  if (m.kind === 'draw2') return 'uno_a11y_draw2';
  return 'uno_a11y_number';
}
