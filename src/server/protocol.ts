/**
 * Parse and validate incoming `ClientMessage` JSON.
 *
 * The client is treated as hostile: a public socket-interceptor cheat suite exists for
 * richup-style games, so every field is type- and shape-checked, unknown message types
 * and unknown object keys are rejected, and nothing here ever produces a `playerId` —
 * the caller (room.ts) always uses the id bound to the socket, never one read off the wire.
 */
import type { ClientMessage, GameAction, MapId, RoomSettings } from '../shared/types';

const MAP_IDS: readonly MapId[] = ['classic', 'mr-worldwide', 'death-valley', 'lucky-wheel'];

const NO_PAYLOAD_ACTION_TYPES = new Set<GameAction['type']>([
  'start_game',
  'roll',
  'buy',
  'decline_buy',
  'pay_jail_fee',
  'use_pardon',
  'end_turn',
  'declare_bankruptcy',
]);

const TILE_ACTION_TYPES = new Set<GameAction['type']>([
  'buy_house',
  'sell_house',
  'buy_hotel',
  'sell_hotel',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function extraKeys(obj: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(obj).some((k) => !allowed.includes(k));
}

/** The largest board is 48 tiles; anything longer than that is junk, not a trade. */
const MAX_TRADE_TILES = 64;
const MAX_ID_LENGTH = 64;

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;
}

function isValidTradeSide(side: unknown): boolean {
  return (
    isPlainObject(side) &&
    !extraKeys(side, ['cash', 'tiles', 'pardonCards']) &&
    isNonNegativeInt(side.cash) &&
    isNonNegativeInt(side.pardonCards) &&
    Array.isArray(side.tiles) &&
    side.tiles.length <= MAX_TRADE_TILES &&
    side.tiles.every(isNonNegativeInt)
  );
}

function isValidGameAction(action: unknown): action is GameAction {
  if (!isPlainObject(action) || typeof action.type !== 'string') return false;
  const type = action.type as GameAction['type'];

  if (NO_PAYLOAD_ACTION_TYPES.has(type)) {
    return !extraKeys(action, ['type']);
  }

  if (TILE_ACTION_TYPES.has(type)) {
    return (
      !extraKeys(action, ['type', 'tileIndex']) &&
      typeof action.tileIndex === 'number' &&
      Number.isInteger(action.tileIndex) &&
      action.tileIndex >= 0
    );
  }

  if (type === 'propose_trade') {
    return (
      !extraKeys(action, ['type', 'to', 'offer', 'request', 'counterOf']) &&
      isId(action.to) &&
      isValidTradeSide(action.offer) &&
      isValidTradeSide(action.request) &&
      (action.counterOf === undefined || isId(action.counterOf))
    );
  }

  if (type === 'accept_trade' || type === 'decline_trade' || type === 'cancel_trade') {
    return !extraKeys(action, ['type', 'tradeId']) && isId(action.tradeId);
  }

  return false;
}

/** Canonical form for comparing player names: trimmed and case-folded. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** True if `name` collides with any of `existing` once trimmed and case-folded. */
export function isNameTaken(name: string, existing: readonly string[]): boolean {
  const wanted = normalizeName(name);
  return existing.some((n) => normalizeName(n) === wanted);
}

/** Whitelist of settings keys and a type check for each. Unknown keys are rejected. */
const SETTINGS_VALIDATORS: { [K in keyof RoomSettings]: (v: unknown) => boolean } = {
  mapId: (v) => typeof v === 'string' && MAP_IDS.includes(v as MapId),
  startingCash: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  maxPlayers: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= 8,
  doubleRentOnFullSet: (v) => typeof v === 'boolean',
  auction: (v) => typeof v === 'boolean',
  mortgage: (v) => typeof v === 'boolean',
  evenBuild: (v) => typeof v === 'boolean',
  randomizePlayerOrder: (v) => typeof v === 'boolean',
  vacationCash: (v) => typeof v === 'boolean',
  noRentInPrison: (v) => typeof v === 'boolean',
  startSalary: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  landOnStartBonus: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  jailFee: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  companyRentMultipliers: (v) => Array.isArray(v) && v.every((n) => typeof n === 'number'),
  unlimitedBuildings: (v) => typeof v === 'boolean',
  antiCollusion: (v) => typeof v === 'boolean',
};

function isValidSettingsPatch(patch: unknown): patch is Partial<RoomSettings> {
  if (!isPlainObject(patch)) return false;
  for (const [key, value] of Object.entries(patch)) {
    const validator = SETTINGS_VALIDATORS[key as keyof RoomSettings];
    if (!validator || !validator(value)) return false;
  }
  return true;
}

/** Returns the validated message, or `null` if it doesn't match the `ClientMessage` contract. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isPlainObject(raw) || typeof raw.type !== 'string') return null;

  switch (raw.type) {
    case 'join': {
      if (extraKeys(raw, ['type', 'name', 'token'])) return null;
      if (typeof raw.name !== 'string') return null;
      const name = raw.name.trim();
      if (name.length < 1 || name.length > 24) return null;
      if (raw.token !== undefined && typeof raw.token !== 'string') return null;
      return raw.token ? { type: 'join', name, token: raw.token } : { type: 'join', name };
    }
    case 'leave': {
      if (extraKeys(raw, ['type'])) return null;
      return { type: 'leave' };
    }
    case 'add_dummy': {
      if (extraKeys(raw, ['type'])) return null;
      return { type: 'add_dummy' };
    }
    case 'remove_player': {
      if (extraKeys(raw, ['type', 'playerId'])) return null;
      if (typeof raw.playerId !== 'string' || raw.playerId.length === 0) return null;
      return { type: 'remove_player', playerId: raw.playerId };
    }
    case 'update_settings': {
      if (extraKeys(raw, ['type', 'settings'])) return null;
      if (!isValidSettingsPatch(raw.settings)) return null;
      return { type: 'update_settings', settings: raw.settings };
    }
    case 'action': {
      if (extraKeys(raw, ['type', 'action', 'asPlayerId'])) return null;
      if (!isValidGameAction(raw.action)) return null;
      // Shape only. Whether the sender may act as this id is decided in room.ts against
      // the players table, never here and never from anything the client asserts.
      if (raw.asPlayerId !== undefined && typeof raw.asPlayerId !== 'string') return null;
      return raw.asPlayerId
        ? { type: 'action', action: raw.action, asPlayerId: raw.asPlayerId }
        : { type: 'action', action: raw.action };
    }
    default:
      return null;
  }
}
