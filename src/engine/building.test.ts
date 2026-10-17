import { describe, expect, it } from 'vitest';
import { reduce, createGame } from './index';
import { SMALL_MAP, WEIRD_MAP, identityRng, settingsFor } from './fixtures';
import { updatePlayer, updateTile, updateBank } from './state';

const P1 = { id: 'p1', name: 'Ann', color: 'red' };
const P2 = { id: 'p2', name: 'Bo', color: 'blue' };

function ownGroupC(state: ReturnType<typeof createGame>) {
  // Charlie group on SMALL_MAP: tiles 12, 13, 15, 17 (size 4).
  let next = state;
  for (const i of [12, 13, 15, 17]) next = updateTile(next, i, { owner: 'p1' });
  return updatePlayer(next, 'p1', { cash: 100000 });
}

function baseState(overrides = {}) {
  const settings = settingsFor({ randomizePlayerOrder: false, ...overrides });
  let state = createGame(SMALL_MAP, [P1, P2], settings, identityRng);
  state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, identityRng).state;
  return ownGroupC(state);
}

describe('even build', () => {
  it('rejects adding a house to a tile that already leads the group', () => {
    let state = baseState();
    // Build once on 12 to put it ahead of the rest (all start at 0, so first build anywhere is legal).
    let r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    state = r.state;
    // Now tile 12 has 1 house, others have 0: building on 12 again should be rejected.
    r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(state);
    // Building on 13 (currently the minimum) is legal.
    r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 13 } }, identityRng);
    expect(r.error).toBeUndefined();
  });

  it('rejects selling from a tile that is not at the group maximum', () => {
    let state = baseState();
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng).state;
    // tile12=1, tile13=tile15=tile17=0. Selling from 13 (not the max) should be rejected.
    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'sell_house', tileIndex: 13 } }, identityRng);
    expect(r.error).toBeTruthy();
    // Selling from 12 (the max) is legal.
    const r2 = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'sell_house', tileIndex: 12 } }, identityRng);
    expect(r2.error).toBeUndefined();
  });

  it('allows uneven building when evenBuild is off', () => {
    let state = baseState({ evenBuild: false });
    let r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    r = reduce(SMALL_MAP, r.state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    expect(r.state.tiles[12]!.houses).toBe(2);
  });
});

describe('building supply exhaustion', () => {
  it('stops buying houses once the bank runs dry, across several groups building in lockstep', () => {
    let state = baseState();
    // Also own the Bravo group (6, 8, 10) and Alpha group (1, 3) to spread builds across three
    // groups, since even-build cannot pile more than 1 house of lead onto any single tile.
    for (const i of [1, 3, 6, 8, 10]) state = updateTile(state, i, { owner: 'p1' });
    expect(state.bank.houses).toBe(32);

    const buildable = [1, 3, 6, 8, 10, 12, 13, 15, 17];
    let built = 0;
    // Repeatedly sweep the buildable tiles, building one house wherever it's currently legal,
    // until the bank truly cannot supply any more.
    for (let round = 0; round < 10 && state.bank.houses > 0; round++) {
      for (const idx of buildable) {
        const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: idx } }, identityRng);
        if (!r.error) {
          state = r.state;
          built++;
        }
      }
    }
    expect(state.bank.houses).toBe(0);
    expect(built).toBe(32);
    // One more attempt anywhere legal by even-build must fail on supply, not crash.
    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_house', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeTruthy();
  });

  it('stops buying hotels once the bank runs out of hotel pieces', () => {
    let state = baseState({ unlimitedBuildings: false });
    for (const i of [12, 13, 15, 17]) {
      state = updateTile(state, i, { houses: 4 });
    }
    state = updateBank(state, { hotels: 1, houses: 32 });
    let r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_hotel', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    state = r.state;
    expect(state.bank.hotels).toBe(0);
    r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_hotel', tileIndex: 13 } }, identityRng);
    expect(r.error).toBeTruthy();
  });
});

describe('hotel-break rule (docs/ENGINE.md decision 17)', () => {
  it('selling a hotel breaks it into 4 houses on that tile when the bank has 4 spare', () => {
    let state = baseState();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { houses: 4 });
    state = updateBank(state, { houses: 10, hotels: 5 });
    state = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'buy_hotel', tileIndex: 12 } }, identityRng).state;
    expect(state.tiles[12]!.hotel).toBe(true);
    expect(state.bank.houses).toBe(14); // 10 - 4(consumed by hotel purchase... ) note: buy_hotel returns 4 to bank

    const cashBefore = state.players.find((p) => p.id === 'p1')!.cash;
    const hotelPrice = (SMALL_MAP.tiles[12] as { hotelPrice: number }).hotelPrice;
    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'sell_hotel', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    expect(r.state.tiles[12]!.hotel).toBe(false);
    expect(r.state.tiles[12]!.houses).toBe(4);
    expect(r.state.bank.houses).toBe(state.bank.houses - 4);
    expect(r.state.bank.hotels).toBe(state.bank.hotels + 1);
    const player = r.state.players.find((p) => p.id === 'p1')!;
    expect(player.cash).toBe(cashBefore + Math.floor(hotelPrice / 2));
  });

  it('sells every hotel in the group at once, straight to bare land, when the bank has fewer than 4 houses', () => {
    let state = baseState();
    for (const i of [12, 13, 15, 17]) state = updateTile(state, i, { hotel: true, houses: 0 });
    state = updateBank(state, { houses: 3, hotels: 8 }); // not enough to break a single hotel
    const cashBefore = state.players.find((p) => p.id === 'p1')!.cash;
    const hotelPrices = [12, 13, 15, 17].map((i) => (SMALL_MAP.tiles[i] as { hotelPrice: number }).hotelPrice);
    const expectedProceeds = hotelPrices.reduce((sum, p) => sum + Math.floor(p / 2), 0);

    const r = reduce(SMALL_MAP, state, { playerId: 'p1', action: { type: 'sell_hotel', tileIndex: 12 } }, identityRng);
    expect(r.error).toBeUndefined();
    for (const i of [12, 13, 15, 17]) {
      expect(r.state.tiles[i]!.hotel).toBe(false);
      expect(r.state.tiles[i]!.houses).toBe(0);
    }
    expect(r.state.bank.houses).toBe(3); // untouched — no houses were exchanged
    expect(r.state.bank.hotels).toBe(8 + 4);
    const player = r.state.players.find((p) => p.id === 'p1')!;
    expect(player.cash).toBe(cashBefore + expectedProceeds);
  });

  it('works the same way on a group of size 6 and a group of size 5 (WEIRD_MAP)', () => {
    const settings = settingsFor({ randomizePlayerOrder: false });
    let state = createGame(WEIRD_MAP, [P1, P2], settings, identityRng);
    state = reduce(WEIRD_MAP, state, { playerId: 'p1', action: { type: 'start_game' } }, identityRng).state;
    const germanyTiles = WEIRD_MAP.tiles.filter((t) => t.type === 'city' && t.countryId === 'germany').map((t) => t.index);
    expect(germanyTiles).toHaveLength(6);
    for (const i of germanyTiles) state = updateTile(state, i, { owner: 'p1', hotel: true, houses: 0 });
    state = updatePlayer(state, 'p1', { cash: 100000 });
    state = updateBank(state, { houses: 0, hotels: 12 }); // force the group-wide sale path

    const r = reduce(WEIRD_MAP, state, { playerId: 'p1', action: { type: 'sell_hotel', tileIndex: germanyTiles[0]! } }, identityRng);
    expect(r.error).toBeUndefined();
    for (const i of germanyTiles) {
      expect(r.state.tiles[i]!.hotel).toBe(false);
      expect(r.state.tiles[i]!.houses).toBe(0);
    }
    expect(r.state.bank.hotels).toBe(12 + 6);
  });
});
