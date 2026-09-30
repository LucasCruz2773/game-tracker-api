import { toUsernameBase, withRandomSuffix } from './username.js';

describe('username', () => {
  it.each([
    ['Lucas Fernandes', 'lucas_fernandes'],
    ['João Conceição', 'joao_conceicao'],
    ['  Mr. Game & Watch!  ', 'mr_game_watch'],
    ['Ana-Luísa O’Brien', 'ana_luisa_o_brien'],
  ])('builds "%s" into "%s"', (displayName, expected) => {
    expect(toUsernameBase(displayName)).toBe(expected);
  });

  it('keeps the base short enough to receive a suffix', () => {
    const base = toUsernameBase(
      'Maximilian Alexander von Hohenzollern-Sigmaringen',
    );

    expect(base.length).toBeLessThanOrEqual(24);
    expect(base.endsWith('_')).toBe(false);
    expect(withRandomSuffix(base)).toMatch(/^[a-z0-9_]{3,30}$/);
  });

  it.each([null, '', '李小龙', 'Al'])(
    'falls back to "player" when "%s" yields too few characters',
    (displayName) => {
      expect(toUsernameBase(displayName)).toBe('player');
    },
  );

  it('appends a 4-digit suffix', () => {
    expect(withRandomSuffix('player')).toMatch(/^player_\d{4}$/);
  });
});
