/**
 * Player-to-player trades: cash, properties and pardon cards, in any phase of a running
 * game and on anyone's turn. A trade is only a proposal until the recipient accepts, and
 * acceptance re-checks everything against the live state, since the board may have moved
 * on since it was sent.
 */
import type { GameEvent, GameMap, GameState, PlayerId, Trade, TradeSide } from '../shared/types';
import { payDebtFromIncome, totalOwed } from './debt';
import { ok, reject, type ActionResult } from './result';
import { groupHasBuildings, updatePlayer, updateTile } from './state';

/** Proposals one player may send another per turn before they have to wait. */
export const TRADE_SEND_LIMIT = 3;

type Events = GameEvent[];

function pairKey(from: PlayerId, to: PlayerId): string {
  return `${from}>${to}`;
}

function inProgress(state: GameState): boolean {
  return state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER';
}

function nameOf(state: GameState, id: PlayerId): string {
  return state.players.find((p) => p.id === id)?.name ?? 'that player';
}

function isNonNegativeInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Why `side` can't be given by `ownerId` right now, or null if it can. */
function sideError(map: GameMap, state: GameState, ownerId: PlayerId, side: TradeSide): string | null {
  const owner = state.players.find((p) => p.id === ownerId)!;
  const name = owner.name;
  if (!isNonNegativeInt(side.cash)) return 'Trade cash must be a whole number of dollars';
  if (side.cash > Math.max(0, owner.cash)) return `${name} doesn't have $${side.cash}`;
  if (!isNonNegativeInt(side.pardonCards)) return 'Pardon cards must be a whole number';
  if (side.pardonCards > owner.pardonCards) return `${name} doesn't hold ${side.pardonCards} pardon card(s)`;
  if (new Set(side.tiles).size !== side.tiles.length) return 'A property is listed twice';
  for (const index of side.tiles) {
    const tile = map.tiles[index];
    if (!isNonNegativeInt(index) || !tile) return 'No such property';
    if (tile.type !== 'city' && tile.type !== 'airport' && tile.type !== 'company') return `${tile.name} can't be traded`;
    if (state.tiles[index]!.owner !== ownerId) return `${name} doesn't own ${tile.name}`;
    if (tile.type === 'city' && groupHasBuildings(map, state, tile.countryId)) {
      return `${tile.name} can't be traded while its country has buildings. Sell them first.`;
    }
  }
  return null;
}

function isEmptySide(side: TradeSide): boolean {
  return side.cash === 0 && side.tiles.length === 0 && side.pardonCards === 0;
}

/** Cash plus printed property prices plus the jail fee per pardon card. */
function sideValue(map: GameMap, state: GameState, side: TradeSide): number {
  let value = side.cash + side.pardonCards * state.settings.jailFee;
  for (const index of side.tiles) {
    const tile = map.tiles[index];
    if (tile && 'price' in tile) value += tile.price;
  }
  return value;
}

/**
 * Keeps a player in debt from shovelling assets to a friend. Only the current debtor is
 * restricted, and the check is always made from their side of the trade.
 */
function antiCollusionError(map: GameMap, state: GameState, trade: Omit<Trade, 'id'>): string | null {
  const debt = state.debt;
  if (!debt || (debt.debtor !== trade.from && debt.debtor !== trade.to)) return null;
  const debtorGives = debt.debtor === trade.from ? trade.offer : trade.request;
  const debtorGets = debt.debtor === trade.from ? trade.request : trade.offer;
  const netCash = debtorGets.cash - debtorGives.cash;
  const name = nameOf(state, debt.debtor);

  if (!state.settings.antiCollusion) {
    if (netCash > 0) return null;
    return `${name} is in debt, so they can only make trades that bring in more cash than they give.`;
  }
  if (netCash >= totalOwed(debt)) return null;
  if (sideValue(map, state, debtorGets) >= sideValue(map, state, debtorGives)) return null;
  return `Anti-collusion: ${name} is in debt, so a trade must either clear the debt or not lose them value.`;
}

/** Everything that makes a trade unworkable on the live board, apart from the debt rule. */
function contentError(map: GameMap, state: GameState, trade: Omit<Trade, 'id'>): string | null {
  if (trade.from === trade.to) return "You can't trade with yourself";
  const from = state.players.find((p) => p.id === trade.from);
  const to = state.players.find((p) => p.id === trade.to);
  if (!from || !to) return 'Unknown player';
  if (from.bankrupt || to.bankrupt) return 'Bankrupt players cannot trade';
  if (isEmptySide(trade.offer) && isEmptySide(trade.request)) return 'A trade has to include something';
  return sideError(map, state, trade.from, trade.offer) ?? sideError(map, state, trade.to, trade.request);
}

function removeTrade(state: GameState, tradeId: string): GameState {
  return { ...state, trades: state.trades.filter((t) => t.id !== tradeId) };
}

function resetPair(state: GameState, a: PlayerId, b: PlayerId): GameState {
  return { ...state, tradeSendCounts: { ...state.tradeSendCounts, [pairKey(a, b)]: 0, [pairKey(b, a)]: 0 } };
}

export function proposeTrade(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  action: { to: PlayerId; offer: TradeSide; request: TradeSide; counterOf?: string },
): ActionResult {
  if (!inProgress(state)) return reject(state, 'Game not in progress');
  const proposal = { from: playerId, to: action.to, offer: action.offer, request: action.request };

  let original: Trade | undefined;
  if (action.counterOf !== undefined) {
    original = state.trades.find((t) => t.id === action.counterOf);
    if (!original) return reject(state, 'That trade is no longer open');
    if (original.to !== playerId || original.from !== action.to) {
      return reject(state, 'You can only counter a trade sent to you, back to its sender');
    }
  }

  const content = contentError(map, state, proposal);
  if (content) return reject(state, content);
  if (state.trades.some((t) => t.from === playerId && t.to === action.to)) {
    return reject(state, `You already have a trade waiting with ${nameOf(state, action.to)}`);
  }
  const key = pairKey(playerId, action.to);
  const sent = state.tradeSendCounts[key] ?? 0;
  if (!original && sent >= TRADE_SEND_LIMIT) {
    return reject(state, `You've sent ${TRADE_SEND_LIMIT} trades to ${nameOf(state, action.to)} this turn. Try again next turn.`);
  }
  const collusion = antiCollusionError(map, state, proposal);
  if (collusion) return reject(state, collusion);

  const trade: Trade = { id: `trade-${state.nextTradeId}`, ...proposal };
  let next: GameState = { ...state, nextTradeId: state.nextTradeId + 1 };
  const events: Events = [];
  if (original) {
    next = resetPair(removeTrade(next, original.id), playerId, action.to);
    events.push({ type: 'trade_cancelled', tradeId: original.id, reason: 'countered' });
  } else {
    next = { ...next, tradeSendCounts: { ...next.tradeSendCounts, [key]: sent + 1 } };
  }
  next = { ...next, trades: [...next.trades, trade] };
  events.push(original ? { type: 'trade_proposed', trade, counterOf: original.id } : { type: 'trade_proposed', trade });
  return ok(next, events);
}

function giveSide(state: GameState, side: TradeSide, giverId: PlayerId, takerId: PlayerId): GameState {
  let next = state;
  const giver = next.players.find((p) => p.id === giverId)!;
  next = updatePlayer(next, giverId, { cash: giver.cash - side.cash, pardonCards: giver.pardonCards - side.pardonCards });
  const taker = next.players.find((p) => p.id === takerId)!;
  next = updatePlayer(next, takerId, { cash: taker.cash + side.cash, pardonCards: taker.pardonCards + side.pardonCards });
  for (const index of side.tiles) next = updateTile(next, index, { owner: takerId });
  return next;
}

export function acceptTrade(map: GameMap, state: GameState, playerId: PlayerId, tradeId: string): ActionResult {
  if (!inProgress(state)) return reject(state, 'Game not in progress');
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade) return reject(state, 'That trade is no longer open');
  if (trade.to !== playerId) return reject(state, 'Only the player a trade was sent to can accept it');
  const error = contentError(map, state, trade) ?? antiCollusionError(map, state, trade);
  if (error) return reject(state, error);

  let next = removeTrade(state, trade.id);
  next = giveSide(next, trade.offer, trade.from, trade.to);
  next = giveSide(next, trade.request, trade.to, trade.from);
  next = resetPair(next, trade.from, trade.to);
  let events: Events = [{ type: 'trade_accepted', trade }];
  // A debtor's incoming cash goes straight on to their creditors; this is how a rescue
  // clears a debt.
  ({ state: next, events } = payDebtFromIncome(next, events));
  ({ state: next, events } = dropInvalidTrades(map, next, events));
  return ok(next, events);
}

export function declineTrade(state: GameState, playerId: PlayerId, tradeId: string): ActionResult {
  if (!inProgress(state)) return reject(state, 'Game not in progress');
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade) return reject(state, 'That trade is no longer open');
  if (trade.to !== playerId) return reject(state, 'Only the player a trade was sent to can decline it');
  return ok(removeTrade(state, tradeId), [{ type: 'trade_declined', tradeId, from: trade.from, to: trade.to }]);
}

export function cancelTrade(state: GameState, playerId: PlayerId, tradeId: string): ActionResult {
  if (!inProgress(state)) return reject(state, 'Game not in progress');
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade) return reject(state, 'That trade is no longer open');
  if (trade.from !== playerId) return reject(state, 'Only the player who sent a trade can withdraw it');
  return ok(removeTrade(state, tradeId), [{ type: 'trade_cancelled', tradeId, reason: 'withdrawn' }]);
}

/**
 * Drops pending trades that can no longer go through as written (a property changed
 * hands, cash ran short). The debt rule is left to accept time: whether it passes depends
 * on a debt that may open or clear before anyone answers.
 */
export function dropInvalidTrades(map: GameMap, state: GameState, events: Events): { state: GameState; events: Events } {
  const invalid = state.trades.filter((t) => contentError(map, state, t) !== null);
  if (invalid.length === 0) return { state, events };
  return {
    state: { ...state, trades: state.trades.filter((t) => !invalid.includes(t)) },
    events: [...events, ...invalid.map((t) => ({ type: 'trade_cancelled' as const, tradeId: t.id, reason: 'invalid' as const }))],
  };
}

export function dropTradesInvolving(state: GameState, playerId: PlayerId, events: Events): { state: GameState; events: Events } {
  const gone = state.trades.filter((t) => t.from === playerId || t.to === playerId);
  if (gone.length === 0) return { state, events };
  return {
    state: { ...state, trades: state.trades.filter((t) => !gone.includes(t)) },
    events: [...events, ...gone.map((t) => ({ type: 'trade_cancelled' as const, tradeId: t.id, reason: 'bankrupt' as const }))],
  };
}

/** For `legalActions`: whether the recipient could accept this trade right now. */
export function canAcceptTrade(map: GameMap, state: GameState, trade: Trade): boolean {
  return (contentError(map, state, trade) ?? antiCollusionError(map, state, trade)) === null;
}
