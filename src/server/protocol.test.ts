import { describe, expect, it } from 'vitest';
import { isNameTaken, parseClientMessage } from './protocol';

describe('isNameTaken', () => {
  it('matches case-insensitively', () => {
    expect(isNameTaken('alice', ['Alice'])).toBe(true);
    expect(isNameTaken('BOT 3', ['Bot 3'])).toBe(true);
  });

  it('ignores surrounding whitespace on either side', () => {
    expect(isNameTaken('  Alice ', ['alice'])).toBe(true);
    expect(isNameTaken('alice', [' Alice  '])).toBe(true);
  });

  it('does not flag distinct names or substrings', () => {
    expect(isNameTaken('Alice', ['Alicia', 'Al', 'Alice B'])).toBe(false);
    expect(isNameTaken('Alice', [])).toBe(false);
  });
});

describe('settings validation bounds', () => {
  const patch = (settings: Record<string, unknown>) =>
    parseClientMessage({ type: 'update_settings', settings });

  it('caps maxPlayers at 8 and floors it at 2', () => {
    expect(patch({ maxPlayers: 8 })).not.toBeNull();
    expect(patch({ maxPlayers: 9 })).toBeNull();
    expect(patch({ maxPlayers: 1 })).toBeNull();
  });

  it('rejects negative money settings', () => {
    for (const key of ['startingCash', 'startSalary', 'landOnStartBonus', 'jailFee']) {
      expect(patch({ [key]: 0 })).not.toBeNull();
      expect(patch({ [key]: -1 })).toBeNull();
    }
  });
});
