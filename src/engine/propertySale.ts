/**
 * sell_property: the owner sells a bare property back to the bank for half its printed
 * price, and it goes back on the market unowned. The cash comes from the bank, not the
 * Vacation pot. Timing is the reducer's job and matches building sales.
 */
import type { GameMap, GameState, PlayerId } from '../shared/types';
import { countryName, groupHasBuildings, propertySaleValue, updatePlayer, updateTile } from './state';
import { ok, reject, type ActionResult } from './result';

export function sellProperty(map: GameMap, state: GameState, playerId: PlayerId, tileIndex: number): ActionResult {
  const tile = map.tiles[tileIndex];
  if (!tile || (tile.type !== 'city' && tile.type !== 'airport' && tile.type !== 'company')) {
    return reject(state, 'Not a property that can be sold');
  }
  const ownership = state.tiles[tileIndex]!;
  if (ownership.owner !== playerId) return reject(state, 'You do not own this property');
  // The whole group counts: with even build a bare tile can sit beside a built one, and
  // selling it would leave buildings standing on an incomplete set.
  if (tile.type === 'city' && groupHasBuildings(map, state, tile.countryId)) {
    return reject(state, `Sell the buildings in ${countryName(tile.countryId)} first`);
  }

  const player = state.players.find((p) => p.id === playerId)!;
  const amount = propertySaleValue(tile);
  let next = updatePlayer(state, playerId, { cash: player.cash + amount });
  next = updateTile(next, tileIndex, { owner: null });
  return ok(next, [{ type: 'property_sold', playerId, tileIndex, amount }]);
}
