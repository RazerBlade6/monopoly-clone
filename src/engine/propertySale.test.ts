import { describe, expect, it } from 'vitest';
import type { GameAction, GameState, TradeSide } from '../shared/types';
import { createGame, legalActions, reduce } from './index';
import { SMALL_MAP, dieVal, identityRng, queueRng, settingsFor } from './fixtures';
import { updatePlayer, updateTile } from './state';

const P1 = { id: 'p1', name: 'Ann', color: 'red' };
const P2 = { id: 'p2', name: 'Bo', color: 'blue' };

function started(overrides = {}): GameState {
  const settings = settingsFor({ randomizePlayerOrder: false, ...overrides });
  const state = createGame(SMALL_MAP, [P1, P2], settings, identityRng);
  return reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, identityRng).state;
}

function act(state: GameState, playerId: string, action: GameAction, rng = identityRng) {
  return reduce(SMALL_MAP, state, { playerId, action }, rng);
}

function sell(state: GameState, playerId: string, tileIndex: number) {
  return act(state, playerId, { type: 'sell_property', tileIndex });
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)!.cash;
}

describe('sell_property', () => {
  it('pays half the printed price from the bank and leaves the tile unowned', () => {
    let state = started();
    state = updateTile(state, 13, { owner: 'p1' }); // Charlie 2, price 160
    state = updateTile(state, 5, { owner: 'p1' }); // Airport 1, price 200
    state = updateTile(state, 11, { owner: 'p1' }); // Company 1, price 150

    const r = sell(state, 'p1', 13);
    expect(r.error).toBeUndefined();
    expect(r.events).toEqual([{ type: 'property_sold', playerId: 'p1', tileIndex: 13, amount: 80 }]);
    expect(r.state.tiles[13]!.owner).toBeNull();
    expect(cashOf(r.state, 'p1')).toBe(1500 + 80);

    const airport = sell(r.state, 'p1', 5);
    expect(airport.error).toBeUndefined();
    expect(cashOf(airport.state, 'p1')).toBe(1500 + 80 + 100);
    const company = sell(airport.state, 'p1', 11);
    expect(company.error).toBeUndefined();
    expect(cashOf(company.state, 'p1')).toBe(1500 + 80 + 100 + 75);
    expect(company.state.tiles[11]!.owner).toBeNull();
  });

  it('works in AWAITING_END_TURN as well as AWAITING_ROLL', () => {
    let state = started();
    state = updateTile(state, 13, { owner: 'p1' });
    state = { ...state, phase: 'AWAITING_END_TURN' };
    expect(sell(state, 'p1', 13).error).toBeUndefined();
  });

  it('leaves the vacation pot alone', () => {
    let state = started({ vacationCash: true });
    state = updateTile(state, 5, { owner: 'p1' });
    state = { ...state, vacationPot: 300 };
    const r = sell(state, 'p1', 5);
    expect(r.error).toBeUndefined();
    expect(r.state.vacationPot).toBe(300);
  });

  it('refuses while any city in the country has buildings, including a bare tile beside a built one', () => {
    let state = started();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1' });
    state = updateTile(state, 12, { houses: 1 });

    for (const i of [12, 13]) {
      const r = sell(state, 'p1', i);
      expect(r.error).toBe('Sell the buildings in Japan first');
      expect(r.state).toBe(state);
    }

    state = updateTile(state, 12, { houses: 0, hotel: true });
    expect(sell(state, 'p1', 13).error).toBe('Sell the buildings in Japan first');

    // Another country's buildings don't matter.
    state = updateTile(state, 6, { owner: 'p1' });
    expect(sell(state, 'p1', 6).error).toBeUndefined();
  });

  it('refuses a tile the seller does not own, and a tile that is not a property', () => {
    let state = started();
    state = updateTile(state, 13, { owner: 'p2' });
    expect(sell(state, 'p1', 13).error).toBe('You do not own this property');
    expect(sell(state, 'p1', 1).error).toBe('You do not own this property');
    expect(sell(state, 'p1', 0).error).toBeTruthy();
    expect(sell(state, 'p1', 999).error).toBeTruthy();
  });

  it('refuses off-turn and outside the build window', () => {
    let state = started();
    state = updateTile(state, 6, { owner: 'p2' });
    state = updateTile(state, 13, { owner: 'p1' });
    expect(sell(state, 'p2', 6).error).toBe('Cannot sell right now');

    // p1 rolls 2+3 onto the unowned airport at 5: mid-move, not a sale window.
    const buying = act(state, 'p1', { type: 'roll' }, queueRng([dieVal(2), dieVal(3)])).state;
    expect(buying.phase).toBe('AWAITING_BUY');
    expect(sell(buying, 'p1', 13).error).toBe('Cannot sell right now');

    expect(sell({ ...state, phase: 'GAME_OVER' }, 'p1', 13).error).toBeTruthy();
  });

  it("routes a debtor's proceeds to the creditor", () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2', houses: 4 }); // rent 360
    state = updateTile(state, 5, { owner: 'p1' });
    state = updatePlayer(state, 'p1', { cash: 1 });
    state = act(state, 'p1', { type: 'roll' }, queueRng([dieVal(1), dieVal(2)])).state;
    expect(state.phase).toBe('RESOLVING_DEBT');
    expect(cashOf(state, 'p1')).toBe(-359);
    const creditorBefore = cashOf(state, 'p2');

    // Not the debtor: p2 can't sell during p1's debt, even on p1's turn.
    state = updateTile(state, 6, { owner: 'p2' });
    expect(sell(state, 'p2', 6).error).toBe('Cannot sell right now');

    const r = sell(state, 'p1', 5);
    expect(r.error).toBeUndefined();
    expect(r.events).toEqual([
      { type: 'property_sold', playerId: 'p1', tileIndex: 5, amount: 100 },
      { type: 'paid', from: 'p1', to: 'p2', amount: 100, reason: 'debt' },
    ]);
    expect(cashOf(r.state, 'p2')).toBe(creditorBefore + 100);
    expect(cashOf(r.state, 'p1')).toBe(-259);
    expect(r.state.debt!.amount).toBe(259);
    expect(r.state.tiles[5]!.owner).toBeNull();
  });

  it('clears the debt when the sale covers it', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2' }); // rent 6
    state = updateTile(state, 5, { owner: 'p1' });
    state = updatePlayer(state, 'p1', { cash: 1 });
    state = act(state, 'p1', { type: 'roll' }, queueRng([dieVal(1), dieVal(2)])).state;
    expect(state.phase).toBe('RESOLVING_DEBT');

    const r = sell(state, 'p1', 5);
    expect(r.error).toBeUndefined();
    expect(r.state.debt).toBeNull();
    expect(r.state.phase).toBe('AWAITING_END_TURN');
    expect(cashOf(r.state, 'p1')).toBe(95);
    expect(r.events.at(-1)).toEqual({ type: 'debt_cleared', playerId: 'p1' });
  });

  it('drops pending trades that list the sold tile', () => {
    const empty: TradeSide = { cash: 0, tiles: [], pardonCards: 0 };
    let state = started();
    state = updateTile(state, 5, { owner: 'p1' });
    state = updateTile(state, 16, { owner: 'p1' });
    state = act(state, 'p1', { type: 'propose_trade', to: 'p2', offer: { ...empty, tiles: [5] }, request: { ...empty, cash: 50 } }).state;
    state = act(state, 'p2', { type: 'propose_trade', to: 'p1', offer: { ...empty, cash: 10 }, request: { ...empty, tiles: [16] } }).state;
    expect(state.trades).toHaveLength(2);

    const r = sell(state, 'p1', 5);
    expect(r.error).toBeUndefined();
    expect(r.state.trades.map((t) => t.id)).toEqual(['trade-1']);
    expect(r.events).toContainEqual({ type: 'trade_cancelled', tradeId: 'trade-0', reason: 'invalid' });
  });

  it('is listed by legalActions only for tiles that would pass', () => {
    let state = started();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { owner: 'p1' });
    state = updateTile(state, 12, { houses: 1 });
    state = updateTile(state, 5, { owner: 'p1' });
    state = updateTile(state, 6, { owner: 'p2' });

    const sales = legalActions(SMALL_MAP, state, 'p1').filter((a) => a.type === 'sell_property');
    expect(sales).toEqual([{ type: 'sell_property', tileIndex: 5 }]);
    expect(legalActions(SMALL_MAP, state, 'p2').some((a) => a.type === 'sell_property')).toBe(false);
  });
});
