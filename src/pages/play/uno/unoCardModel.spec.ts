import { describe, expect, it } from 'vitest';
import { parseUnoCard } from './unoCardModel';

describe('parseUnoCard', () => {
  it('parses Wild', () => {
    expect(parseUnoCard('W')).toEqual({ color: null, glyph: 'W', kind: 'wild' });
  });
  it('parses Wild +4', () => {
    expect(parseUnoCard('W4')).toEqual({ color: null, glyph: '+4', kind: 'wild4' });
  });
  it('parses colored numbers', () => {
    expect(parseUnoCard('R0')).toMatchObject({ color: 'R', glyph: '0', kind: 'number' });
    expect(parseUnoCard('B9')).toMatchObject({ color: 'B', glyph: '9', kind: 'number' });
  });
  it('parses Skip / Reverse / +2', () => {
    expect(parseUnoCard('YSkip').kind).toBe('skip');
    expect(parseUnoCard('GReverse').kind).toBe('reverse');
    expect(parseUnoCard('BDraw2')).toMatchObject({ color: 'B', glyph: '+2', kind: 'draw2' });
  });
});
