import type { GameAction, GameMap, GameState, PlayerId } from '../shared/types';
import { buyHotel, buyHouse, sellHotel, sellHouse } from '../engine/buildings';
import { sellProperty } from '../engine/propertySale';

export type AssetAction = Extract<GameAction, { type: 'buy_house' | 'buy_hotel' | 'sell_house' | 'sell_hotel' | 'sell_property' }>;

function isListed(legal: readonly GameAction[], action: AssetAction): boolean {
  return legal.some(a => a.type === action.type && 'tileIndex' in a && a.tileIndex === action.tileIndex);
}

function engineError(map: GameMap, state: GameState, seat: PlayerId, action: AssetAction): string | undefined {
  switch (action.type) {
    case 'buy_house': return buyHouse(map, state, seat, action.tileIndex).error;
    case 'buy_hotel': return buyHotel(map, state, seat, action.tileIndex).error;
    case 'sell_house': return sellHouse(map, state, seat, action.tileIndex).error;
    case 'sell_hotel': return sellHotel(map, state, seat, action.tileIndex).error;
    case 'sell_property': return sellProperty(map, state, seat, action.tileIndex).error;
  }
}

/**
 * Null when `legal` (the engine's `legalActions` for `seat`) lists this exact action, else why
 * not. The timing reasons are worded here because the engine's own ("Cannot build right now")
 * don't say what to wait for; past the timing gate the engine's refusal is used as is.
 */
export function assetBlockedReason(
  map: GameMap, state: GameState, seat: PlayerId, legal: readonly GameAction[], action: AssetAction,
): string | null {
  if (isListed(legal, action)) return null;
  if (state.phase === 'LOBBY' || state.phase === 'GAME_OVER') return 'The game is not in progress';
  const building = action.type === 'buy_house' || action.type === 'buy_hotel';
  if (state.phase === 'RESOLVING_DEBT') {
    if (state.debt?.debtor !== seat) return 'Wait until the debt is settled';
    if (building) return "You can't build while in debt";
  } else {
    if (state.turnOrder[state.currentPlayerIndex] !== seat) return 'Only on your turn';
    if (state.phase === 'AWAITING_BUY') return 'Decide on the purchase first';
  }
  return engineError(map, state, seat, action) ?? 'Not possible right now';
}
