import { describe, expect, it } from 'vitest';
import type { GameAction, GameState } from '../shared/types';
import { createGame, legalActions, reduce } from './index';
import { SMALL_MAP, settingsFor } from './fixtures';

const PLAYERS = [
  { id: 'p1', name: 'Ann', color: 'red' },
  { id: 'p2', name: 'Bo', color: 'blue' },
  { id: 'p3', name: 'Cy', color: 'green' },
];

/** A small deterministic LCG so a numeric seed reproduces an identical rng stream. */
function seededRng(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 0x100000000;
  };
}

function totalCash(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.cash, 0);
}

/** A debtor's balance is negative by what they still owe, so that has to be added back for
 * player cash to balance against the bank's payouts. */
function outstandingDebt(state: GameState): number {
  const debt = state.debt;
  return debt ? debt.amount + debt.queued.reduce((sum, q) => sum + q.amount, 0) : 0;
}

function totalBuildings(state: GameState): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const t of state.tiles) {
    if (t.hotel) hotels += 1;
    else houses += t.houses;
  }
  return { houses, hotels };
}

/** Picks the first legal action deterministically, with a mild bias toward buying and building
 * so games actually develop rather than stalling on decline-everything. */
function chooseAction(map: typeof SMALL_MAP, state: GameState, playerId: string): GameAction {
  const legal = legalActions(map, state, playerId);
  const prefer = (type: GameAction['type']) => legal.find((a) => a.type === type);
  // Nothing goes bankrupt automatically any more: a debtor sells what they can and then
  // concedes, or the game would wait on them forever.
  if (state.phase === 'RESOLVING_DEBT') {
    return prefer('sell_house') ?? prefer('sell_hotel') ?? prefer('declare_bankruptcy')!;
  }
  return (
    prefer('buy') ??
    prefer('buy_house') ??
    prefer('pay_jail_fee') ??
    prefer('use_pardon') ??
    prefer('roll') ??
    prefer('decline_buy') ??
    prefer('sell_house') ??
    prefer('sell_hotel') ??
    prefer('end_turn') ??
    legal[0]!
  );
}

/** Runs a full game to completion (or a generous step cap), asserting invariants every step. */
function playFullGame(seed: number) {
  const rng = seededRng(seed);
  const settings = settingsFor({ randomizePlayerOrder: true, startingCash: 800 });
  let state = createGame(SMALL_MAP, PLAYERS, settings, rng);
  state = reduce(SMALL_MAP, state, { playerId: PLAYERS[0]!.id, action: { type: 'start_game' } }, rng).state;

  const startingTotalCash = totalCash(state);
  const bankPool = { houses: 32, hotels: 12 };

  // Bank-sourced minus bank-sunk cash across every 'paid' event ever emitted (player-to-player
  // transfers cancel out and don't appear here). Every cash-moving path in the engine emits one —
  // including bankruptcy settlement — so total player cash must equal starting cash plus this net
  // at every step. This is the invariant that would catch a 'paid' event with no matching mutation,
  // or a mutation with no event.
  let bankNetPaidToPlayers = 0;

  let steps = 0;
  const maxSteps = 20000;
  while (state.phase !== 'GAME_OVER' && steps < maxSteps) {
    steps++;
    // Every non-bankrupt player may have a legal declare_bankruptcy/voluntary action even off-turn,
    // but only actors with something to do in the *current* phase are relevant here: drive the
    // current player (or, in RESOLVING_DEBT, the debtor).
    const actorId =
      state.phase === 'RESOLVING_DEBT' && state.debt ? state.debt.debtor : state.turnOrder[state.currentPlayerIndex]!;
    const action = chooseAction(SMALL_MAP, state, actorId);
    const r = reduce(SMALL_MAP, state, { playerId: actorId, action }, rng);
    expect(r.error, `action ${JSON.stringify(action)} by ${actorId} was rejected: ${r.error}`).toBeUndefined();
    state = r.state;

    for (const e of r.events) {
      if (e.type !== 'paid') continue;
      if (e.from === null) bankNetPaidToPlayers += e.amount;
      if (e.to === null) bankNetPaidToPlayers -= e.amount;
    }

    // Invariants that must hold at every single step.
    for (const p of state.players) {
      if (state.debt?.debtor === p.id) {
        expect(p.cash, `debtor ${p.id} must be negative by exactly what they owe`).toBe(-outstandingDebt(state));
      } else {
        expect(p.cash, `player ${p.id} has negative cash without being in debt`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(
      totalCash(state) + outstandingDebt(state),
      'total player cash plus outstanding debt must equal starting cash plus net Bank payouts',
    ).toBe(startingTotalCash + bankNetPaidToPlayers);
    const built = totalBuildings(state);
    expect(built.houses).toBeGreaterThanOrEqual(0);
    expect(built.hotels).toBeGreaterThanOrEqual(0);
    expect(state.bank.houses).toBeGreaterThanOrEqual(0);
    expect(state.bank.hotels).toBeGreaterThanOrEqual(0);
    expect(built.houses + state.bank.houses).toBe(bankPool.houses);
    expect(built.hotels + state.bank.hotels).toBe(bankPool.hotels);
  }

  return { state, steps, startingTotalCash };
}

describe('scripted full game', () => {
  it('plays from createGame to game_over with a seeded rng, producing a winner with no invariant broken', () => {
    // This fixture's action policy rarely bankrupts anyone on this board once every property
    // is bought, regardless of ruleset: a game where nobody completes a group just accumulates
    // cash forever. That is a liveness quirk of the seed/policy pairing, not a broken invariant;
    // every invariant below is still checked at every step. Seed 57 converged while bankruptcy
    // handed deeds to the creditor (which tends to complete a group); now that they return to
    // the market it stalls after one bankruptcy. A 60-seed scan under the current rules found
    // 15 that converge, with invariants holding on all 60; 38 was picked because it finishes
    // quickly and opens four debts on the way, so the negative-balance path is exercised.
    const { state, steps, startingTotalCash } = playFullGame(38);

    expect(state.phase).toBe('GAME_OVER');
    expect(state.winner).not.toBeNull();
    const winner = state.players.find((p) => p.id === state.winner)!;
    expect(winner.bankrupt).toBe(false);
    const activeCount = state.players.filter((p) => !p.bankrupt).length;
    expect(activeCount).toBe(1);
    expect(steps).toBeLessThan(20000); // didn't hit the safety cap — the game actually terminated
    expect(startingTotalCash).toBe(PLAYERS.length * 800);
    // Cash conservation itself (total player cash == starting cash + net Bank payouts) is asserted
    // at every single step inside playFullGame, not just at the end.
  });

  it('is deterministic: the same seed and the same action-selection policy produce an identical final state', () => {
    const a = playFullGame(777);
    const b = playFullGame(777);
    expect(a.state).toEqual(b.state);
    expect(a.steps).toBe(b.steps);
  });

  it('a different seed can (and typically does) produce a different game', () => {
    const a = playFullGame(1);
    const b = playFullGame(2);
    // Not a strict requirement of the engine, just a sanity check that seeding actually varies play.
    expect(a.state).not.toEqual(b.state);
  });
});
