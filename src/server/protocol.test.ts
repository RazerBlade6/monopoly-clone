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

describe('trade action validation', () => {
  const action = (a: Record<string, unknown>) => parseClientMessage({ type: 'action', action: a });
  const side = { cash: 100, tiles: [1, 3], pardonCards: 1 };
  const empty = { cash: 0, tiles: [], pardonCards: 0 };

  it('accepts well-formed proposals, with or without counterOf', () => {
    expect(action({ type: 'propose_trade', to: 'p2', offer: side, request: empty })).not.toBeNull();
    expect(action({ type: 'propose_trade', to: 'p2', offer: side, request: empty, counterOf: 'trade-3' })).not.toBeNull();
    expect(parseClientMessage({
      type: 'action', asPlayerId: 'bot', action: { type: 'propose_trade', to: 'p2', offer: empty, request: side },
    })).not.toBeNull();
  });

  it('rejects malformed proposals', () => {
    const bad: Record<string, unknown>[] = [
      { type: 'propose_trade', offer: side, request: empty },
      { type: 'propose_trade', to: '', offer: side, request: empty },
      { type: 'propose_trade', to: 7, offer: side, request: empty },
      { type: 'propose_trade', to: 'p2', offer: side },
      { type: 'propose_trade', to: 'p2', offer: side, request: empty, extra: 1 },
      { type: 'propose_trade', to: 'p2', offer: side, request: empty, counterOf: 5 },
      { type: 'propose_trade', to: 'p2', offer: { ...side, cash: -1 }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, cash: 1.5 }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, cash: '100' }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, pardonCards: -1 }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, tiles: [-1] }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, tiles: [1.5] }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, tiles: '1' }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, tiles: Array.from({ length: 65 }, (_, i) => i) }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { ...side, extra: true }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: { cash: 0, tiles: [] }, request: empty },
      { type: 'propose_trade', to: 'p2', offer: null, request: empty },
      { type: 'propose_trade', to: 'x'.repeat(65), offer: side, request: empty },
    ];
    for (const a of bad) expect(action(a), JSON.stringify(a)).toBeNull();
  });

  it('accepts accept/decline/cancel with a trade id and nothing else', () => {
    for (const type of ['accept_trade', 'decline_trade', 'cancel_trade']) {
      expect(action({ type, tradeId: 'trade-0' })).not.toBeNull();
      expect(action({ type })).toBeNull();
      expect(action({ type, tradeId: '' })).toBeNull();
      expect(action({ type, tradeId: 0 })).toBeNull();
      expect(action({ type, tradeId: 'trade-0', to: 'p2' })).toBeNull();
    }
  });

  it('accepts the antiCollusion setting as a boolean only', () => {
    expect(parseClientMessage({ type: 'update_settings', settings: { antiCollusion: true } })).not.toBeNull();
    expect(parseClientMessage({ type: 'update_settings', settings: { antiCollusion: 'yes' } })).toBeNull();
  });
});

describe('sell_property validation', () => {
  const action = (a: Record<string, unknown>) => parseClientMessage({ type: 'action', action: a });

  it('accepts a tile index', () => {
    expect(action({ type: 'sell_property', tileIndex: 0 })).toEqual({ type: 'action', action: { type: 'sell_property', tileIndex: 0 } });
    expect(parseClientMessage({ type: 'action', asPlayerId: 'bot', action: { type: 'sell_property', tileIndex: 12 } })).not.toBeNull();
  });

  it('rejects a missing, malformed or padded tile index', () => {
    const bad: Record<string, unknown>[] = [
      { type: 'sell_property' },
      { type: 'sell_property', tileIndex: -1 },
      { type: 'sell_property', tileIndex: 1.5 },
      { type: 'sell_property', tileIndex: '3' },
      { type: 'sell_property', tileIndex: 3, amount: 1000 },
    ];
    for (const a of bad) expect(action(a)).toBeNull();
  });
});
