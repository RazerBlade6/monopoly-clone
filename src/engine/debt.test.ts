import { describe, expect, it } from 'vitest';
import type { GameState } from '../shared/types';
import { createGame, legalActions, reduce } from './index';
import { SMALL_MAP, dieVal, identityRng, queueRng, settingsFor } from './fixtures';
import { updateBank, updatePlayer, updateTile } from './state';
import { applyCardEffect } from './landing';

const P1 = { id: 'p1', name: 'Ann', color: 'red' };
const P2 = { id: 'p2', name: 'Bo', color: 'blue' };
const P3 = { id: 'p3', name: 'Cy', color: 'green' };
const P4 = { id: 'p4', name: 'Di', color: 'yellow' };

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)!.cash;
}

function started(players = [P1, P2], overrides = {}) {
  const settings = settingsFor({ randomizePlayerOrder: false, ...overrides });
  let state = createGame(SMALL_MAP, players, settings, identityRng);
  state = reduce(SMALL_MAP, state, { playerId: players[0]!.id, action: { type: 'start_game' } }, identityRng).state;
  return state;
}

describe('RESOLVING_DEBT entry and liquidation', () => {
  it('opens RESOLVING_DEBT when the debtor cannot afford rent, and clears it once they sell enough', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2', houses: 0 }); // p2 owns tile3
    // Give p1 a Charlie group (12,13,15,17) with some houses to liquidate, but almost no cash.
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 2 });
    state = updatePlayer(state, 'p1', { cash: 1 });

    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])); // lands on tile3, owes rent
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    expect(r.state.debt).not.toBeNull();
    expect(r.state.debt!.debtor).toBe('p1');
    expect(r.state.debt!.creditor).toBe('p2');
    expect(r.events.some((e) => e.type === 'debt_opened')).toBe(true);

    // Sell enough houses to cover the debt.
    let s = r.state;
    let cleared = false;
    for (const i of [12, 13, 15, 17, 12, 13, 15, 17]) {
      if (s.phase !== 'RESOLVING_DEBT') break;
      const sell = reduce(SMALL_MAP, s, { playerId: 'p1', action: { type: 'sell_house', tileIndex: i } }, identityRng);
      if (!sell.error) s = sell.state;
      if (s.phase !== 'RESOLVING_DEBT') cleared = true;
    }
    expect(cleared).toBe(true);
    expect(s.phase).not.toBe('RESOLVING_DEBT');
    expect(s.debt).toBeNull();
    expect(s.players.find((p) => p.id === 'p1')!.cash).toBeGreaterThanOrEqual(0);
  });

  it('cannot build (buy_house) while resolving debt, only sell', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2' });
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 1 });
    state = updatePlayer(state, 'p1', { cash: 1 });
    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    const buy = reduce(SMALL_MAP, r.state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(buy.error).toBeTruthy();
    expect(buy.state).toBe(r.state);
  });

  it('never auto-bankrupts: a debtor with nothing to sell stays in RESOLVING_DEBT', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2', houses: 4 }); // rent 360
    state = updatePlayer(state, 'p1', { cash: 1 }); // p1 owns nothing to liquidate

    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    expect(cashOf(r.state, 'p1')).toBe(-359);
    expect(r.state.players.find((p) => p.id === 'p1')!.bankrupt).toBe(false);
    expect(r.events.some((e) => e.type === 'bankrupt')).toBe(false);
    expect(legalActions(SMALL_MAP, r.state, 'p1')).toEqual([{ type: 'declare_bankruptcy' }]);
  });
});

describe('negative balance and pay-as-you-go', () => {
  it('pays a player creditor everything at once and leaves the debtor negative by the rest', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2', houses: 4 }); // rent 360
    state = updatePlayer(state, 'p1', { cash: 100 });
    const p2Before = cashOf(state, 'p2');

    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    expect(cashOf(r.state, 'p1')).toBe(-260);
    expect(cashOf(r.state, 'p2')).toBe(p2Before + 100);
    expect(r.state.debt).toEqual({ debtor: 'p1', amount: 260, creditor: 'p2', queued: [] });
    expect(r.events).toContainEqual({ type: 'paid', from: 'p1', to: 'p2', amount: 100, reason: 'debt' });
  });

  it('pays a bank creditor into the vacation pot when vacationCash is on', () => {
    let state = started([P1, P2], { vacationCash: true });
    state = updatePlayer(state, 'p1', { cash: 30 });
    const r = applyCardEffect(SMALL_MAP, state, 'p1', { kind: 'money', amount: -100 }, []);
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    expect(cashOf(r.state, 'p1')).toBe(-70);
    expect(r.state.vacationPot).toBe(30);
    expect(r.state.debt).toMatchObject({ amount: 70, creditor: null });
  });

  it('sends building-sale proceeds straight to the creditor, and clears the debt once the balance reaches 0', () => {
    let state = started();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 1 });
    state = updateTile(state, 3, { owner: 'p2' });
    state = updatePlayer(state, 'p1', { cash: 0 });
    // Bare rent on tile 3 is 6, and any Charlie house sells for more than that.
    const rolled = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(cashOf(rolled.state, 'p1')).toBe(-6);
    const p2Before = cashOf(rolled.state, 'p2');

    const sold = reduce(SMALL_MAP, rolled.state, { playerId: 'p1', action: { type: 'sell_house', tileIndex: 17 } }, identityRng);
    expect(sold.error).toBeUndefined();
    const proceeds = Math.floor((SMALL_MAP.tiles[17] as { housePrice: number }).housePrice / 2);
    expect(cashOf(sold.state, 'p1')).toBe(proceeds - 6);
    expect(cashOf(sold.state, 'p2')).toBe(p2Before + 6);
    expect(sold.events).toContainEqual({ type: 'paid', from: 'p1', to: 'p2', amount: 6, reason: 'debt' });
    expect(sold.events.some((e) => e.type === 'debt_cleared')).toBe(true);
    expect(sold.state.debt).toBeNull();
    expect(sold.state.phase).toBe('AWAITING_END_TURN');
  });

  it('returns to AWAITING_ROLL when the debt came from a doubles roll', () => {
    let state = started();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 1 });
    state = { ...updatePlayer(state, 'p1', { cash: 0 }), lastRoll: [2, 2], doublesCount: 1 };
    const r = applyCardEffect(SMALL_MAP, state, 'p1', { kind: 'money', amount: -10 }, []);
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    const sold = reduce(SMALL_MAP, r.state, { playerId: 'p1', action: { type: 'sell_house', tileIndex: 17 } }, identityRng);
    expect(sold.state.debt).toBeNull();
    expect(sold.state.phase).toBe('AWAITING_ROLL');
  });

  it('refuses roll and end_turn while in debt, and does not offer them', () => {
    let state = started();
    state = updatePlayer(state, 'p1', { cash: 0 });
    const r = applyCardEffect(SMALL_MAP, state, 'p1', { kind: 'money', amount: -10 }, []);
    for (const type of ['roll', 'end_turn'] as const) {
      const attempt = reduce(SMALL_MAP, r.state, { playerId: 'p1', action: { type } }, identityRng);
      expect(attempt.error).toBeTruthy();
      expect(attempt.state).toBe(r.state);
    }
    const p2Roll = reduce(SMALL_MAP, r.state, { playerId: 'p2', action: { type: 'roll' } }, identityRng);
    expect(p2Roll.error).toBeTruthy();
    const legal = legalActions(SMALL_MAP, r.state, 'p1').map((a) => a.type);
    expect(legal).not.toContain('roll');
    expect(legal).not.toContain('end_turn');
  });
});

describe('multi-creditor debt in turn order (docs/ENGINE.md decision 13)', () => {
  it('pays creditors in turn order up front, then pays the rest from later income in the same order', () => {
    // Four players. p1 (current) owes p2, p3 and p4 (in that turn order) 100 each via a
    // money_from_each(-100) card. With 150 in hand, p2 is paid in full and p3 gets 50.
    let state = started([P1, P2, P3, P4]);
    state = updatePlayer(state, 'p1', { cash: 150 });
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 4 });
    const before = { p2: cashOf(state, 'p2'), p3: cashOf(state, 'p3'), p4: cashOf(state, 'p4') };

    const r = applyCardEffect(SMALL_MAP, state, 'p1', { kind: 'money_from_each', amount: -100 }, []);
    expect(r.state.phase).toBe('RESOLVING_DEBT');
    expect(cashOf(r.state, 'p1')).toBe(-150);
    expect(cashOf(r.state, 'p2')).toBe(before.p2 + 100);
    expect(cashOf(r.state, 'p3')).toBe(before.p3 + 50);
    expect(cashOf(r.state, 'p4')).toBe(before.p4);
    expect(r.state.debt).toEqual({ debtor: 'p1', amount: 50, creditor: 'p3', queued: [{ amount: 100, creditor: 'p4' }] });

    // Three Charlie house sales raise 63: p3's remaining 50, then 13 towards p4.
    let s = r.state;
    for (const i of [17, 15, 13]) s = reduce(SMALL_MAP, s, { playerId: 'p1', action: { type: 'sell_house', tileIndex: i } }, identityRng).state;
    const raised = 150 + cashOf(s, 'p1');
    expect(cashOf(s, 'p3')).toBe(before.p3 + 100);
    expect(cashOf(s, 'p4')).toBe(before.p4 + raised - 50);
    expect(s.debt).toMatchObject({ creditor: 'p4', queued: [] });
  });
});

describe('declaring bankruptcy', () => {
  it('in debt: every property returns to the market, buildings go back to the bank, and the creditor gets nothing more', () => {
    let state = started([P1, P2, P3]);
    state = updateTile(state, 3, { owner: 'p2', houses: 4 }); // rent 360
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1', houses: 2 });
    state = updateTile(state, 5, { owner: 'p1' });
    state = updateBank(state, { houses: 32 - 4 - 8 });
    state = updatePlayer(state, 'p1', { cash: 50 });

    const rolled = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(rolled.state.phase).toBe('RESOLVING_DEBT');
    const p2AfterPayment = cashOf(rolled.state, 'p2');

    const r = reduce(SMALL_MAP, rolled.state, { playerId: 'p1', action: { type: 'declare_bankruptcy' } }, identityRng);
    expect(r.error).toBeUndefined();
    const p1 = r.state.players.find((p) => p.id === 'p1')!;
    expect(p1.bankrupt).toBe(true);
    expect(p1.cash).toBe(0);
    for (const i of [5, 12, 13, 15, 17]) expect(r.state.tiles[i]).toEqual({ owner: null, houses: 0, hotel: false, mortgaged: false });
    expect(r.state.bank.houses).toBe(32 - 4);
    expect(cashOf(r.state, 'p2')).toBe(p2AfterPayment);
    expect(r.state.debt).toBeNull();
    expect(r.events).toContainEqual({ type: 'bankrupt', playerId: 'p1', creditor: null });
    // The turn moves on to p2.
    expect(r.state.turnOrder[r.state.currentPlayerIndex]).toBe('p2');
    expect(r.state.phase).toBe('AWAITING_ROLL');
  });

  it('a creditor who concedes is owed nothing further, which can clear the debt', () => {
    let state = started([P1, P2, P3]);
    state = updatePlayer(state, 'p1', { cash: 0 });
    const r = applyCardEffect(SMALL_MAP, state, 'p1', { kind: 'money_from_each', amount: -50 }, []);
    expect(r.state.debt).toMatchObject({ amount: 50, creditor: 'p2', queued: [{ amount: 50, creditor: 'p3' }] });

    const p2Out = reduce(SMALL_MAP, r.state, { playerId: 'p2', action: { type: 'declare_bankruptcy' } }, identityRng);
    expect(p2Out.state.debt).toEqual({ debtor: 'p1', amount: 50, creditor: 'p3', queued: [] });
    expect(cashOf(p2Out.state, 'p1')).toBe(-50);
  });
});

describe('voluntary concession', () => {
  it('returns everything to the market even when the conceding player has no active debt', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p1', houses: 2 });
    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'declare_bankruptcy' } }, identityRng);
    expect(r.error).toBeUndefined();
    const p1 = r.state.players.find((p) => p.id === 'p1')!;
    expect(p1.bankrupt).toBe(true);
    expect(p1.cash).toBe(0);
    expect(r.state.tiles[3]!.owner).toBeNull(); // to the market, not to p2 — no kingmaking gift
    expect(r.state.tiles[3]!.houses).toBe(0);
    expect(r.events.some((e) => e.type === 'bankrupt' && e.creditor === null)).toBe(true);
    expect(r.state.phase).toBe('GAME_OVER');
    expect(r.state.winner).toBe('p2');
  });

  it('a non-current player may also concede, without disturbing whose turn it is', () => {
    let state = started([P1, P2, P3]);
    const before = state.currentPlayerIndex;
    const r = reduce(SMALL_MAP, state, { playerId: 'p3', action: { type: 'declare_bankruptcy' } }, identityRng);
    expect(r.error).toBeUndefined();
    expect(r.state.players.find((p) => p.id === 'p3')!.bankrupt).toBe(true);
    expect(r.state.currentPlayerIndex).toBe(before);
    expect(r.state.phase).not.toBe('GAME_OVER'); // two players remain
  });
});
