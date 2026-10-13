/**
 * Pure, read-only queries over GameState/GameMap, plus small immutable-update
 * helpers. Nothing here mutates its inputs — every function returns a new
 * value. This is the only place that reaches into the board shape, so no
 * other module should assume tile counts, group sizes, or indices.
 */
import type { GameMap, GameState, Ownership, Player, PlayerId, Tile } from '../shared/types';

// ─── Immutable update helpers ─────────────────────────────────────────────

export function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  patch: Partial<Player>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

export function updateTile(state: GameState, tileIndex: number, patch: Partial<Ownership>): GameState {
  return {
    ...state,
    tiles: state.tiles.map((t, i) => (i === tileIndex ? { ...t, ...patch } : t)),
  };
}

export function updateBank(state: GameState, patch: Partial<GameState['bank']>): GameState {
  return { ...state, bank: { ...state.bank, ...patch } };
}

/** Pools cash paid to the Bank into the Vacation pot when `vacationCash` is on; a no-op otherwise. */
export function addToVacationPot(state: GameState, amount: number): GameState {
  if (!state.settings.vacationCash || amount <= 0) return state;
  return { ...state, vacationPot: state.vacationPot + amount };
}

// ─── Player queries ────────────────────────────────────────────────────────

export function getPlayer(state: GameState, playerId: PlayerId): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}

export function currentPlayer(state: GameState): Player {
  const id = state.turnOrder[state.currentPlayerIndex];
  if (id === undefined) throw new Error('currentPlayerIndex out of range');
  return getPlayer(state, id);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

/** Other active players, in turn order, starting immediately to `playerId`'s left. */
export function othersInTurnOrder(state: GameState, playerId: PlayerId): Player[] {
  const idx = state.turnOrder.indexOf(playerId);
  if (idx === -1) return activePlayers(state).filter((p) => p.id !== playerId);
  const n = state.turnOrder.length;
  const out: Player[] = [];
  for (let step = 1; step < n; step++) {
    const id = state.turnOrder[(idx + step) % n]!;
    const p = getPlayer(state, id);
    if (!p.bankrupt) out.push(p);
  }
  return out;
}

// ─── Board queries ─────────────────────────────────────────────────────────

export function tileAt(map: GameMap, index: number): Tile {
  const tile = map.tiles[index];
  if (!tile) throw new Error(`Tile index out of range: ${index}`);
  return tile;
}

/** All city tiles belonging to a country group, in board order. */
export function groupTiles(map: GameMap, countryId: string): Tile[] {
  return map.tiles.filter((t) => t.type === 'city' && t.countryId === countryId);
}

export function ownableTileIndices(map: GameMap): number[] {
  return map.tiles.filter((t) => t.type === 'city' || t.type === 'airport' || t.type === 'company').map((t) => t.index);
}

/** Every tile a player owns, as {tile, ownership} pairs. */
export function ownedTiles(map: GameMap, state: GameState, playerId: PlayerId): { tile: Tile; ownership: Ownership }[] {
  const out: { tile: Tile; ownership: Ownership }[] = [];
  for (const index of ownableTileIndices(map)) {
    const ownership = state.tiles[index]!;
    if (ownership.owner === playerId) out.push({ tile: tileAt(map, index), ownership });
  }
  return out;
}

/** True if `playerId` owns every city tile in the group, unmortgaged (v1: always true). */
export function ownsWholeGroup(map: GameMap, state: GameState, playerId: PlayerId, countryId: string): boolean {
  const tiles = groupTiles(map, countryId);
  if (tiles.length === 0) return false;
  return tiles.every((t) => {
    const o = state.tiles[t.index]!;
    return o.owner === playerId && !o.mortgaged;
  });
}

/** Building level on a tile: 0-4 houses, or 5 for a hotel. */
export function buildingLevel(ownership: Ownership): number {
  return ownership.hotel ? 5 : ownership.houses;
}

export function countAirports(map: GameMap, state: GameState, playerId: PlayerId): number {
  return map.tiles.filter((t) => t.type === 'airport' && state.tiles[t.index]!.owner === playerId).length;
}

export function countCompanies(map: GameMap, state: GameState, playerId: PlayerId): number {
  return map.tiles.filter((t) => t.type === 'company' && state.tiles[t.index]!.owner === playerId).length;
}

/** Cash + printed price of every property owned + purchase price of every building owned (SPEC decision 28). */
export function netWorthForTax(map: GameMap, state: GameState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  let worth = player.cash;
  for (const { tile, ownership } of ownedTiles(map, state, playerId)) {
    if (tile.type === 'city' || tile.type === 'airport' || tile.type === 'company') {
      worth += tile.price;
    }
    if (tile.type === 'city') {
      worth += ownership.houses * tile.housePrice;
      if (ownership.hotel) worth += 4 * tile.housePrice + tile.hotelPrice;
    }
  }
  return worth;
}

/** Half the purchase price of a house, rounded down (SPEC: "returns half the purchase price"). */
export function houseSaleValue(tile: Extract<Tile, { type: 'city' }>): number {
  return Math.floor(tile.housePrice / 2);
}

export function hotelSaleValue(tile: Extract<Tile, { type: 'city' }>): number {
  return Math.floor(tile.hotelPrice / 2);
}

/** Advance one tile at a time, returning the resulting index and whether START was passed or landed on. */
export function walkForward(map: GameMap, from: number, steps: number): { to: number; passedStart: boolean } {
  const n = map.tiles.length;
  let pos = from;
  let passedStart = false;
  for (let i = 0; i < steps; i++) {
    pos = (pos + 1) % n;
    if (pos === map.startIndex) passedStart = true;
  }
  return { to: pos, passedStart };
}
