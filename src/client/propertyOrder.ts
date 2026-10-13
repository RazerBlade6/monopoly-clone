import type { CountryId, OwnableTile } from '../shared/types';

export interface PropertyGroup {
  key: string;
  /** Set for city groups only; airports and companies have no country to complete. */
  countryId?: CountryId;
  tiles: OwnableTile[];
}

/**
 * Groups owned tiles (cities by country, all airports, all companies), cheapest group first,
 * and the same within each group. Ties go to the lower board index so the order is stable.
 */
export function groupProperties(tiles: readonly OwnableTile[]): PropertyGroup[] {
  const byKey = new Map<string, PropertyGroup>();
  for (const tile of tiles) {
    const key = tile.type === 'city' ? `city:${tile.countryId}` : tile.type;
    let group = byKey.get(key);
    if (!group) {
      group = tile.type === 'city' ? { key, countryId: tile.countryId, tiles: [] } : { key, tiles: [] };
      byKey.set(key, group);
    }
    group.tiles.push(tile);
  }
  const byPrice = (a: OwnableTile, b: OwnableTile) => a.price - b.price || a.index - b.index;
  const groups = [...byKey.values()];
  for (const group of groups) group.tiles.sort(byPrice);
  // Each group is already sorted, so its first tile is its cheapest.
  return groups.sort((a, b) => byPrice(a.tiles[0]!, b.tiles[0]!));
}
