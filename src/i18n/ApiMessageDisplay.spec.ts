import { describe, expect, it } from 'vitest';
import { applyWsMessagePlaceholders, formatApiMessageForDisplay } from './ApiMessageDisplay';

describe('applyWsMessagePlaceholders', () => {
  it.each([
    ['playerLeft', 'Alice'],
    ['player_left', 'Bob'],
    ['leftPlayerName', 'Carla'],
    ['left_player_name', 'Diego'],
  ])('uses %s as a username source for {{username}}', (field, name) => {
    expect(applyWsMessagePlaceholders('{{username}} left.', { [field]: name }))
      .toBe(`${name} left.`);
  });
});

describe('formatApiMessageForDisplay error payloads', () => {
  it('accepts Error objects without throwing from trim', () => {
    expect(formatApiMessageForDisplay(new Error('Custom server message'))).toBe('Custom server message');
  });
  it('handles message arrays, wrapped errors and unknown objects safely', () => {
    expect(formatApiMessageForDisplay({ message: ['First failure', 'Second failure'] })).toBe('First failure\nSecond failure');
    expect(formatApiMessageForDisplay({ messages: ['Custom failure'] })).toBe('Custom failure');
    expect(() => formatApiMessageForDisplay({ unexpected: true })).not.toThrow();
    const cyclic: any = {}; cyclic.message = cyclic;
    expect(() => formatApiMessageForDisplay(cyclic)).not.toThrow();
  });
});
