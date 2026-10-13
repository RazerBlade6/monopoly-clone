/**
 * Everything that happens once a token comes to rest on a tile: buy prompts,
 * rent, tax, and card effects. Card effects that move the player (move_to,
 * move_relative, move_to_nearest) recurse back into resolveLanding, since
 * landing on the new tile must resolve exactly like any other landing.
 *
 * Every branch here leaves `state.phase` fully decided by the time it
 * returns: AWAITING_BUY when a buy prompt is owed, RESOLVING_DEBT when
 * openDebt left a balance owing, or phaseAfterLanding() when
 * nothing is left pending. Callers (reducer.ts) never need to second-guess it.
 */
import type { Card, CardEffect, DeckId, GameEvent, GameMap, GameState, PlayerId, Tile } from '../shared/types';
import { getCard, getDeck } from '../data/cards';
import {
  addToVacationPot,
  countAirports,
  countCompanies,
  getPlayer,
  netWorthForTax,
  othersInTurnOrder,
  updatePlayer,
  walkForward,
} from './state';
import { openDebt, phaseAfterLanding } from './debt';

type Events = GameEvent[];
type Result = { state: GameState; events: Events };

function finish(state: GameState, events: Events): Result {
  return { state: { ...state, phase: phaseAfterLanding(state) }, events };
}

export function sendToJail(map: GameMap, state: GameState, playerId: PlayerId, reason: 'tile' | 'card' | 'doubles', events: Events): Result {
  const next = updatePlayer(state, playerId, { inJail: true, tileIndex: map.jailIndex, jailTurns: 0 });
  return { state: { ...next, phase: 'AWAITING_END_TURN' }, events: [...events, { type: 'jailed', playerId, reason }] };
}

/** Player pays `amount` to `creditor` (null = Bank); falls into RESOLVING_DEBT if they can't afford it. */
function chargeOrDebt(map: GameMap, state: GameState, playerId: PlayerId, amount: number, creditor: PlayerId | null, reason: string, events: Events): Result {
  if (amount <= 0) return finish(state, events);
  const player = getPlayer(state, playerId);
  if (player.cash >= amount) {
    let next = updatePlayer(state, playerId, { cash: player.cash - amount });
    if (creditor) {
      const c = getPlayer(next, creditor);
      next = updatePlayer(next, creditor, { cash: c.cash + amount });
    } else {
      next = addToVacationPot(next, amount);
    }
    return finish(next, [...events, { type: 'paid', from: playerId, to: creditor, amount, reason }]);
  }
  const r = openDebt(state, playerId, amount, creditor);
  return { state: r.state, events: [...events, ...r.events] };
}

function companyMultiplier(settings: GameState['settings'], count: number): number {
  const arr = settings.companyRentMultipliers;
  if (arr.length === 0 || count < 1) return 0;
  return arr[Math.min(count, arr.length) - 1]!;
}

function computeRent(
  map: GameMap,
  state: GameState,
  tile: Extract<Tile, { type: 'city' | 'airport' | 'company' }>,
  ownerId: PlayerId,
  multiplierOverride?: number,
): number {
  const ownership = state.tiles[tile.index]!;
  if (tile.type === 'city') {
    return ownership.hotel ? tile.rents[5] : tile.rents[ownership.houses as 0 | 1 | 2 | 3 | 4];
  }
  if (tile.type === 'airport') {
    const count = Math.max(1, countAirports(map, state, ownerId));
    const base = tile.rents[Math.min(count, tile.rents.length) - 1]!;
    return base * (multiplierOverride ?? 1);
  }
  const diceTotal = state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : 0;
  const count = Math.max(1, countCompanies(map, state, ownerId));
  const mult = multiplierOverride ?? companyMultiplier(state.settings, count);
  return diceTotal * mult;
}

function resolveOwnable(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  tile: Extract<Tile, { type: 'city' | 'airport' | 'company' }>,
  events: Events,
  rentMultiplierOverride?: number,
): Result {
  const ownership = state.tiles[tile.index]!;
  if (ownership.owner === null) {
    return { state: { ...state, phase: 'AWAITING_BUY' }, events };
  }
  if (ownership.owner === playerId) {
    return finish(state, events);
  }
  const owner = getPlayer(state, ownership.owner);
  if (owner.bankrupt) return finish(state, events);
  if (state.settings.noRentInPrison && owner.inJail) return finish(state, events);

  const rent = computeRent(map, state, tile, owner.id, rentMultiplierOverride);
  return chargeOrDebt(map, state, playerId, rent, owner.id, 'rent', events);
}

function resolveBonus(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  tile: Extract<Tile, { type: 'bonus' }>,
  events: Events,
): Result {
  if (tile.bonusType === 'tax') {
    const amount = Math.ceil((netWorthForTax(map, state, playerId) * tile.taxPercentage) / 100);
    return chargeOrDebt(map, state, playerId, amount, null, 'earnings_tax', events);
  }
  if (tile.bonusType === 'premium-tax') {
    return chargeOrDebt(map, state, playerId, tile.taxAmount, null, 'premium_tax', events);
  }
  if (tile.bonusType === 'tax-refund') {
    const player = getPlayer(state, playerId);
    const next = updatePlayer(state, playerId, { cash: player.cash + tile.taxAmount });
    return finish(next, [...events, { type: 'paid', from: null, to: playerId, amount: tile.taxAmount, reason: 'tax_refund' }]);
  }
  return drawCard(map, state, playerId, tile.bonusType, events);
}

function drawCard(map: GameMap, state: GameState, playerId: PlayerId, deck: DeckId, events: Events): Result {
  const deckState = state.decks[deck];
  if (deckState.order.length === 0) return finish(state, events);
  const cardId = deckState.order[deckState.index % deckState.order.length]!;
  const nextIndex = deckState.index + 1;
  let next: GameState = { ...state, decks: { ...state.decks, [deck]: { order: deckState.order, index: nextIndex } } };
  const withDraw = [...events, { type: 'card_drawn' as const, playerId, deck, cardId }];

  let card: Card;
  try {
    card = getCard(cardId);
  } catch {
    return finish(next, withDraw); // unknown id (e.g. a fixture-only deck): draw and move on, no effect
  }
  return applyCardEffect(map, next, playerId, card.effect, withDraw);
}

export function applyCardEffect(map: GameMap, state: GameState, playerId: PlayerId, effect: CardEffect, events: Events): Result {
  const player = getPlayer(state, playerId);

  switch (effect.kind) {
    case 'money': {
      if (effect.amount >= 0) {
        const next = updatePlayer(state, playerId, { cash: player.cash + effect.amount });
        return finish(next, [...events, { type: 'paid', from: null, to: playerId, amount: effect.amount, reason: 'card' }]);
      }
      return chargeOrDebt(map, state, playerId, -effect.amount, null, 'card', events);
    }

    case 'money_from_each': {
      const others = othersInTurnOrder(state, playerId);
      if (others.length === 0) return finish(state, events);

      if (effect.amount >= 0) {
        // Each other player pays you. A player who can't afford it in cash pays
        // what they have; this is a deliberate v1 simplification (no interactive
        // liquidation for a passive third party mid another player's turn) — cash
        // conservation still holds because the creditor only ever receives the
        // sum actually collected, never the nominal amount.
        let next = state;
        const evs = events.slice();
        let received = 0;
        for (const other of others) {
          const pay = Math.min(other.cash, effect.amount);
          if (pay <= 0) continue;
          next = updatePlayer(next, other.id, { cash: other.cash - pay });
          received += pay;
          evs.push({ type: 'paid', from: other.id, to: playerId, amount: pay, reason: 'money_from_each' });
        }
        next = updatePlayer(next, playerId, { cash: getPlayer(next, playerId).cash + received });
        return finish(next, evs);
      }

      // You pay each other player — SPEC decision 13's multi-creditor debt, paid
      // in turn order starting with the player to your left.
      const amount = -effect.amount;
      if (player.cash >= amount * others.length) {
        let next = state;
        const evs = events.slice();
        for (const other of others) {
          next = updatePlayer(next, playerId, { cash: getPlayer(next, playerId).cash - amount });
          next = updatePlayer(next, other.id, { cash: getPlayer(next, other.id).cash + amount });
          evs.push({ type: 'paid', from: playerId, to: other.id, amount, reason: 'money_from_each' });
        }
        return finish(next, evs);
      }
      const [first, ...rest] = others;
      const queued = rest.map((o) => ({ amount, creditor: o.id }));
      const r = openDebt(state, playerId, amount, first!.id, queued);
      return { state: r.state, events: [...events, ...r.events] };
    }

    case 'go_to_jail':
      return sendToJail(map, state, playerId, 'card', events);

    case 'pardon': {
      const next = updatePlayer(state, playerId, { pardonCards: player.pardonCards + 1 });
      return finish(next, events);
    }

    case 'repairs': {
      let total = 0;
      for (const index of map.tiles.filter((t) => t.type === 'city').map((t) => t.index)) {
        const o = state.tiles[index]!;
        if (o.owner !== playerId) continue;
        total += o.hotel ? effect.perHotel : o.houses * effect.perHouse;
      }
      return chargeOrDebt(map, state, playerId, total, null, 'repairs', events);
    }

    case 'move_to': {
      const from = player.tileIndex;
      let next = updatePlayer(state, playerId, { tileIndex: effect.tileIndex });
      const evs = [...events, { type: 'moved' as const, playerId, from, to: effect.tileIndex, passedStart: effect.collectStart }];
      if (effect.collectStart) {
        next = updatePlayer(next, playerId, { cash: getPlayer(next, playerId).cash + state.settings.startSalary });
        evs.push({ type: 'paid', from: null, to: playerId, amount: state.settings.startSalary, reason: 'start_salary' });
      }
      return resolveLanding(map, next, playerId, evs);
    }

    case 'move_relative': {
      if (effect.spaces >= 0) {
        return moveForwardAndResolve(map, state, playerId, effect.spaces, events);
      }
      // Backward moves never pay a Go salary, even if they pass over it.
      const from = player.tileIndex;
      const n = map.tiles.length;
      const to = ((from + effect.spaces) % n + n) % n;
      const next = updatePlayer(state, playerId, { tileIndex: to });
      const evs = [...events, { type: 'moved' as const, playerId, from, to, passedStart: false }];
      return resolveLanding(map, next, playerId, evs);
    }

    case 'move_to_nearest': {
      const from = player.tileIndex;
      const n = map.tiles.length;
      let dist = -1;
      for (let step = 1; step <= n; step++) {
        if (map.tiles[(from + step) % n]!.type === effect.tileType) {
          dist = step;
          break;
        }
      }
      if (dist === -1) return finish(state, events); // map has none of this tile type
      const { to, passedStart } = walkForward(map, from, dist);
      let next = updatePlayer(state, playerId, { tileIndex: to });
      const evs = [...events, { type: 'moved' as const, playerId, from, to, passedStart }];
      if (passedStart) {
        next = updatePlayer(next, playerId, { cash: getPlayer(next, playerId).cash + state.settings.startSalary });
        evs.push({ type: 'paid', from: null, to: playerId, amount: state.settings.startSalary, reason: 'start_salary' });
      }
      const destTile = map.tiles[to]! as Extract<Tile, { type: 'airport' | 'company' }>;
      return resolveOwnable(map, next, playerId, destTile, evs, effect.rentMultiplier);
    }
  }
}

/** Walks forward `steps` tiles, pays the Go salary if passed/landed on, then resolves the landing. */
export function moveForwardAndResolve(map: GameMap, state: GameState, playerId: PlayerId, steps: number, events: Events): Result {
  const player = getPlayer(state, playerId);
  const from = player.tileIndex;
  const { to, passedStart } = walkForward(map, from, steps);
  let next = updatePlayer(state, playerId, { tileIndex: to });
  const evs = [...events, { type: 'moved' as const, playerId, from, to, passedStart }];
  if (passedStart) {
    next = updatePlayer(next, playerId, { cash: getPlayer(next, playerId).cash + state.settings.startSalary });
    evs.push({ type: 'paid', from: null, to: playerId, amount: state.settings.startSalary, reason: 'start_salary' });
  }
  return resolveLanding(map, next, playerId, evs);
}

export function resolveLanding(map: GameMap, state: GameState, playerId: PlayerId, events: Events): Result {
  const player = getPlayer(state, playerId);
  const tile = map.tiles[player.tileIndex]!;

  if (tile.type === 'corner') {
    if (tile.subtype === 'go_to_jail') return sendToJail(map, state, playerId, 'tile', events);
    if (tile.subtype === 'start') {
      const next = updatePlayer(state, playerId, { cash: player.cash + state.settings.landOnStartBonus });
      return finish(next, [...events, { type: 'paid', from: null, to: playerId, amount: state.settings.landOnStartBonus, reason: 'start_bonus' }]);
    }
    if (tile.subtype === 'free_parking') {
      let next = updatePlayer(state, playerId, { skipTurns: 1 });
      const evs = events.slice();
      if (state.vacationPot > 0) {
        const p = getPlayer(next, playerId);
        next = { ...updatePlayer(next, playerId, { cash: p.cash + state.vacationPot }), vacationPot: 0 };
        evs.push({ type: 'paid', from: null, to: playerId, amount: state.vacationPot, reason: 'vacation_pot' });
      }
      return finish(next, evs);
    }
    return finish(state, events);
  }
  if (tile.type === 'bonus') return resolveBonus(map, state, playerId, tile, events);
  return resolveOwnable(map, state, playerId, tile, events);
}

/**
 * Whether a card can do something on this map. This is how maps opt out of
 * cards: nothing is hand-maintained, it is worked out from the tiles, so a new
 * map is covered automatically. Every effect kind makes a deliberate choice
 * here, so adding a kind to CardEffect fails to compile until it is decided.
 */
export function isCardPlayableOnMap(card: Card, map: GameMap): boolean {
  const effect = card.effect;
  switch (effect.kind) {
    case 'move_to_nearest':
      return map.tiles.some((t) => t.type === effect.tileType);
    case 'move_to':
      return Number.isInteger(effect.tileIndex) && effect.tileIndex >= 0 && effect.tileIndex < map.tiles.length;
    case 'money':
    case 'money_from_each':
    case 'move_relative':
    case 'go_to_jail':
    case 'pardon':
    case 'repairs':
      return true;
  }
}

/** Shuffles a fresh deck order for createGame; card content is looked up lazily via getCard. */
export function freshDeckOrder(
  deck: DeckId,
  map: GameMap,
  shuffle: <T>(items: readonly T[], rng: () => number) => T[],
  rng: () => number,
): string[] {
  // Filter before shuffling so the rng stream depends only on the playable set.
  return shuffle(
    getDeck(deck).filter((c) => isCardPlayableOnMap(c, map)).map((c) => c.id),
    rng,
  );
}
