import type { GameAction, GameEvent, GameMap, GameState, Player, PlayerId, PlayerAction, RoomSettings } from '../shared/types';
import { buyHotel, buyHouse, sellHotel, sellHouse } from './buildings';
import { advanceTurn, openDebt, phaseAfterLanding, settleBankruptcy, trySettleOrBankrupt } from './debt';
import { moveForwardAndResolve, sendToJail, freshDeckOrder } from './landing';
import { rollDice, shuffle } from './rng';
import { ok, reject, type ActionResult } from './result';
import { addToVacationPot, currentPlayer, getPlayer, updatePlayer, updateTile } from './state';

export function createGame(
  map: GameMap,
  players: { id: PlayerId; name: string; color: string }[],
  settings: RoomSettings,
  rng: () => number,
): GameState {
  const ids = players.map((p) => p.id);
  const turnOrder = settings.randomizePlayerOrder ? shuffle(ids, rng) : ids;

  const playerStates: Player[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    cash: settings.startingCash,
    tileIndex: map.startIndex,
    inJail: false,
    jailTurns: 0,
    pardonCards: 0,
    skipTurns: 0,
    bankrupt: false,
    connected: true,
  }));

  return {
    version: 0,
    mapId: map.id,
    settings,
    players: playerStates,
    turnOrder,
    currentPlayerIndex: 0,
    tiles: map.tiles.map(() => ({ owner: null, houses: 0, hotel: false, mortgaged: false })),
    bank: { houses: 32, hotels: 12 },
    decks: {
      treasure: { order: freshDeckOrder('treasure', map, shuffle, rng), index: 0 },
      surprise: { order: freshDeckOrder('surprise', map, shuffle, rng), index: 0 },
    },
    phase: 'LOBBY',
    debt: null,
    doublesCount: 0,
    lastRoll: null,
    vacationPot: 0,
    winner: null,
  };
}

function canMutateAssetsNormally(state: GameState, playerId: PlayerId): boolean {
  return (
    currentPlayer(state).id === playerId &&
    (state.phase === 'AWAITING_ROLL' || state.phase === 'AWAITING_END_TURN')
  );
}

function canSellDuringDebt(state: GameState, playerId: PlayerId): boolean {
  return state.phase === 'RESOLVING_DEBT' && state.debt !== null && state.debt.debtor === playerId;
}

function afterDebtorSale(map: GameMap, state: GameState, r: ActionResult): ActionResult {
  if (r.error) return r;
  if (state.phase !== 'RESOLVING_DEBT') return r;
  const settled = trySettleOrBankrupt(map, r.state, r.events);
  return { state: settled.state, events: settled.events };
}

function handleRoll(map: GameMap, state: GameState, playerId: PlayerId, rng: () => number): ActionResult {
  if (state.phase !== 'AWAITING_ROLL') return reject(state, 'Not awaiting a roll');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');

  const player = getPlayer(state, playerId);
  const dice = rollDice(rng);
  const isDouble = dice[0] === dice[1];
  const withRoll: GameState = { ...state, lastRoll: dice };
  const events: GameEvent[] = [{ type: 'rolled', playerId, dice, isDouble }];

  if (player.inJail) {
    if (isDouble) {
      // Doubles escape jail but never grant a bonus reroll — force the terminal sentinel.
      let next = updatePlayer(withRoll, playerId, { inJail: false, jailTurns: 0 });
      next = { ...next, doublesCount: 3 };
      events.push({ type: 'left_jail', playerId, how: 'doubles' });
      return moveForwardAndResolve(map, next, playerId, dice[0] + dice[1], events);
    }

    const jailTurns = player.jailTurns + 1;
    if (jailTurns < 3) {
      const next: GameState = {
        ...updatePlayer(withRoll, playerId, { jailTurns }),
        phase: 'AWAITING_END_TURN',
        doublesCount: 0,
      };
      return ok(next, events);
    }

    // Third failed attempt: pay the fee and move, forced.
    let next = updatePlayer(withRoll, playerId, { inJail: false, jailTurns: 0 });
    events.push({ type: 'left_jail', playerId, how: 'served' });
    const fee = state.settings.jailFee;
    if (player.cash >= fee) {
      next = updatePlayer(next, playerId, { cash: player.cash - fee });
      next = addToVacationPot(next, fee);
      events.push({ type: 'paid', from: playerId, to: null, amount: fee, reason: 'jail_fee' });
      return moveForwardAndResolve(map, next, playerId, dice[0] + dice[1], events);
    }
    // Can't even afford the exit fee: treat as an ordinary bank debt. This is a rare
    // corner (deliberate simplification) — once the debt clears the turn simply ends;
    // the missed move is not replayed.
    const r = openDebt(map, next, playerId, fee, null);
    return { state: r.state, events: [...events, ...r.events] };
  }

  const doublesCount = isDouble ? state.doublesCount + 1 : 0;
  const next = { ...withRoll, doublesCount };
  if (isDouble && doublesCount >= 3) {
    return sendToJail(map, next, playerId, 'doubles', events);
  }
  return moveForwardAndResolve(map, next, playerId, dice[0] + dice[1], events);
}

function handleBuy(map: GameMap, state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'AWAITING_BUY') return reject(state, 'Not awaiting a buy decision');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');
  const player = getPlayer(state, playerId);
  const tile = map.tiles[player.tileIndex]!;
  if (tile.type !== 'city' && tile.type !== 'airport' && tile.type !== 'company') return reject(state, 'Not a buyable tile');
  const ownership = state.tiles[player.tileIndex]!;
  if (ownership.owner !== null) return reject(state, 'Already owned');
  if (player.cash < tile.price) return reject(state, 'Not enough cash');

  let next = updatePlayer(state, playerId, { cash: player.cash - tile.price });
  next = updateTile(next, player.tileIndex, { owner: playerId });
  next = { ...next, phase: phaseAfterLanding(next) };
  return ok(next, [
    { type: 'paid', from: playerId, to: null, amount: tile.price, reason: 'bought_property' },
    { type: 'bought', playerId, tileIndex: player.tileIndex, price: tile.price },
  ]);
}

function handleDeclineBuy(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'AWAITING_BUY') return reject(state, 'Not awaiting a buy decision');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');
  return ok({ ...state, phase: phaseAfterLanding(state) }, []);
}

function handlePayJailFee(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'AWAITING_ROLL') return reject(state, 'Can only pay the jail fee before rolling');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');
  const player = getPlayer(state, playerId);
  if (!player.inJail) return reject(state, 'Not in jail');
  if (player.cash < state.settings.jailFee) return reject(state, 'Not enough cash');
  let next = updatePlayer(state, playerId, { cash: player.cash - state.settings.jailFee, inJail: false, jailTurns: 0 });
  next = addToVacationPot(next, state.settings.jailFee);
  // Paying your way out ends the turn on the spot — no roll, no build window this turn.
  const advanced = advanceTurn(next);
  next = { ...advanced.state, phase: 'AWAITING_ROLL' };
  return ok(next, [
    { type: 'paid', from: playerId, to: null, amount: state.settings.jailFee, reason: 'jail_fee' },
    { type: 'left_jail', playerId, how: 'fee' },
    ...advanced.events,
    { type: 'turn_ended', nextPlayerId: currentPlayer(next).id },
  ]);
}

function handleUsePardon(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'AWAITING_ROLL') return reject(state, 'Can only use a pardon before rolling');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');
  const player = getPlayer(state, playerId);
  if (!player.inJail) return reject(state, 'Not in jail');
  if (player.pardonCards < 1) return reject(state, 'No pardon card held');
  const next = updatePlayer(state, playerId, { pardonCards: player.pardonCards - 1, inJail: false, jailTurns: 0 });
  return ok(next, [{ type: 'left_jail', playerId, how: 'pardon' }]);
}

function handleEndTurn(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'AWAITING_END_TURN') return reject(state, 'Not awaiting end of turn');
  if (currentPlayer(state).id !== playerId) return reject(state, 'Not your turn');
  const advanced = advanceTurn(state);
  const next: GameState = { ...advanced.state, phase: 'AWAITING_ROLL' };
  return ok(next, [...advanced.events, { type: 'turn_ended', nextPlayerId: currentPlayer(next).id }]);
}

function handleDeclareBankruptcy(map: GameMap, state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase === 'LOBBY' || state.phase === 'GAME_OVER') return reject(state, 'Game not in progress');
  const player = getPlayer(state, playerId);
  if (player.bankrupt) return reject(state, 'Already bankrupt');
  const creditor = state.phase === 'RESOLVING_DEBT' && state.debt && state.debt.debtor === playerId ? state.debt.creditor : null;
  const r = settleBankruptcy(map, state, playerId, creditor);
  return { state: r.state, events: r.events };
}

function dispatch(map: GameMap, state: GameState, playerId: PlayerId, action: GameAction, rng: () => number): ActionResult {
  switch (action.type) {
    case 'start_game': {
      if (state.phase !== 'LOBBY') return reject(state, 'Game already started');
      // One seat is enough to start. A solo game is only offered behind the client's
      // developer toggle (`useDevMode`), and the worst a stranger can do by sending this
      // action directly is play a board game against nobody.
      if (state.turnOrder.length < 1) return reject(state, 'Need at least 1 player');
      return ok({ ...state, phase: 'AWAITING_ROLL' }, [{ type: 'game_started', turnOrder: state.turnOrder }]);
    }
    case 'roll':
      return handleRoll(map, state, playerId, rng);
    case 'buy':
      return handleBuy(map, state, playerId);
    case 'decline_buy':
      return handleDeclineBuy(state, playerId);
    case 'buy_house': {
      if (!canMutateAssetsNormally(state, playerId)) return reject(state, 'Cannot build right now');
      return buyHouse(map, state, playerId, action.tileIndex);
    }
    case 'buy_hotel': {
      if (!canMutateAssetsNormally(state, playerId)) return reject(state, 'Cannot build right now');
      return buyHotel(map, state, playerId, action.tileIndex);
    }
    case 'sell_house': {
      if (!canMutateAssetsNormally(state, playerId) && !canSellDuringDebt(state, playerId)) {
        return reject(state, 'Cannot sell right now');
      }
      return afterDebtorSale(map, state, sellHouse(map, state, playerId, action.tileIndex));
    }
    case 'sell_hotel': {
      if (!canMutateAssetsNormally(state, playerId) && !canSellDuringDebt(state, playerId)) {
        return reject(state, 'Cannot sell right now');
      }
      return afterDebtorSale(map, state, sellHotel(map, state, playerId, action.tileIndex));
    }
    case 'pay_jail_fee':
      return handlePayJailFee(state, playerId);
    case 'use_pardon':
      return handleUsePardon(state, playerId);
    case 'end_turn':
      return handleEndTurn(state, playerId);
    case 'declare_bankruptcy':
      return handleDeclareBankruptcy(map, state, playerId);
  }
}

export function reduce(
  map: GameMap,
  state: GameState,
  pa: PlayerAction,
  rng: () => number,
): { state: GameState; events: GameEvent[]; error?: string } {
  const { playerId, action } = pa;
  if (!state.players.some((p) => p.id === playerId)) {
    return { state, events: [], error: 'Unknown player' };
  }

  const result = dispatch(map, state, playerId, action, rng);
  if (result.error !== undefined) {
    return { state, events: [], error: result.error };
  }
  return { state: { ...result.state, version: state.version + 1 }, events: result.events };
}
