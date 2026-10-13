import type { GameAction, GameMap, GameState, PlayerId } from '../shared/types';
import { buyHotel, buyHouse, sellHotel, sellHouse } from './buildings';
import { sellProperty } from './propertySale';
import { phaseAfterLanding } from './debt';
import { currentPlayer, ownableTileIndices } from './state';
import { canAcceptTrade } from './trades';

/**
 * Every concrete action `playerId` could take right now. `propose_trade` is the one action
 * not listed: its space of offers is effectively unbounded, so it is validated on arrival
 * instead. Answering or withdrawing a pending trade is listed.
 */
export function legalActions(map: GameMap, state: GameState, playerId: PlayerId): GameAction[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  if (state.phase === 'LOBBY') {
    return state.turnOrder.length >= 2 ? [{ type: 'start_game' }] : [];
  }
  if (state.phase === 'GAME_OVER') return [];

  const actions: GameAction[] = [];
  const isCurrent = currentPlayer(state).id === playerId;

  if (isCurrent && state.phase === 'AWAITING_ROLL') {
    if (player.inJail) {
      if (player.cash >= state.settings.jailFee) actions.push({ type: 'pay_jail_fee' });
      if (player.pardonCards >= 1) actions.push({ type: 'use_pardon' });
    }
    actions.push({ type: 'roll' });
  }

  if (isCurrent && state.phase === 'AWAITING_BUY') {
    // Not buying is just carrying on: rolling again after doubles, else ending the turn.
    actions.push({ type: phaseAfterLanding(state) === 'AWAITING_ROLL' ? 'roll' : 'end_turn' });
    const tile = map.tiles[player.tileIndex]!;
    if ((tile.type === 'city' || tile.type === 'airport' || tile.type === 'company') && player.cash >= tile.price) {
      actions.push({ type: 'buy' });
    }
  }

  if (isCurrent && state.phase === 'AWAITING_END_TURN') {
    actions.push({ type: 'end_turn' });
  }

  const canBuild = isCurrent && (state.phase === 'AWAITING_ROLL' || state.phase === 'AWAITING_BUY' || state.phase === 'AWAITING_END_TURN');
  const canSellForDebt = state.phase === 'RESOLVING_DEBT' && state.debt !== null && state.debt.debtor === playerId;

  if (canBuild || canSellForDebt) {
    for (const index of ownableTileIndices(map)) {
      const ownership = state.tiles[index]!;
      if (ownership.owner !== playerId) continue;
      if (canBuild) {
        if (!buyHouse(map, state, playerId, index).error) actions.push({ type: 'buy_house', tileIndex: index });
        if (!buyHotel(map, state, playerId, index).error) actions.push({ type: 'buy_hotel', tileIndex: index });
      }
      if (canBuild || canSellForDebt) {
        if (!sellHouse(map, state, playerId, index).error) actions.push({ type: 'sell_house', tileIndex: index });
        if (!sellHotel(map, state, playerId, index).error) actions.push({ type: 'sell_hotel', tileIndex: index });
        if (!sellProperty(map, state, playerId, index).error) actions.push({ type: 'sell_property', tileIndex: index });
      }
    }
  }

  if (!player.bankrupt) {
    for (const trade of state.trades) {
      if (trade.to === playerId) {
        if (canAcceptTrade(map, state, trade)) actions.push({ type: 'accept_trade', tradeId: trade.id });
        actions.push({ type: 'decline_trade', tradeId: trade.id });
      }
      if (trade.from === playerId) actions.push({ type: 'cancel_trade', tradeId: trade.id });
    }
    actions.push({ type: 'declare_bankruptcy' });
  }

  return actions;
}
