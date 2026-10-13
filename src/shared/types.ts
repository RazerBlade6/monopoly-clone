/**
 * The contract every lane builds against. READ-ONLY for subagents — if you need a
 * change here, stop and report it rather than editing.
 *
 * Casing note: `research/richup-maps-all.md` carries the tile schema in two casings.
 * Its prose table uses richup's live React prop names (`bonusType`, `rentPrices`,
 * `countryId`, `housePrice`); its JSON block uses snake_case (`bonus_type`, `rents`,
 * `country`, `house_price`). THIS FILE IS THE ONLY AUTHORITY: camelCase, names as
 * below. The map-data lane transforms the JSON, it does not copy its keys.
 */

// ─── Board data ──────────────────────────────────────────────────────────────

export type MapId = 'classic' | 'mr-worldwide' | 'death-valley' | 'lucky-wheel';

export type CountryId =
  | 'brazil' | 'canada' | 'china' | 'france' | 'germany' | 'india' | 'ireland'
  | 'israel' | 'italy' | 'japan' | 'romania' | 'turkey'
  | 'united-kingdom' | 'united-states-of-america';

/** 6 rent levels: index 0 = bare lot, 1–4 = houses, 5 = hotel. */
export type CityRents = readonly [number, number, number, number, number, number];
/** Flat rent by number of airports the owner holds, index = count - 1. */
export type AirportRents = readonly [number, number, number, number];

export type Tile =
  | { index: number; type: 'corner'; name: string;
      subtype: 'start' | 'jail' | 'free_parking' | 'go_to_jail' }
  | { index: number; type: 'city'; name: string; countryId: CountryId;
      price: number; rents: CityRents; housePrice: number; hotelPrice: number }
  | { index: number; type: 'airport'; name: string; price: number; rents: AirportRents }
  | { index: number; type: 'company'; name: string; price: number }
  | { index: number; type: 'bonus'; name: string; bonusType: 'treasure' | 'surprise' }
  | { index: number; type: 'bonus'; name: string; bonusType: 'tax'; taxPercentage: number }
  | { index: number; type: 'bonus'; name: string; bonusType: 'premium-tax' | 'tax-refund';
      taxAmount: number };

export type OwnableTile = Extract<Tile, { type: 'city' | 'airport' | 'company' }>;

export interface GameMap {
  id: MapId;
  name: string;
  /** Dense, ordered, `tiles[i].index === i`. Length is 40 or 48 — never assume. */
  tiles: readonly Tile[];
  /** Derived from the board, never a constant. */
  startIndex: number;
  jailIndex: number;
  goToJailIndex: number;
  /** Country groups present on this map, with their sizes. Observed sizes across our
   * four maps are 2, 3, 4, 5 and 6 — Death Valley has both 5- and 6-property groups.
   * Never assume a size; read it from here. */
  countrySizes: Readonly<Record<string, number>>;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export type DeckId = 'treasure' | 'surprise';

export type CardEffect =
  /** Positive = bank pays player, negative = player pays bank. */
  | { kind: 'money'; amount: number }
  /** Positive = every other player pays you `amount`, negative = you pay each. */
  | { kind: 'money_from_each'; amount: number }
  | { kind: 'move_to'; tileIndex: number; collectStart: boolean }
  | { kind: 'move_relative'; spaces: number }
  | { kind: 'move_to_nearest'; tileType: 'airport' | 'company'; rentMultiplier: number }
  | { kind: 'go_to_jail' }
  | { kind: 'pardon' }
  | { kind: 'repairs'; perHouse: number; perHotel: number };

export interface Card {
  id: string;
  deck: DeckId;
  /** Original wording. Never Hasbro's text — see SPEC.md §IP. */
  text: string;
  effect: CardEffect;
}

// ─── Room settings ───────────────────────────────────────────────────────────

export interface RoomSettings {
  mapId: MapId;
  startingCash: number;
  maxPlayers: number;
  /** richup ships all three OFF by default. v1 engine rejects the two v2 ones. */
  doubleRentOnFullSet: boolean;
  auction: boolean;   // v2
  mortgage: boolean;  // v2
  evenBuild: boolean;
  randomizePlayerOrder: boolean;
  vacationCash: boolean;
  noRentInPrison: boolean;
  startSalary: number;
  /**
   * Extra cash paid on top of `startSalary` when a token comes to rest exactly on
   * START (passing over it pays `startSalary` alone). Flat, not scaled: richup's
   * bundle carries no start-bonus identifier (research/README.md:152), so the
   * relationship to `startSalary` is unknown and 100 is a literal, not a ratio.
   */
  landOnStartBonus: number;
  jailFee: number;
  /** Dice multiplier by number of companies owned, index = count - 1. */
  companyRentMultipliers: readonly number[];
  unlimitedBuildings: boolean;
  /**
   * Off (richup's rule): a player in debt may only make trades that bring in more cash than
   * they give. On: a debtor's trade must either clear the debt or not lose them value.
   */
  antiCollusion: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  mapId: 'classic',
  startingCash: 1500,
  maxPlayers: 8,
  doubleRentOnFullSet: false,
  auction: false,
  mortgage: false,
  evenBuild: true,
  randomizePlayerOrder: true,
  vacationCash: false,
  noRentInPrison: false,
  startSalary: 200,
  landOnStartBonus: 100,
  jailFee: 50,
  companyRentMultipliers: [4, 10, 20],
  unlimitedBuildings: false,
  antiCollusion: false,
};

// ─── Game state ──────────────────────────────────────────────────────────────

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  /**
   * Negative while this player is the debtor in RESOLVING_DEBT: everything they had was paid
   * over when the charge landed, and the balance is minus what they still owe.
   */
  cash: number;
  tileIndex: number;
  inJail: boolean;
  /** Turns spent in jail this stint, 0–3. */
  jailTurns: number;
  pardonCards: number;
  /** Turns this player must sit out before rolling again (set by landing on Vacation). */
  skipTurns: number;
  bankrupt: boolean;
  connected: boolean;
  /**
   * Lobby roster only — never present on a player inside `GameState`. Milliseconds left
   * before a disconnected player is dropped from the room, measured when the server sent
   * the roster (so the client counts down from receipt rather than trusting clock skew).
   */
  removeInMs?: number;
  /**
   * Set by the server on both the lobby roster and every broadcast state: the id of the
   * real player who added this seat as a dummy and drives it from their own tab. Absent
   * on ordinary players. The engine neither sets nor reads it — as far as the rules are
   * concerned a dummy is a player like any other.
   */
  dummyOf?: PlayerId;
}

export interface Ownership {
  owner: PlayerId | null;
  houses: number;   // 0–4
  hotel: boolean;
  mortgaged: boolean; // v1: always false (mortgage is v2)
}

export type Phase =
  | 'LOBBY'
  | 'AWAITING_ROLL'
  | 'AWAITING_BUY'      // landed on an unowned ownable; buy or decline
  | 'RESOLVING_DEBT'    // blocking: nobody rolls until it clears
  | 'AWAITING_END_TURN'
  | 'GAME_OVER';

export interface Debt {
  debtor: PlayerId;
  amount: number;
  /** null = the Bank. */
  creditor: PlayerId | null;
  /** Queued follow-on debts, resolved in order (SPEC decision 13). */
  queued: readonly { amount: number; creditor: PlayerId | null }[];
}

export interface TradeSide {
  cash: number;
  tiles: readonly number[];
  pardonCards: number;
}

export interface Trade {
  id: string;
  /** Proposer. */
  from: PlayerId;
  /** Recipient. */
  to: PlayerId;
  /** What `from` gives. */
  offer: TradeSide;
  /** What `to` gives. */
  request: TradeSide;
}

export interface GameState {
  version: number;
  mapId: MapId;
  settings: RoomSettings;
  players: readonly Player[];
  /** Player ids in turn order. */
  turnOrder: readonly PlayerId[];
  currentPlayerIndex: number;
  /** Parallel to `map.tiles`; non-ownable indices hold a vacant record. */
  tiles: readonly Ownership[];
  bank: { houses: number; hotels: number };
  decks: Readonly<Record<DeckId, { order: readonly string[]; index: number }>>;
  phase: Phase;
  debt: Debt | null;
  doublesCount: number;
  lastRoll: readonly [number, number] | null;
  /** Cash pooled on the Vacation corner when `vacationCash` is on. */
  vacationPot: number;
  winner: PlayerId | null;
  /** Pending trades only. */
  trades: readonly Trade[];
  /** Trades sent this turn per ordered pair, keyed `${from}>${to}`. */
  tradeSendCounts: Readonly<Record<string, number>>;
  /** Trade ids are `trade-${n}`, so they stay deterministic. */
  nextTradeId: number;
}

// ─── Actions (client → engine) ───────────────────────────────────────────────

export type GameAction =
  | { type: 'start_game' }
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline_buy' }
  | { type: 'buy_house'; tileIndex: number }
  | { type: 'sell_house'; tileIndex: number }
  | { type: 'buy_hotel'; tileIndex: number }
  | { type: 'sell_hotel'; tileIndex: number }
  | { type: 'pay_jail_fee' }
  | { type: 'use_pardon' }
  | { type: 'end_turn' }
  | { type: 'declare_bankruptcy' }
  | { type: 'propose_trade'; to: PlayerId; offer: TradeSide; request: TradeSide; counterOf?: string }
  | { type: 'accept_trade'; tradeId: string }
  | { type: 'decline_trade'; tradeId: string }
  | { type: 'cancel_trade'; tradeId: string };

/** Every action carries who sent it; the engine never trusts the client for anything else. */
export interface PlayerAction {
  playerId: PlayerId;
  action: GameAction;
}

// ─── Events (engine → clients, for the log and animations) ───────────────────

export type GameEvent =
  | { type: 'game_started'; turnOrder: readonly PlayerId[] }
  | { type: 'rolled'; playerId: PlayerId; dice: readonly [number, number]; isDouble: boolean }
  | { type: 'moved'; playerId: PlayerId; from: number; to: number; passedStart: boolean }
  | { type: 'paid'; from: PlayerId | null; to: PlayerId | null; amount: number; reason: string }
  | { type: 'bought'; playerId: PlayerId; tileIndex: number; price: number }
  | { type: 'built'; playerId: PlayerId; tileIndex: number; houses: number; hotel: boolean }
  | { type: 'card_drawn'; playerId: PlayerId; deck: DeckId; cardId: string }
  | { type: 'jailed'; playerId: PlayerId; reason: 'tile' | 'card' | 'doubles' }
  | { type: 'left_jail'; playerId: PlayerId; how: 'fee' | 'pardon' | 'doubles' | 'served' }
  | { type: 'debt_opened'; debt: Debt }
  | { type: 'debt_cleared'; playerId: PlayerId }
  | { type: 'bankrupt'; playerId: PlayerId; creditor: PlayerId | null }
  | { type: 'turn_skipped'; playerId: PlayerId }
  | { type: 'turn_ended'; nextPlayerId: PlayerId }
  | { type: 'game_over'; winner: PlayerId }
  | { type: 'trade_proposed'; trade: Trade; counterOf?: string }
  | { type: 'trade_accepted'; trade: Trade }
  | { type: 'trade_declined'; tradeId: string; from: PlayerId; to: PlayerId }
  | { type: 'trade_cancelled'; tradeId: string; reason: 'withdrawn' | 'invalid' | 'bankrupt' | 'countered' };

// ─── Transport (client ↔ server) ─────────────────────────────────────────────

export interface RoomMeta {
  code: string;
  hostId: PlayerId;
  settings: RoomSettings;
  started: boolean;
}

export type ClientMessage =
  | { type: 'join'; name: string; token?: string }
  | { type: 'leave' }
  /** Developer aid: seats a extra player the requester controls. Host only, lobby only. */
  | { type: 'add_dummy' }
  | { type: 'remove_player'; playerId: PlayerId }
  | { type: 'update_settings'; settings: Partial<RoomSettings> }
  /**
   * `asPlayerId` names one of the sender's own dummy players; the server refuses any
   * other id. Omitted, the action is taken by whoever the socket is bound to.
   */
  | { type: 'action'; action: GameAction; asPlayerId?: PlayerId };

export type ServerMessage =
  | { type: 'joined'; playerId: PlayerId; token: string; room: RoomMeta }
  | { type: 'room'; room: RoomMeta; players: readonly Player[] }
  | { type: 'state'; state: GameState }
  | { type: 'events'; events: readonly GameEvent[]; version: number }
  /**
   * `code` is set only where the client has to react structurally rather than just show
   * the text: `unknown_token` means the stored identity is dead (the player left, or was
   * swept after disconnecting), so the client must drop it instead of retrying forever.
   */
  | { type: 'error'; message: string; code?: 'unknown_token' };
