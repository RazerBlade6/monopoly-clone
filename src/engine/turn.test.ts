import { describe, expect, it } from 'vitest';
import { createGame, reduce } from './index';
import { legalActions } from './legal';
import { SMALL_MAP } from './fixtures';
import { dieVal, identityRng, queueRng, settingsFor } from './fixtures';
import { updatePlayer, walkForward } from './state';

const P1 = { id: 'p1', name: 'Ann', color: 'red' };
const P2 = { id: 'p2', name: 'Bo', color: 'blue' };

function startedGame(overrides = {}) {
  const settings = settingsFor({ randomizePlayerOrder: false, ...overrides });
  const state = createGame(SMALL_MAP, [P1, P2], settings, identityRng);
  const { state: started } = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, identityRng);
  return started;
}

describe('createGame / start_game', () => {
  it('starts in LOBBY, both players seated at start with starting cash', () => {
    const state = createGame(SMALL_MAP, [P1, P2], settingsFor(), identityRng);
    expect(state.phase).toBe('LOBBY');
    expect(state.players).toHaveLength(2);
    for (const p of state.players) {
      expect(p.cash).toBe(state.settings.startingCash);
      expect(p.tileIndex).toBe(SMALL_MAP.startIndex);
    }
  });

  it('start_game moves to AWAITING_ROLL for the first player in turn order', () => {
    const started = startedGame();
    expect(started.phase).toBe('AWAITING_ROLL');
    expect(started.turnOrder[started.currentPlayerIndex]).toBe(started.turnOrder[0]);
  });

  it('rejects start_game from a non-existent player without mutating state', () => {
    const state = createGame(SMALL_MAP, [P1, P2], settingsFor(), identityRng);
    const r = reduce(SMALL_MAP, state, { playerId: 'ghost', action: { type: 'start_game' } }, identityRng);
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(state);
  });
});

describe('roll / move / buy / pass', () => {
  it('a non-double roll moves the player and offers a buy on an unowned tile', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    // 1+2 = 3 spaces from START lands on tile 3 (unowned city)
    const rng = queueRng([dieVal(1), dieVal(2)]);
    const r = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, rng);
    expect(r.error).toBeUndefined();
    expect(r.state.phase).toBe('AWAITING_BUY');
    const player = r.state.players.find((p) => p.id === currentId)!;
    expect(player.tileIndex).toBe(3);
    expect(r.events.some((e) => e.type === 'rolled')).toBe(true);
    expect(r.events.some((e) => e.type === 'moved')).toBe(true);
  });

  it('buy transfers cash and ownership; ending the turn instead leaves the tile unowned', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    const rolled = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;

    const bought = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'buy' } }, identityRng);
    expect(bought.error).toBeUndefined();
    expect(bought.state.tiles[3]!.owner).toBe(currentId);
    const price = (SMALL_MAP.tiles[3] as { price: number }).price;
    const buyerCashAfter = bought.state.players.find((p) => p.id === currentId)!.cash;
    expect(buyerCashAfter).toBe(started.settings.startingCash - price);
    expect(bought.state.phase).toBe('AWAITING_END_TURN');

    // Passing from the same roll: there is no decline, ending the turn is how you say no.
    const passed = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'end_turn' } }, identityRng);
    expect(passed.error).toBeUndefined();
    expect(passed.state.tiles[3]!.owner).toBeNull();
    expect(passed.state.phase).toBe('AWAITING_ROLL');
    expect(passed.state.turnOrder[passed.state.currentPlayerIndex]).not.toBe(currentId);
    expect(passed.events.some((e) => e.type === 'turn_ended')).toBe(true);
  });

  it('offers buy plus end turn on an unowned tile, and nothing to decline', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    const rolled = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
    const types = legalActions(SMALL_MAP, rolled, currentId).map((a) => a.type);
    expect(types).toContain('buy');
    expect(types).toContain('end_turn');
    expect(types).not.toContain('roll');
    // Rolling is still refused: without doubles, the turn is over once you pass.
    const r = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(r.error).toBeDefined();
    expect(r.state).toBe(rolled);
  });

  it('after doubles onto an unowned tile, rolling again passes on it; ending the turn is refused', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    // (3,3): tile0 -> tile6, an unowned city.
    const rolled = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(3)])).state;
    expect(rolled.phase).toBe('AWAITING_BUY');
    const types = legalActions(SMALL_MAP, rolled, currentId).map((a) => a.type);
    expect(types).toContain('buy');
    expect(types).toContain('roll');
    expect(types).not.toContain('end_turn');

    const ended = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'end_turn' } }, identityRng);
    expect(ended.error).toBeDefined();
    expect(ended.state).toBe(rolled);

    // (1,2): tile6 -> tile9, a surprise card — anything but another buy prompt works here.
    const again = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(again.error).toBeUndefined();
    expect(again.state.tiles[6]!.owner).toBeNull();
    expect(again.state.players.find((p) => p.id === currentId)!.tileIndex).not.toBe(6);
  });

  it('building is allowed while a purchase is on offer', () => {
    let state = startedGame();
    const currentId = state.turnOrder[state.currentPlayerIndex]!;
    // Own the whole Brazil set (tiles 1 and 3) up front, then land on an unowned tile.
    state = { ...state, tiles: state.tiles.map((t, i) => (i === 1 || i === 3 ? { ...t, owner: currentId } : t)) };
    const rolled = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(3)])).state;
    expect(rolled.phase).toBe('AWAITING_BUY');
    const built = reduce(SMALL_MAP, rolled, { playerId: currentId, action: { type: 'buy_house', tileIndex: 1 } }, identityRng);
    expect(built.error).toBeUndefined();
    expect(built.state.tiles[1]!.houses).toBe(1);
    expect(built.state.phase).toBe('AWAITING_BUY');
  });

  it('rejects rolling out of turn, leaving state unchanged', () => {
    const started = startedGame();
    const other = started.turnOrder[(started.currentPlayerIndex + 1) % started.turnOrder.length]!;
    const r = reduce(SMALL_MAP, started, { playerId: other, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(4)]));
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(started);
  });

  it('walkForward flags passedStart both when wrapping past START and when landing exactly on it', () => {
    const past = walkForward(SMALL_MAP, 21, 2); // 21 -> 1, wraps through 0
    expect(past).toEqual({ to: 1, passedStart: true });
    const exact = walkForward(SMALL_MAP, 20, 2); // 20 -> 0 exactly
    expect(exact).toEqual({ to: 0, passedStart: true });
    const neither = walkForward(SMALL_MAP, 1, 2); // 1 -> 3, nowhere near START
    expect(neither).toEqual({ to: 3, passedStart: false });
  });

  it('landing exactly on START via a card pays the salary plus the landOnStartBonus, as two separate paid events', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    const cashBefore = started.players.find((p) => p.id === currentId)!.cash;
    // (1,1): tile0 -> tile2 (treasure). With the deck unshuffled (identityRng), the first card is
    // treasure-01: move_to(0, collectStart:true) — teleports back to START, paying the salary leg
    // via collectStart and the landOnStartBonus leg via resolveLanding's corner branch (issue 5).
    const r = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(1)]));
    const player = r.state.players.find((p) => p.id === currentId)!;
    expect(player.tileIndex).toBe(0);
    expect(player.cash).toBe(cashBefore + r.state.settings.startSalary + r.state.settings.landOnStartBonus);
    expect(r.events.some((e) => e.type === 'card_drawn')).toBe(true);
    expect(r.events.some((e) => e.type === 'paid' && e.reason === 'start_salary' && e.amount === r.state.settings.startSalary)).toBe(true);
    expect(r.events.some((e) => e.type === 'paid' && e.reason === 'start_bonus' && e.amount === r.state.settings.landOnStartBonus)).toBe(true);
  });
});

describe('doubles', () => {
  it('rolling doubles grants an immediate reroll (AWAITING_ROLL again)', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    // (2,2): tile0 -> tile4, the tax bonus tile (non-ownable, so no buy prompt intervenes).
    const r = reduce(SMALL_MAP, started, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(2)]));
    expect(r.state.phase).toBe('AWAITING_ROLL');
    expect(r.state.doublesCount).toBe(1);
  });

  it('three consecutive doubles sends the player to jail with no landing resolution', () => {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    let state = started;
    let events;
    // (2,2): tile0 -> tile4 (tax, non-ownable).
    ({ state, events } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(2)])));
    expect(state.phase).toBe('AWAITING_ROLL');
    // (5,5): tile4 -> tile14 (premium-tax, non-ownable).
    ({ state, events } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(5), dieVal(5)])));
    expect(state.phase).toBe('AWAITING_ROLL');
    // Third double: sent to jail with no landing resolution, regardless of what tile it would be.
    ({ state, events } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(6), dieVal(6)])));
    expect(state.phase).toBe('AWAITING_END_TURN');
    const player = state.players.find((p) => p.id === currentId)!;
    expect(player.inJail).toBe(true);
    expect(player.tileIndex).toBe(SMALL_MAP.jailIndex);
    expect(events.some((e) => e.type === 'jailed' && e.reason === 'doubles')).toBe(true);
    // No 'bought'/'moved' landing-resolution event from this third roll.
    expect(events.some((e) => e.type === 'moved')).toBe(false);
  });
});

describe('jail', () => {
  function jailedState() {
    const started = startedGame();
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    let state = started;
    ({ state } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(2), dieVal(2)])));
    ({ state } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(5), dieVal(5)])));
    ({ state } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(6), dieVal(6)])));
    ({ state } = reduce(SMALL_MAP, state, { playerId: currentId, action: { type: 'end_turn' } }, identityRng));
    return { state, jailedId: currentId };
  }

  it('pay_jail_fee releases the player and ends their turn immediately, with no roll of their own', () => {
    let { state, jailedId } = jailedState();
    // advance turns back around to the jailed player
    while (state.turnOrder[state.currentPlayerIndex] !== jailedId) {
      state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
      if (state.phase === 'AWAITING_BUY' || state.phase === 'AWAITING_END_TURN') state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'end_turn' } }, identityRng).state;
    }
    const before = state.players.find((p) => p.id === jailedId)!;
    expect(before.inJail).toBe(true);
    const r = reduce(SMALL_MAP, state, { playerId: jailedId, action: { type: 'pay_jail_fee' } }, identityRng);
    expect(r.error).toBeUndefined();
    const after = r.state.players.find((p) => p.id === jailedId)!;
    expect(after.inJail).toBe(false);
    expect(after.cash).toBe(before.cash - state.settings.jailFee);
    expect(r.state.phase).toBe('AWAITING_ROLL');
    // The turn moved on to someone else — the payer does not get to roll on the same turn
    // they paid their way out (issue 1).
    expect(r.state.turnOrder[r.state.currentPlayerIndex]).not.toBe(jailedId);
    expect(r.events.some((e) => e.type === 'turn_ended')).toBe(true);
  });

  it('rolling doubles in jail escapes but never grants a bonus reroll', () => {
    let { state, jailedId } = jailedState();
    while (state.turnOrder[state.currentPlayerIndex] !== jailedId) {
      state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
      if (state.phase === 'AWAITING_BUY' || state.phase === 'AWAITING_END_TURN') state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'end_turn' } }, identityRng).state;
    }
    // From jail (tile 7), (3,3) lands on tile 13 — an unowned city, so a normal buy prompt is
    // still owed (escaping jail still resolves the landed tile). Passing on it ends the turn —
    // no bonus reroll for escaping jail via doubles.
    let r = reduce(SMALL_MAP, state, { playerId: jailedId, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(3)]));
    const player = r.state.players.find((p) => p.id === jailedId)!;
    expect(player.inJail).toBe(false);
    expect(r.events.some((e) => e.type === 'left_jail' && e.how === 'doubles')).toBe(true);
    expect(r.state.phase).toBe('AWAITING_BUY');
    const types = legalActions(SMALL_MAP, r.state, jailedId).map((a) => a.type);
    expect(types).toContain('end_turn');
    expect(types).not.toContain('roll');
  });

  it('three failed attempts force-pays the fee and moves on the third roll', () => {
    let { state, jailedId } = jailedState();
    while (state.turnOrder[state.currentPlayerIndex] !== jailedId) {
      state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)])).state;
      if (state.phase === 'AWAITING_BUY' || state.phase === 'AWAITING_END_TURN') state = reduce(SMALL_MAP, state, { playerId: state.turnOrder[state.currentPlayerIndex]!, action: { type: 'end_turn' } }, identityRng).state;
    }
    const cashBefore = state.players.find((p) => p.id === jailedId)!.cash;
    // Three non-double attempts.
    let r = reduce(SMALL_MAP, state, { playerId: jailedId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    expect(r.state.players.find((p) => p.id === jailedId)!.inJail).toBe(true);
    expect(r.state.phase).toBe('AWAITING_END_TURN');
    r = reduce(SMALL_MAP, r.state, { playerId: jailedId, action: { type: 'end_turn' } }, identityRng);
    while (r.state.turnOrder[r.state.currentPlayerIndex] !== jailedId) {
      const cur = r.state.turnOrder[r.state.currentPlayerIndex]!;
      r = reduce(SMALL_MAP, r.state, { playerId: cur, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
      if (r.state.phase === 'AWAITING_BUY' || r.state.phase === 'AWAITING_END_TURN') r = reduce(SMALL_MAP, r.state, { playerId: cur, action: { type: 'end_turn' } }, identityRng);
    }
    r = reduce(SMALL_MAP, r.state, { playerId: jailedId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    r = reduce(SMALL_MAP, r.state, { playerId: jailedId, action: { type: 'end_turn' } }, identityRng);
    while (r.state.turnOrder[r.state.currentPlayerIndex] !== jailedId) {
      const cur = r.state.turnOrder[r.state.currentPlayerIndex]!;
      r = reduce(SMALL_MAP, r.state, { playerId: cur, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
      if (r.state.phase === 'AWAITING_BUY' || r.state.phase === 'AWAITING_END_TURN') r = reduce(SMALL_MAP, r.state, { playerId: cur, action: { type: 'end_turn' } }, identityRng);
    }
    // Third attempt: forced exit + move.
    const third = reduce(SMALL_MAP, r.state, { playerId: jailedId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    const player = third.state.players.find((p) => p.id === jailedId)!;
    expect(player.inJail).toBe(false);
    expect(player.jailTurns).toBe(0);
    expect(player.tileIndex).toBe((SMALL_MAP.jailIndex + 3) % SMALL_MAP.tiles.length);
    expect(third.events.some((e) => e.type === 'left_jail' && e.how === 'served')).toBe(true);
    expect(player.cash).toBe(cashBefore - state.settings.jailFee);
  });
});

describe('vacation corner', () => {
  it('pools bank-bound payments and pays out the whole pot when vacationCash is on', () => {
    const started = startedGame({ vacationCash: true });
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    const atTax = updatePlayer(started, currentId, { tileIndex: 12 });
    // (1,1): tile12 -> tile14, premium-tax (flat 75) — feeds the pot.
    const taxed = reduce(SMALL_MAP, atTax, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(1)]));
    expect(taxed.state.vacationPot).toBe(75);
    expect(taxed.events.some((e) => e.type === 'paid' && e.reason === 'premium_tax' && e.amount === 75)).toBe(true);

    const atVacation = updatePlayer(taxed.state, currentId, { tileIndex: 19 });
    // (1,1) again: tile19 -> tile21, Vacation — collects the whole pot and resets it.
    const arrived = reduce(SMALL_MAP, atVacation, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(1)]));
    expect(arrived.state.vacationPot).toBe(0);
    expect(arrived.events.some((e) => e.type === 'paid' && e.reason === 'vacation_pot' && e.amount === 75)).toBe(true);
    const player = arrived.state.players.find((p) => p.id === currentId)!;
    expect(player.cash).toBe(started.settings.startingCash); // taxed 75, then the pot refunds exactly 75
  });

  it('never accumulates and never pays out when vacationCash is off', () => {
    const started = startedGame({ vacationCash: false });
    const currentId = started.turnOrder[started.currentPlayerIndex]!;
    const atTax = updatePlayer(started, currentId, { tileIndex: 12 });
    const taxed = reduce(SMALL_MAP, atTax, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(1)]));
    expect(taxed.state.vacationPot).toBe(0);

    const atVacation = updatePlayer(taxed.state, currentId, { tileIndex: 19 });
    const arrived = reduce(SMALL_MAP, atVacation, { playerId: currentId, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(1)]));
    expect(arrived.state.vacationPot).toBe(0);
    expect(arrived.events.some((e) => e.type === 'paid' && e.reason === 'vacation_pot')).toBe(false);
  });

  it('sets skipTurns on landing, and the engine skips that player exactly once when their turn comes round', () => {
    const started = startedGame();
    const p1 = started.turnOrder[0]!;
    const p2 = started.turnOrder[1]!;

    const atTile14 = updatePlayer(started, p1, { tileIndex: 14 });
    // (3,4): tile14 -> tile21, Vacation — not a double, so this ends the turn normally.
    const landed = reduce(SMALL_MAP, atTile14, { playerId: p1, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(4)]));
    expect(landed.state.phase).toBe('AWAITING_END_TURN');
    expect(landed.state.players.find((p) => p.id === p1)!.skipTurns).toBe(1);

    const toP2 = reduce(SMALL_MAP, landed.state, { playerId: p1, action: { type: 'end_turn' } }, identityRng);
    expect(toP2.state.turnOrder[toP2.state.currentPlayerIndex]).toBe(p2);
    expect(toP2.events.some((e) => e.type === 'turn_skipped')).toBe(false);

    // p2's turn ends next, which would normally hand back to p1 — but p1 is still sitting
    // out, so with only two players the table skips straight back to p2 instead of stalling.
    const s = reduce(SMALL_MAP, toP2.state, { playerId: p2, action: { type: 'roll' } }, queueRng([dieVal(1), dieVal(2)]));
    const backToP2 = reduce(SMALL_MAP, s.state, { playerId: p2, action: { type: 'end_turn' } }, identityRng);
    expect(backToP2.events.some((e) => e.type === 'turn_skipped' && e.playerId === p1)).toBe(true);
    expect(backToP2.state.turnOrder[backToP2.state.currentPlayerIndex]).toBe(p2);
    expect(backToP2.state.players.find((p) => p.id === p1)!.skipTurns).toBe(0);
  });

  it('degenerate case: two players both sitting out at once resolves in one pass, logging only the one truly passed over', () => {
    const started = startedGame();
    const p1 = started.turnOrder[0]!;
    const p2 = started.turnOrder[1]!;

    // p2 goes first this time: force it to be p2's turn, and land them on Vacation.
    const p2Turn = { ...started, currentPlayerIndex: 1 };
    const p2AtTile14 = updatePlayer(p2Turn, p2, { tileIndex: 14 });
    const p2Landed = reduce(SMALL_MAP, p2AtTile14, { playerId: p2, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(4)]));
    expect(p2Landed.state.players.find((p) => p.id === p2)!.skipTurns).toBe(1);
    const toP1 = reduce(SMALL_MAP, p2Landed.state, { playerId: p2, action: { type: 'end_turn' } }, identityRng);
    expect(toP1.state.turnOrder[toP1.state.currentPlayerIndex]).toBe(p1); // p2's pending skip isn't due yet

    // Now p1 also lands on Vacation, with p2's skip still outstanding from before.
    const p1AtTile14 = updatePlayer(toP1.state, p1, { tileIndex: 14 });
    const p1Landed = reduce(SMALL_MAP, p1AtTile14, { playerId: p1, action: { type: 'roll' } }, queueRng([dieVal(3), dieVal(4)]));
    expect(p1Landed.state.players.find((p) => p.id === p1)!.skipTurns).toBe(1);

    // Both players are now skipping. With only two players this collapses into one
    // resolution: p2's skip and p1's skip are both consumed, but p2 — who ends up with
    // the turn — isn't the one logged as skipped; p1 is.
    const result = reduce(SMALL_MAP, p1Landed.state, { playerId: p1, action: { type: 'end_turn' } }, identityRng);
    expect(result.state.turnOrder[result.state.currentPlayerIndex]).toBe(p2);
    expect(result.events.filter((e) => e.type === 'turn_skipped')).toEqual([{ type: 'turn_skipped', playerId: p1 }]);
    expect(result.state.players.find((p) => p.id === p1)!.skipTurns).toBe(0);
    expect(result.state.players.find((p) => p.id === p2)!.skipTurns).toBe(0);
  });
});

describe('determinism', () => {
  it('same seed and same action sequence produce identical resulting state', () => {
    const settings = settingsFor({ randomizePlayerOrder: false });

    function run(seed: number) {
      let n = seed;
      const rng = () => {
        // simple deterministic LCG, seeded identically across both runs
        n = (n * 1103515245 + 12345) & 0x7fffffff;
        return (n % 10000) / 10000;
      };
      let state = createGame(SMALL_MAP, [P1, P2], settings, rng);
      state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, rng).state;
      for (let i = 0; i < 15; i++) {
        const cur = state.turnOrder[state.currentPlayerIndex]!;
        if (state.phase === 'AWAITING_ROLL') {
          state = reduce(SMALL_MAP, state, { playerId: cur, action: { type: 'roll' } }, rng).state;
        } else if (state.phase === 'AWAITING_BUY' || state.phase === 'AWAITING_END_TURN') {
          state = reduce(SMALL_MAP, state, { playerId: cur, action: { type: 'end_turn' } }, rng).state;
        } else {
          break;
        }
      }
      return state;
    }

    const a = run(42);
    const b = run(42);
    expect(a).toEqual(b);
  });
});
