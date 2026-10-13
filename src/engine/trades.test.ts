import { describe, expect, it } from 'vitest';
import type { GameAction, GameState, RoomSettings, TradeSide } from '../shared/types';
import { createGame, legalActions, reduce } from './index';
import { SMALL_MAP, dieVal, identityRng, queueRng, settingsFor } from './fixtures';
import { updatePlayer, updateTile } from './state';

const P1 = { id: 'p1', name: 'Ann', color: 'red' };
const P2 = { id: 'p2', name: 'Bo', color: 'blue' };
const P3 = { id: 'p3', name: 'Cy', color: 'green' };

const NOTHING: TradeSide = { cash: 0, tiles: [], pardonCards: 0 };
const side = (s: Partial<TradeSide>): TradeSide => ({ ...NOTHING, ...s });

function started(overrides: Partial<RoomSettings> = {}, players = [P1, P2, P3]): GameState {
  const settings = settingsFor({ randomizePlayerOrder: false, ...overrides });
  const state = createGame(SMALL_MAP, players, settings, identityRng);
  return reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, identityRng).state;
}

function act(state: GameState, playerId: string, action: GameAction) {
  return reduce(SMALL_MAP, state, { playerId, action }, identityRng);
}

function propose(state: GameState, from: string, to: string, offer: Partial<TradeSide>, request: Partial<TradeSide> = {}, counterOf?: string) {
  const action: GameAction = counterOf
    ? { type: 'propose_trade', to, offer: side(offer), request: side(request), counterOf }
    : { type: 'propose_trade', to, offer: side(offer), request: side(request) };
  return act(state, from, action);
}

/** Proposes and fails the test if the engine refuses. */
function proposed(state: GameState, from: string, to: string, offer: Partial<TradeSide>, request: Partial<TradeSide> = {}): GameState {
  const r = propose(state, from, to, offer, request);
  expect(r.error).toBeUndefined();
  return r.state;
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)!.cash;
}

/**
 * p1 (current) lands on p2's tile 3 with 4 houses (rent 360) holding $100, so pays 100 and
 * owes 260. p1 owns the India city at 6 ($100), Japan cities 12 and 13 ($150, $160) and an
 * airport at 5, all unbuilt.
 */
function p1InDebt(overrides: Partial<RoomSettings> = {}): GameState {
  let state = started(overrides);
  state = updateTile(state, 3, { owner: 'p2', houses: 4 });
  for (const i of [5, 6, 12, 13]) state = updateTile(state, i, { owner: 'p1' });
  state = updatePlayer(state, 'p1', { cash: 100 });
  const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
  expect(r.state.phase).toBe('RESOLVING_DEBT');
  expect(cashOf(r.state, 'p1')).toBe(-260);
  return r.state;
}

describe('proposing and answering a trade', () => {
  it('a valid propose then accept moves cash, tiles and pardon cards both ways', () => {
    let state = started();
    state = updateTile(state, 6, { owner: 'p1' });
    state = updateTile(state, 12, { owner: 'p2' });
    state = updatePlayer(state, 'p1', { pardonCards: 1 });

    const p = propose(state, 'p1', 'p2', { tiles: [6], cash: 200, pardonCards: 1 }, { tiles: [12], cash: 50 });
    expect(p.error).toBeUndefined();
    const trade = { id: 'trade-0', from: 'p1', to: 'p2', offer: side({ tiles: [6], cash: 200, pardonCards: 1 }), request: side({ tiles: [12], cash: 50 }) };
    expect(p.events).toEqual([{ type: 'trade_proposed', trade }]);
    expect(p.state.trades).toEqual([trade]);
    expect(p.state.nextTradeId).toBe(1);
    expect(p.state.tradeSendCounts['p1>p2']).toBe(1);

    const a = act(p.state, 'p2', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(a.error).toBeUndefined();
    expect(a.events[0]).toEqual({ type: 'trade_accepted', trade });
    expect(a.state.tiles[6]!.owner).toBe('p2');
    expect(a.state.tiles[12]!.owner).toBe('p1');
    expect(cashOf(a.state, 'p1')).toBe(1500 - 200 + 50);
    expect(cashOf(a.state, 'p2')).toBe(1500 + 200 - 50);
    expect(a.state.players.find((p) => p.id === 'p1')!.pardonCards).toBe(0);
    expect(a.state.players.find((p) => p.id === 'p2')!.pardonCards).toBe(1);
    expect(a.state.trades).toEqual([]);
  });

  it('works off-turn and in any running phase, including AWAITING_BUY', () => {
    let state = started();
    // p1 rolls 2+3 onto the unowned airport at 5.
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(3)])).state;
    expect(state.phase).toBe('AWAITING_BUY');
    state = proposed(state, 'p2', 'p3', { cash: 10 });
    const a = act(state, 'p3', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(a.error).toBeUndefined();
    expect(a.state.phase).toBe('AWAITING_BUY');
  });

  it('decline removes the trade; only the recipient may decline or accept', () => {
    const state = proposed(started(), 'p1', 'p2', { cash: 10 });
    expect(act(state, 'p1', { type: 'decline_trade', tradeId: 'trade-0' }).error).toBeTruthy();
    expect(act(state, 'p1', { type: 'accept_trade', tradeId: 'trade-0' }).error).toBeTruthy();
    expect(act(state, 'p3', { type: 'accept_trade', tradeId: 'trade-0' }).error).toBeTruthy();
    const d = act(state, 'p2', { type: 'decline_trade', tradeId: 'trade-0' });
    expect(d.error).toBeUndefined();
    expect(d.events).toEqual([{ type: 'trade_declined', tradeId: 'trade-0', from: 'p1', to: 'p2' }]);
    expect(d.state.trades).toEqual([]);
    expect(cashOf(d.state, 'p1')).toBe(1500);
  });

  it('cancel withdraws the trade; only the proposer may cancel', () => {
    const state = proposed(started(), 'p1', 'p2', { cash: 10 });
    expect(act(state, 'p2', { type: 'cancel_trade', tradeId: 'trade-0' }).error).toBeTruthy();
    const c = act(state, 'p1', { type: 'cancel_trade', tradeId: 'trade-0' });
    expect(c.events).toEqual([{ type: 'trade_cancelled', tradeId: 'trade-0', reason: 'withdrawn' }]);
    expect(c.state.trades).toEqual([]);
    expect(act(c.state, 'p2', { type: 'accept_trade', tradeId: 'trade-0' }).error).toBeTruthy();
  });

  it('legalActions offers accept/decline to the recipient and cancel to the proposer', () => {
    const state = proposed(started(), 'p1', 'p2', { cash: 10 });
    expect(legalActions(SMALL_MAP, state, 'p2')).toEqual(
      expect.arrayContaining([{ type: 'accept_trade', tradeId: 'trade-0' }, { type: 'decline_trade', tradeId: 'trade-0' }]),
    );
    expect(legalActions(SMALL_MAP, state, 'p1')).toContainEqual({ type: 'cancel_trade', tradeId: 'trade-0' });
    expect(legalActions(SMALL_MAP, state, 'p3').some((a) => a.type.endsWith('_trade'))).toBe(false);
  });
});

describe('refusals', () => {
  function refused(state: GameState, from: string, to: string, offer: Partial<TradeSide>, request: Partial<TradeSide> = {}): string {
    const r = propose(state, from, to, offer, request);
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(state);
    return r.error!;
  }

  it('only one pending trade per ordered pair', () => {
    const state = proposed(started(), 'p1', 'p2', { cash: 10 });
    refused(state, 'p1', 'p2', { cash: 20 });
    expect(propose(state, 'p2', 'p1', { cash: 20 }).error).toBeUndefined();
  });

  it('no self-trades, bankrupt parties, or trades outside a running game', () => {
    let state = started();
    refused(state, 'p1', 'p1', { cash: 10 });
    state = act(state, 'p3', { type: 'declare_bankruptcy' }).state;
    refused(state, 'p1', 'p3', { cash: 10 });
    refused(state, 'p3', 'p1', { cash: 10 });

    const lobby = createGame(SMALL_MAP, [P1, P2], settingsFor(), identityRng);
    refused(lobby, 'p1', 'p2', { cash: 10 });
  });

  it('tiles must be ownable, owned by that side, and listed once', () => {
    let state = started();
    state = updateTile(state, 6, { owner: 'p1' });
    refused(state, 'p1', 'p2', { tiles: [8] }); // unowned
    refused(state, 'p1', 'p2', {}, { tiles: [6] }); // p2 asked for p1's own tile
    refused(state, 'p1', 'p2', { tiles: [6, 6] });
    refused(state, 'p1', 'p2', { tiles: [0] }); // START is not property
    refused(state, 'p1', 'p2', { tiles: [999] });
  });

  it('cash and pardon cards are capped at what each side holds', () => {
    let state = started();
    state = updatePlayer(state, 'p2', { pardonCards: 1 });
    refused(state, 'p1', 'p2', { cash: 1501 });
    refused(state, 'p1', 'p2', {}, { cash: 1501 });
    refused(state, 'p1', 'p2', { pardonCards: 1 });
    refused(state, 'p1', 'p2', {}, { pardonCards: 2 });
    refused(state, 'p1', 'p2', { cash: -5 });
    refused(state, 'p1', 'p2', { cash: 1.5 });
    expect(propose(state, 'p1', 'p2', { cash: 1500 }, { pardonCards: 1 }).error).toBeUndefined();
  });

  it('no city from a country with buildings; airports and companies are always fine', () => {
    let state = started();
    for (const i of [6, 8, 10]) state = updateTile(state, i, { owner: 'p1' });
    state = updateTile(state, 8, { houses: 1 });
    state = updateTile(state, 5, { owner: 'p1' });
    state = updateTile(state, 11, { owner: 'p1' });
    expect(refused(state, 'p1', 'p2', { tiles: [6] })).toMatch(/Sell them first/);
    expect(propose(state, 'p1', 'p2', { tiles: [5, 11] }).error).toBeUndefined();
  });

  it('a trade must contain something', () => {
    refused(started(), 'p1', 'p2', {});
  });
});

describe('the per-turn send limit', () => {
  function sendAndWithdraw(state: GameState, from: string, to: string): GameState {
    const id = `trade-${state.nextTradeId}`;
    const s = proposed(state, from, to, { cash: 1 });
    return act(s, from, { type: 'cancel_trade', tradeId: id }).state;
  }

  function threeSent(state: GameState): GameState {
    for (let i = 0; i < 3; i++) state = sendAndWithdraw(state, 'p2', 'p3');
    return state;
  }

  it('refuses a 4th proposal to the same player in one turn, naming them', () => {
    const state = threeSent(started());
    const r = propose(state, 'p2', 'p3', { cash: 1 });
    expect(r.error).toBe("You've sent 3 trades to Cy this turn. Try again next turn.");
    // Other pairs, including the reverse direction, are unaffected.
    expect(propose(state, 'p3', 'p2', { cash: 1 }).error).toBeUndefined();
    expect(propose(state, 'p2', 'p1', { cash: 1 }).error).toBeUndefined();
  });

  it('resets both directions when a trade between the pair is accepted', () => {
    let state = threeSent(started());
    state = proposed(state, 'p3', 'p2', { cash: 1 });
    state = act(state, 'p2', { type: 'accept_trade', tradeId: `trade-${state.nextTradeId - 1}` }).state;
    expect(state.tradeSendCounts['p2>p3']).toBe(0);
    expect(state.tradeSendCounts['p3>p2']).toBe(0);
    expect(propose(state, 'p2', 'p3', { cash: 1 }).error).toBeUndefined();
  });

  it('resets on a counter-offer, and the counter itself does not count', () => {
    let state = threeSent(started());
    state = proposed(state, 'p3', 'p2', { cash: 1 });
    const counter = propose(state, 'p2', 'p3', { cash: 2 }, {}, `trade-${state.nextTradeId - 1}`);
    expect(counter.error).toBeUndefined();
    expect(counter.state.tradeSendCounts['p2>p3']).toBe(0);
    expect(counter.state.tradeSendCounts['p3>p2']).toBe(0);
  });

  it('resets when the turn passes, but not on a doubles re-roll', () => {
    let state = threeSent(started());
    // p1 rolls 2+2 onto the Tax tile at 4 and rolls again: still p1's turn.
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(2)])).state;
    expect(state.phase).toBe('AWAITING_ROLL');
    expect(state.turnOrder[state.currentPlayerIndex]).toBe('p1');
    expect(propose(state, 'p2', 'p3', { cash: 1 }).error).toBeTruthy();

    // Then 1+2 from 4 onto the Prison corner (just visiting), and the turn ends.
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
    state = act(state, 'p1', { type: 'end_turn' }).state;
    expect(state.turnOrder[state.currentPlayerIndex]).toBe('p2');
    expect(state.tradeSendCounts).toEqual({});
    expect(propose(state, 'p2', 'p3', { cash: 1 }).error).toBeUndefined();
  });
});

describe('counter-offers', () => {
  it('replaces the original atomically with a trade back to its sender', () => {
    let state = started();
    state = updateTile(state, 6, { owner: 'p1' });
    state = proposed(state, 'p1', 'p2', { tiles: [6] }, { cash: 100 });
    const r = propose(state, 'p2', 'p1', { cash: 80 }, { tiles: [6] }, 'trade-0');
    expect(r.error).toBeUndefined();
    const counter = { id: 'trade-1', from: 'p2', to: 'p1', offer: side({ cash: 80 }), request: side({ tiles: [6] }) };
    expect(r.events).toEqual([
      { type: 'trade_cancelled', tradeId: 'trade-0', reason: 'countered' },
      { type: 'trade_proposed', trade: counter, counterOf: 'trade-0' },
    ]);
    expect(r.state.trades).toEqual([counter]);
  });

  it('only the recipient may counter, only back to the proposer, and only while the original is open', () => {
    let state = proposed(started(), 'p1', 'p2', { cash: 10 });
    expect(propose(state, 'p3', 'p1', { cash: 5 }, {}, 'trade-0').error).toBeTruthy();
    expect(propose(state, 'p2', 'p3', { cash: 5 }, {}, 'trade-0').error).toBeTruthy();
    expect(propose(state, 'p2', 'p1', { cash: 5 }, {}, 'trade-9').error).toBeTruthy();
    state = act(state, 'p1', { type: 'cancel_trade', tradeId: 'trade-0' }).state;
    expect(propose(state, 'p2', 'p1', { cash: 5 }, {}, 'trade-0').error).toBeTruthy();
  });
});

describe('re-validation', () => {
  it('accept checks the live state, not the state at proposal time', () => {
    let state = started();
    for (const i of [6, 8, 10]) state = updateTile(state, i, { owner: 'p1' });
    state = proposed(state, 'p1', 'p2', { tiles: [6], cash: 500 });

    const poorer = updatePlayer(state, 'p1', { cash: 100 });
    expect(act(poorer, 'p2', { type: 'accept_trade', tradeId: 'trade-0' }).error).toMatch(/doesn't have \$500/);

    const built = updateTile(state, 10, { houses: 1 });
    expect(act(built, 'p2', { type: 'accept_trade', tradeId: 'trade-0' }).error).toMatch(/Sell them first/);

    const sold = updateTile(state, 6, { owner: 'p3' });
    expect(act(sold, 'p2', { type: 'accept_trade', tradeId: 'trade-0' }).error).toMatch(/doesn't own/);
  });

  it('drops other pending trades that an accepted trade made impossible', () => {
    let state = started();
    state = updateTile(state, 6, { owner: 'p1' });
    state = proposed(state, 'p1', 'p2', { tiles: [6] }); // trade-0
    state = proposed(state, 'p3', 'p2', { cash: 5 }); // trade-1, unaffected
    state = proposed(state, 'p1', 'p3', { tiles: [6] }, { cash: 50 }); // trade-2
    const r = act(state, 'p3', { type: 'accept_trade', tradeId: 'trade-2' });
    expect(r.error).toBeUndefined();
    expect(r.events).toContainEqual({ type: 'trade_cancelled', tradeId: 'trade-0', reason: 'invalid' });
    expect(r.state.trades.map((t) => t.id)).toEqual(['trade-1']);
  });

  it('bankruptcy drops every trade involving that player, and GAME_OVER clears the rest', () => {
    let state = started();
    state = proposed(state, 'p1', 'p3', { cash: 5 }); // trade-0
    state = proposed(state, 'p3', 'p2', { cash: 5 }); // trade-1
    state = proposed(state, 'p1', 'p2', { cash: 5 }); // trade-2
    const r = act(state, 'p3', { type: 'declare_bankruptcy' });
    expect(r.events).toContainEqual({ type: 'trade_cancelled', tradeId: 'trade-0', reason: 'bankrupt' });
    expect(r.events).toContainEqual({ type: 'trade_cancelled', tradeId: 'trade-1', reason: 'bankrupt' });
    expect(r.state.trades.map((t) => t.id)).toEqual(['trade-2']);

    const over = act(r.state, 'p2', { type: 'declare_bankruptcy' });
    expect(over.state.phase).toBe('GAME_OVER');
    expect(over.state.trades).toEqual([]);
  });
});

describe('trades and debt', () => {
  it('a debtor may trade in RESOLVING_DEBT, and incoming cash pays the creditor and clears the debt', () => {
    const state = p1InDebt();
    const p2Before = cashOf(state, 'p2');
    // p3 buys the airport at 5 from p1 for $300.
    const s = proposed(state, 'p3', 'p1', { cash: 300 }, { tiles: [5] });
    const r = act(s, 'p1', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(r.error).toBeUndefined();
    expect(r.state.tiles[5]!.owner).toBe('p3');
    expect(cashOf(r.state, 'p1')).toBe(40);
    expect(cashOf(r.state, 'p2')).toBe(p2Before + 260);
    expect(r.events).toContainEqual({ type: 'paid', from: 'p1', to: 'p2', amount: 260, reason: 'debt' });
    expect(r.events).toContainEqual({ type: 'debt_cleared', playerId: 'p1' });
    expect(r.state.debt).toBeNull();
    expect(r.state.phase).toBe('AWAITING_END_TURN');
  });

  it('a partial rescue pays down the debt and leaves the rest owing', () => {
    const state = p1InDebt();
    const s = proposed(state, 'p1', 'p3', { tiles: [6] }, { cash: 100 });
    const r = act(s, 'p3', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(r.error).toBeUndefined();
    expect(cashOf(r.state, 'p1')).toBe(-160);
    expect(r.state.debt).toMatchObject({ amount: 160, creditor: 'p2' });
    expect(r.state.phase).toBe('RESOLVING_DEBT');
  });

  it("a debtor can't give away cash they don't have", () => {
    const state = p1InDebt();
    expect(propose(state, 'p1', 'p3', { cash: 1 }).error).toMatch(/doesn't have \$1/);
  });
});

describe('anti-collusion OFF (richup rule, default)', () => {
  it('blocks a debtor giving a city for $0, and allows it for $1', () => {
    const state = p1InDebt();
    expect(propose(state, 'p1', 'p3', { tiles: [6] }).error).toMatch(/bring in more cash than they give/);
    // Also when the other side proposes it.
    expect(propose(state, 'p3', 'p1', {}, { tiles: [6] }).error).toMatch(/bring in more cash/);
    expect(propose(state, 'p1', 'p3', { tiles: [6] }, { cash: 1 }).error).toBeUndefined();
  });

  it('is re-checked on accept, for a trade proposed before the debt opened', () => {
    let state = started();
    state = updateTile(state, 3, { owner: 'p2', houses: 4 });
    state = updateTile(state, 6, { owner: 'p1' });
    state = updatePlayer(state, 'p1', { cash: 100 });
    state = proposed(state, 'p1', 'p3', { tiles: [6] });
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
    expect(state.phase).toBe('RESOLVING_DEBT');
    expect(act(state, 'p3', { type: 'accept_trade', tradeId: 'trade-0' }).error).toMatch(/in debt/);
    expect(legalActions(SMALL_MAP, state, 'p3')).not.toContainEqual({ type: 'accept_trade', tradeId: 'trade-0' });
  });

  it('leaves players who are not in debt unrestricted', () => {
    let state = p1InDebt();
    state = updateTile(state, 8, { owner: 'p2' });
    expect(propose(state, 'p2', 'p3', { tiles: [8] }).error).toBeUndefined();
  });
});

describe('anti-collusion ON', () => {
  const on = { antiCollusion: true };

  it('blocks a city for $1 that does not clear the debt', () => {
    const state = p1InDebt(on);
    expect(propose(state, 'p1', 'p3', { tiles: [6] }, { cash: 1 }).error).toMatch(/Anti-collusion/);
  });

  it('allows a fair-value sale', () => {
    const state = p1InDebt(on);
    expect(propose(state, 'p1', 'p3', { tiles: [6] }, { cash: 100 }).error).toBeUndefined();
  });

  it('allows a trade that clears the debt even at a loss', () => {
    const state = p1InDebt(on);
    // Japan 12 + 13 are worth $310; $260 is exactly what p1 owes.
    const s = proposed(state, 'p1', 'p3', { tiles: [12, 13] }, { cash: 260 });
    const r = act(s, 'p3', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(r.error).toBeUndefined();
    expect(r.state.debt).toBeNull();
  });

  it('allows a pure gift to the debtor', () => {
    let state = p1InDebt(on);
    state = updateTile(state, 16, { owner: 'p3' });
    expect(propose(state, 'p3', 'p1', { tiles: [16] }).error).toBeUndefined();
    // Under the default rule a gift with no cash in it is refused.
    let off = p1InDebt();
    off = updateTile(off, 16, { owner: 'p3' });
    expect(propose(off, 'p3', 'p1', { tiles: [16] }).error).toBeTruthy();
  });

  it('counts pardon cards at the jail fee', () => {
    let state = p1InDebt(on);
    state = updatePlayer(state, 'p1', { pardonCards: 1 });
    expect(propose(state, 'p1', 'p3', { pardonCards: 1 }, { cash: 49 }).error).toBeTruthy();
    expect(propose(state, 'p1', 'p3', { pardonCards: 1 }, { cash: 50 }).error).toBeUndefined();
  });

  it('leaves players who are not in debt unrestricted', () => {
    let state = p1InDebt(on);
    state = updateTile(state, 8, { owner: 'p2' });
    expect(propose(state, 'p2', 'p3', { tiles: [8] }).error).toBeUndefined();
  });
});

describe('conservation', () => {
  function totals(state: GameState) {
    const owed = state.debt ? state.debt.amount + state.debt.queued.reduce((s, q) => s + q.amount, 0) : 0;
    return {
      money: state.players.reduce((s, p) => s + p.cash, 0) + owed + state.vacationPot,
      owned: state.tiles.filter((t) => t.owner !== null).length,
      pardons: state.players.reduce((s, p) => s + p.pardonCards, 0),
    };
  }

  it('trades and debt payments neither create nor destroy cash, deeds or pardon cards', () => {
    let state = started({ vacationCash: true });
    for (const i of [5, 6, 12]) state = updateTile(state, i, { owner: 'p1' });
    state = updateTile(state, 16, { owner: 'p3' });
    state = updatePlayer(state, 'p1', { cash: 30, pardonCards: 1 });
    const before = totals(state);

    // A bank debt: from 7, p1 rolls 3+4 onto Premium Tax (75), pays its 30 into the pot and owes 45.
    let t = updatePlayer(state, 'p1', { tileIndex: 7 });
    t = reduce(SMALL_MAP, t, { playerId: 'p1', action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(4)])).state;
    expect(t.phase).toBe('RESOLVING_DEBT');
    expect(totals(t)).toEqual(before);

    t = proposed(t, 'p3', 'p1', { cash: 40, tiles: [16] }, { tiles: [6], pardonCards: 1 });
    const first = act(t, 'p1', { type: 'accept_trade', tradeId: 'trade-0' });
    expect(first.error).toBeUndefined();
    t = first.state;
    expect(cashOf(t, 'p1')).toBe(-5);
    expect(totals(t)).toEqual(before);
    t = proposed(t, 'p1', 'p2', { tiles: [12] }, { cash: 200 });
    const second = act(t, 'p2', { type: 'accept_trade', tradeId: 'trade-1' });
    expect(second.error).toBeUndefined();
    t = second.state;
    expect(t.debt).toBeNull();
    expect(t.vacationPot).toBe(75);
    expect(totals(t)).toEqual(before);
  });
});
