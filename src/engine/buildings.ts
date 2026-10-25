/**
 * buy_house / sell_house / buy_hotel / sell_hotel. Building supply is finite
 * (32 houses / 12 hotels, tracked in state.bank) unless settings.unlimitedBuildings
 * is on, in which case supply is never checked or mutated.
 *
 * Even build (default on): a house may only be added to the group tile with
 * the fewest houses, and removed from the tile with the most (docs/ENGINE.md,
 * "Building and selling"). A hotel is treated as level 5 on the same 0-5 scale so the same
 * rule covers buy_hotel / sell_hotel too.
 */
import type { GameMap, GameState, PlayerId, Tile } from '../shared/types';
import {
  buildingLevel,
  groupTiles,
  houseSaleValue,
  hotelSaleValue,
  ownsWholeGroup,
  updateBank,
  updatePlayer,
  updateTile,
} from './state';
import { ok, reject, type ActionResult } from './result';

type CityTile = Extract<Tile, { type: 'city' }>;

function requireOwnedCity(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): CityTile | string {
  const tile = map.tiles[tileIndex];
  if (!tile || tile.type !== 'city') return 'Not a buildable tile';
  const ownership = state.tiles[tileIndex];
  if (!ownership || ownership.owner !== playerId) return 'You do not own this property';
  return tile;
}

function groupLevels(map: GameMap, state: GameState, playerId: PlayerId, countryId: string): number[] {
  return groupTiles(map, countryId).map((t) => buildingLevel(state.tiles[t.index]!));
}

export function buyHouse(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): ActionResult {
  const tile = requireOwnedCity(map, state, playerId, tileIndex);
  if (typeof tile === 'string') return reject(state, tile);
  const ownership = state.tiles[tileIndex]!;
  if (!ownsWholeGroup(map, state, playerId, tile.countryId)) return reject(state, 'You must own the whole group to build');
  if (ownership.hotel) return reject(state, 'This tile already has a hotel');
  if (ownership.houses >= 4) return reject(state, 'Buy a hotel instead — houses are capped at 4');

  if (state.settings.evenBuild) {
    const levels = groupLevels(map, state, playerId, tile.countryId);
    if (ownership.houses > Math.min(...levels)) {
      return reject(state, 'Even build: add to the tile with the fewest houses first');
    }
  }

  const player = state.players.find((p) => p.id === playerId)!;
  if (player.cash < tile.housePrice) return reject(state, 'Not enough cash');
  if (!state.settings.unlimitedBuildings && state.bank.houses < 1) return reject(state, 'No houses left in the bank');

  let next = updatePlayer(state, playerId, { cash: player.cash - tile.housePrice });
  next = updateTile(next, tileIndex, { houses: ownership.houses + 1 });
  if (!state.settings.unlimitedBuildings) next = updateBank(next, { houses: state.bank.houses - 1 });

  return ok(next, [
    { type: 'paid', from: playerId, to: null, amount: tile.housePrice, reason: 'bought_house' },
    { type: 'built', playerId, tileIndex, houses: ownership.houses + 1, hotel: false },
  ]);
}

export function buyHotel(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): ActionResult {
  const tile = requireOwnedCity(map, state, playerId, tileIndex);
  if (typeof tile === 'string') return reject(state, tile);
  const ownership = state.tiles[tileIndex]!;
  if (!ownsWholeGroup(map, state, playerId, tile.countryId)) return reject(state, 'You must own the whole group to build');
  if (ownership.hotel) return reject(state, 'This tile already has a hotel');
  if (ownership.houses < 4) return reject(state, 'You need 4 houses here before a hotel');

  if (state.settings.evenBuild) {
    const levels = groupLevels(map, state, playerId, tile.countryId);
    if (ownership.houses > Math.min(...levels)) {
      return reject(state, 'Even build: bring the rest of the group up to 4 houses first');
    }
  }

  const player = state.players.find((p) => p.id === playerId)!;
  if (player.cash < tile.hotelPrice) return reject(state, 'Not enough cash');
  if (!state.settings.unlimitedBuildings && state.bank.hotels < 1) return reject(state, 'No hotels left in the bank');

  let next = updatePlayer(state, playerId, { cash: player.cash - tile.hotelPrice });
  next = updateTile(next, tileIndex, { houses: 0, hotel: true });
  if (!state.settings.unlimitedBuildings) {
    next = updateBank(next, { hotels: state.bank.hotels - 1, houses: state.bank.houses + 4 });
  }

  return ok(next, [
    { type: 'paid', from: playerId, to: null, amount: tile.hotelPrice, reason: 'bought_hotel' },
    { type: 'built', playerId, tileIndex, houses: 0, hotel: true },
  ]);
}

export function sellHouse(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): ActionResult {
  const tile = requireOwnedCity(map, state, playerId, tileIndex);
  if (typeof tile === 'string') return reject(state, tile);
  const ownership = state.tiles[tileIndex]!;
  if (ownership.hotel) return reject(state, 'Sell the hotel, not a house');
  if (ownership.houses < 1) return reject(state, 'No houses to sell here');

  if (state.settings.evenBuild) {
    const levels = groupLevels(map, state, playerId, tile.countryId);
    if (ownership.houses < Math.max(...levels)) {
      return reject(state, 'Even build: sell from the tile with the most houses first');
    }
  }

  const player = state.players.find((p) => p.id === playerId)!;
  const proceeds = houseSaleValue(tile);
  let next = updatePlayer(state, playerId, { cash: player.cash + proceeds });
  next = updateTile(next, tileIndex, { houses: ownership.houses - 1 });
  if (!state.settings.unlimitedBuildings) next = updateBank(next, { houses: state.bank.houses + 1 });

  return ok(next, [
    { type: 'built', playerId, tileIndex, houses: ownership.houses - 1, hotel: false },
    { type: 'paid', from: null, to: playerId, amount: proceeds, reason: 'sold_house' },
  ]);
}

/**
 * docs/ENGINE.md decision 17: selling a hotel always pays half its price. If the bank
 * has 4 spare houses, this tile alone converts hotel -> 4 houses and those
 * houses come from the bank. If it doesn't, a single-tile conversion is
 * impossible (there's nothing to place), so instead every hotel in the group
 * sells straight to bare land in the same action, evenly, group-wide.
 */
export function sellHotel(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): ActionResult {
  const tile = requireOwnedCity(map, state, playerId, tileIndex);
  if (typeof tile === 'string') return reject(state, tile);
  const ownership = state.tiles[tileIndex]!;
  if (!ownership.hotel) return reject(state, 'No hotel here to sell');

  const player = state.players.find((p) => p.id === playerId)!;
  const canBreakSingle = state.settings.unlimitedBuildings || state.bank.houses >= 4;

  if (canBreakSingle) {
    const proceeds = hotelSaleValue(tile);
    let next = updatePlayer(state, playerId, { cash: player.cash + proceeds });
    next = updateTile(next, tileIndex, { houses: 4, hotel: false });
    if (!state.settings.unlimitedBuildings) {
      next = updateBank(next, { hotels: state.bank.hotels + 1, houses: state.bank.houses - 4 });
    }
    return ok(next, [
      { type: 'built', playerId, tileIndex, houses: 4, hotel: false },
      { type: 'paid', from: null, to: playerId, amount: proceeds, reason: 'sold_hotel' },
    ]);
  }

  // Not enough spare houses to break this one tile: sell every hotel in the group at once.
  const group = groupTiles(map, tile.countryId);
  let next = state;
  let totalProceeds = 0;
  let hotelsSold = 0;
  const events = [];
  for (const groupTile of group) {
    const o = next.tiles[groupTile.index]!;
    if (o.owner !== playerId || !o.hotel) continue;
    const gt = groupTile as CityTile;
    const proceeds = hotelSaleValue(gt);
    totalProceeds += proceeds;
    hotelsSold += 1;
    next = updateTile(next, groupTile.index, { houses: 0, hotel: false });
    events.push({ type: 'built' as const, playerId, tileIndex: groupTile.index, houses: 0, hotel: false });
  }
  next = updatePlayer(next, playerId, { cash: player.cash + totalProceeds });
  if (!state.settings.unlimitedBuildings) next = updateBank(next, { hotels: state.bank.hotels + hotelsSold });
  events.push({ type: 'paid' as const, from: null, to: playerId, amount: totalProceeds, reason: 'sold_hotels_group' });

  return ok(next, events);
}
