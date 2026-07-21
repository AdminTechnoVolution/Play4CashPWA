import { describe, expect, it } from 'vitest';
import { applyWsMessagePlaceholders } from './ApiMessageDisplay';

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
