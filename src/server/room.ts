/**
 * The `Room` Durable Object — one per game room (SQLite-backed, WebSocket-hibernating).
 *
 * Responsibilities, and nothing else: lobby (join / reconnect / settings / start),
 * holding the authoritative `GameState`, applying actions through the engine, broadcasting,
 * and persisting to SQLite so a hibernated or evicted room resumes. All game rules live in
 * `src/engine`; this file never inspects a `GameAction` beyond routing it to `reduce`.
 */
import { DurableObject } from 'cloudflare:workers';
import type {
  ClientMessage,
  GameAction,
  GameState,
  Player,
  PlayerAction,
  RoomMeta,
  RoomSettings,
  ServerMessage,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import type { Env } from './env';
import { isNameTaken, parseClientMessage } from './protocol';
import { createGame, reduce } from './engine-adapter';
import { getMap } from '../data/maps/index';
import { createRng, randomSeed } from './rng';

const COLOR_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
];

// `type` (not `interface`) so these structurally satisfy the SQL API's
// `Record<string, SqlStorageValue>` generic constraint.
type RoomRow = {
  id: number;
  code: string;
  host_id: string | null;
  settings: string;
  started: number;
  rng_seed: number;
  rng_state: number;
  state: string | null;
};

type PlayerRow = {
  id: string;
  token: string;
  name: string;
  color: string;
  join_order: number;
  connected: number;
  /** Epoch ms of the moment this player went offline; NULL while they are connected. */
  disconnected_at: number | null;
  /** Id of the real player who added and drives this seat; NULL for ordinary players. */
  dummy_of: string | null;
};

/** How long a disconnected player keeps their lobby seat when `LOBBY_GRACE_MS` is unset. */
const DEFAULT_LOBBY_GRACE_MS = 120_000;

/**
 * A debt opened before balances could go negative left the debtor holding their cash while
 * owing the full amount. The engine now expects `cash === -owed`, and would otherwise pay
 * the creditor money the debtor never had, so shift such a balance down once on read. A
 * debtor in the current model is always negative, which is what tells the two apart.
 */
function migrateDebtBalance(state: GameState): GameState {
  const debt = state.debt;
  if (!debt) return state;
  const debtor = state.players.find((p) => p.id === debt.debtor);
  if (!debtor || debtor.cash < 0) return state;
  const owed = debt.amount + debt.queued.reduce((sum, q) => sum + q.amount, 0);
  return {
    ...state,
    players: state.players.map((p) => (p.id === debtor.id ? { ...p, cash: p.cash - owed } : p)),
  };
}

interface SocketAttachment {
  playerId: string;
}

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        code TEXT NOT NULL,
        host_id TEXT,
        settings TEXT NOT NULL,
        started INTEGER NOT NULL DEFAULT 0,
        rng_seed INTEGER NOT NULL,
        rng_state INTEGER NOT NULL,
        state TEXT
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        join_order INTEGER NOT NULL,
        connected INTEGER NOT NULL DEFAULT 1
      )
    `);
    // `CREATE TABLE IF NOT EXISTS` leaves an already-existing table untouched, so rooms
    // created before the lobby-sweep shipped need the column added. Read first and only
    // ALTER when it is genuinely missing: this runs inside `blockConcurrencyWhile` on
    // every wake, and a throw here would leave the room permanently unbootable.
    const columns = this.ctx.storage.sql
      .exec<{ name: string }>('PRAGMA table_info(players)')
      .toArray();
    if (!columns.some((c) => c.name === 'disconnected_at')) {
      this.ctx.storage.sql.exec('ALTER TABLE players ADD COLUMN disconnected_at INTEGER');
    }
    if (!columns.some((c) => c.name === 'dummy_of')) {
      this.ctx.storage.sql.exec('ALTER TABLE players ADD COLUMN dummy_of TEXT');
    }
  }

  /** Test hook: see `Env.LOBBY_GRACE_MS`. */
  private graceMs(): number {
    const raw = Number(this.env.LOBBY_GRACE_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOBBY_GRACE_MS;
  }

  // ── Worker-facing RPC ─────────────────────────────────────────────────────

  /** Idempotent: creates the room row the first time it's called, no-ops after. */
  async init(code: string): Promise<{ created: boolean }> {
    if (this.getRoomRow()) return { created: false };
    const seed = randomSeed();
    this.ctx.storage.sql.exec(
      `INSERT INTO room (id, code, host_id, settings, started, rng_seed, rng_state, state)
       VALUES (1, ?, NULL, ?, 0, ?, ?, NULL)`,
      code,
      JSON.stringify(DEFAULT_SETTINGS),
      seed,
      seed,
    );
    return { created: true };
  }

  async getMeta(): Promise<RoomMeta | null> {
    const row = this.getRoomRow();
    return row ? this.roomMetaFromRow(row) : null;
  }

  // ── WebSocket entry point (hibernatable) ───────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') {
      this.sendError(ws, 'binary messages are not supported');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendError(ws, 'malformed JSON');
      return;
    }
    const message = parseClientMessage(parsed);
    if (!message) {
      this.sendError(ws, 'malformed message');
      return;
    }
    try {
      this.handleMessage(ws, message);
    } catch (err) {
      this.sendError(ws, err instanceof Error ? err.message : 'internal error');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    await this.handleDisconnect(ws);
    // 1005/1006 are reserved (no status / abnormal) and can't be sent back out.
    const safeCode = code === 1005 || code === 1006 ? 1000 : code;
    ws.close(safeCode, reason);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  // ── Message routing ─────────────────────────────────────────────────────

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message.name, message.token);
        return;
      case 'leave':
        this.handleLeave(ws);
        return;
      case 'add_dummy':
        this.handleAddDummy(ws);
        return;
      case 'remove_player':
        this.handleRemovePlayer(ws, message.playerId);
        return;
      case 'update_settings':
        this.handleUpdateSettings(ws, message.settings);
        return;
      case 'action':
        this.handleAction(ws, message.action, message.asPlayerId);
        return;
    }
  }

  private handleJoin(ws: WebSocket, name: string, token: string | undefined): void {
    if (this.boundPlayerId(ws)) {
      this.sendError(ws, 'already joined');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }

    if (token) {
      const existing = this.getPlayerByToken(token);
      if (!existing) {
        // The client drops its stored identity on this code and falls back to the join
        // form — without it a swept or departed player's socket would reconnect, be
        // refused, and retry every 1.5s forever.
        this.sendError(ws, 'invalid reconnect token', 'unknown_token');
        return;
      }
      this.closeOtherSocketsFor(existing.id, ws);
      this.bindSocket(ws, existing.id);
      this.setPlayerConnected(existing.id, true, row);
      const freshRow = this.getRoomRow()!;
      this.sendJoined(ws, existing.id, existing.token, freshRow);
      // Reconnecting players get the current lobby roster or full game snapshot via the
      // broadcast below — this socket is already registered (accepted in `fetch`), so it
      // receives its own copy same as everyone else.
      this.broadcastRoomOrState(freshRow);
      return;
    }

    if (row.started) {
      this.sendError(ws, 'room already started');
      return;
    }
    const settings = this.settingsOf(row);
    const players = this.getPlayers();
    if (players.length >= settings.maxPlayers) {
      this.sendError(ws, 'room is full');
      return;
    }
    if (isNameTaken(name, players.map((p) => p.name))) {
      this.sendError(ws, 'That name is already taken in this room.');
      return;
    }

    const playerId = crypto.randomUUID();
    const playerToken = crypto.randomUUID();
    // Seats can now be vacated, so neither of these may be derived from the head count:
    // reusing a departed player's join order would collide on the PRIMARY-KEY-free
    // ordering, and reusing their colour would hand two live players the same token.
    const joinOrder = Math.max(-1, ...players.map((p) => p.join_order)) + 1;
    const taken = new Set(players.map((p) => p.color));
    const color = COLOR_PALETTE.find((c) => !taken.has(c)) ?? COLOR_PALETTE[joinOrder % COLOR_PALETTE.length]!;
    const isFirst = players.length === 0;

    this.ctx.storage.sql.exec(
      `INSERT INTO players (id, token, name, color, join_order, connected) VALUES (?, ?, ?, ?, ?, 1)`,
      playerId,
      playerToken,
      name,
      color,
      joinOrder,
    );
    if (isFirst) {
      this.ctx.storage.sql.exec('UPDATE room SET host_id = ? WHERE id = 1', playerId);
    }

    this.bindSocket(ws, playerId);
    const freshRow = this.getRoomRow()!;
    this.sendJoined(ws, playerId, playerToken, freshRow);
    this.broadcastRoomOrState(freshRow);
  }

  private handleUpdateSettings(ws: WebSocket, patch: Partial<RoomSettings>): void {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) {
      this.sendError(ws, 'join first');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }
    if (row.host_id !== playerId) {
      this.sendError(ws, 'only the host can change settings');
      return;
    }
    if (row.started) {
      this.sendError(ws, 'game already started');
      return;
    }

    const seated = this.getPlayers().length;
    if (patch.maxPlayers !== undefined && patch.maxPlayers < seated) {
      this.sendError(ws, `There are already ${seated} players in the room. Remove someone before lowering the limit.`);
      return;
    }

    const settings: RoomSettings = { ...this.settingsOf(row), ...patch };
    this.ctx.storage.sql.exec('UPDATE room SET settings = ? WHERE id = 1', JSON.stringify(settings));
    const freshRow = this.getRoomRow()!;
    this.broadcast({
      type: 'room',
      room: this.roomMetaFromRow(freshRow),
      players: this.lobbyPlayerList(freshRow),
    });
  }

  private handleAction(ws: WebSocket, action: GameAction, asPlayerId: string | undefined): void {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) {
      this.sendError(ws, 'join first');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }

    // Starting is the host's own act, never a dummy's, so it deliberately ignores
    // `asPlayerId` rather than routing a dummy into the host check.
    if (action.type === 'start_game') {
      this.handleStartGame(ws, playerId, row);
      return;
    }

    // Acting for someone else is allowed only for your own dummies, checked against the
    // table on every action — the client's claim is never cached or trusted.
    let actorId = playerId;
    if (asPlayerId !== undefined) {
      const target = this.getPlayerById(asPlayerId);
      if (!target || target.dummy_of !== playerId) {
        this.sendError(ws, 'not your player');
        return;
      }
      actorId = asPlayerId;
    }

    if (!row.started) {
      this.sendError(ws, 'game has not started');
      return;
    }
    const state = this.getState(row);
    if (!state) {
      this.sendError(ws, 'game state missing');
      return;
    }

    const map = getMap(state.mapId);
    const rng = createRng(row.rng_state);
    const pa: PlayerAction = { playerId: actorId, action };

    let result: ReturnType<typeof reduce>;
    try {
      result = reduce(map, state, pa, () => rng.next());
    } catch (err) {
      this.sendError(ws, err instanceof Error ? err.message : 'illegal action');
      return;
    }

    // The engine rejects by returning `error`, not by throwing. Without this the room
    // would persist the unchanged state and broadcast an empty event list, leaving the
    // sender with no feedback that their action was refused.
    if (result.error !== undefined) {
      this.sendError(ws, result.error);
      return;
    }

    this.writeStateAndRng(result.state, rng.state());
    this.broadcast({ type: 'events', events: result.events, version: result.state.version });
    this.broadcastState(result.state);
  }

  private handleStartGame(ws: WebSocket, playerId: string, row: RoomRow): void {
    if (row.host_id !== playerId) {
      this.sendError(ws, 'only the host can start the game');
      return;
    }
    if (row.started) {
      this.sendError(ws, 'game already started');
      return;
    }

    const settings = this.settingsOf(row);
    const map = getMap(settings.mapId);
    const players = this.getPlayers().map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const rng = createRng(row.rng_state);

    let state: GameState;
    try {
      state = createGame(map, players, settings, () => rng.next());
    } catch (err) {
      this.sendError(ws, err instanceof Error ? err.message : 'could not start game');
      return;
    }

    // `createGame` only seats the players — it leaves the game in LOBBY. The engine
    // requires a separate `start_game` reduction to randomize turn order and enter
    // AWAITING_ROLL. Persisting the raw `createGame` result would store a room that is
    // flagged started but whose every action is refused with "Not awaiting a roll".
    const started = reduce(map, state, { playerId, action: { type: 'start_game' } }, () => rng.next());
    if (started.error !== undefined) {
      this.sendError(ws, started.error);
      return;
    }
    state = started.state;

    this.ctx.storage.sql.exec(
      'UPDATE room SET started = 1, state = ?, rng_state = ? WHERE id = 1',
      JSON.stringify(state),
      rng.state(),
    );
    this.broadcastState(state);
  }

  /**
   * Seats an extra player the requester drives from their own tab — the developer aid
   * that replaces juggling browser tabs to test a multiplayer game. Host only and lobby
   * only, so the only rooms this can touch are ones the requester made themselves.
   *
   * The dummy is stored as an ordinary player with `dummy_of` set: the engine is never
   * told, so a dummy pays rent, goes to prison and goes bankrupt like anyone else. It is
   * seated `connected` because it has no socket of its own to come online — left offline
   * it would show a removal countdown and then be swept by the lobby alarm.
   */
  private handleAddDummy(ws: WebSocket): void {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) {
      this.sendError(ws, 'join first');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }
    if (row.host_id !== playerId) {
      this.sendError(ws, 'only the host can add players');
      return;
    }
    if (row.started) {
      this.sendError(ws, 'game already started');
      return;
    }
    const players = this.getPlayers();
    if (players.length >= this.settingsOf(row).maxPlayers) {
      this.sendError(ws, 'room is full');
      return;
    }

    const joinOrder = Math.max(-1, ...players.map((p) => p.join_order)) + 1;
    const taken = new Set(players.map((p) => p.color));
    const color = COLOR_PALETTE.find((c) => !taken.has(c)) ?? COLOR_PALETTE[joinOrder % COLOR_PALETTE.length]!;
    const usedNumbers = new Set(
      players.map((p) => Number(/^Bot (\d+)$/.exec(p.name)?.[1])).filter((n) => Number.isInteger(n)),
    );
    const names = players.map((p) => p.name);
    let number = 1;
    // A human may have joined as "bot 3"; skip past any number whose name is spoken for.
    while (usedNumbers.has(number) || isNameTaken(`Bot ${number}`, names)) number++;

    this.ctx.storage.sql.exec(
      `INSERT INTO players (id, token, name, color, join_order, connected, disconnected_at, dummy_of)
       VALUES (?, ?, ?, ?, ?, 1, NULL, ?)`,
      crypto.randomUUID(),
      crypto.randomUUID(),
      `Bot ${number}`,
      color,
      joinOrder,
      playerId,
    );
    this.broadcastRoomOrState(this.getRoomRow()!);
  }

  /** Drops a dummy the requester owns. Real players leave on their own (`handleLeave`). */
  private handleRemovePlayer(ws: WebSocket, targetId: string): void {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) {
      this.sendError(ws, 'join first');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }
    if (row.started) {
      this.sendError(ws, 'game already started');
      return;
    }
    const target = this.getPlayerById(targetId);
    if (!target || target.dummy_of !== playerId) {
      this.sendError(ws, 'not your player');
      return;
    }
    this.removePlayer(targetId);
    this.broadcastRoomOrState(this.getRoomRow()!);
  }

  /**
   * Leaving is a lobby-only action. Mid-game departure would have to decide what happens
   * to the leaver's cash, deeds and buildings — that is bankruptcy, which the game already
   * has an action for, so this refuses rather than inventing a second answer.
   */
  private handleLeave(ws: WebSocket): void {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) {
      this.sendError(ws, 'join first');
      return;
    }
    const row = this.getRoomRow();
    if (!row) {
      this.sendError(ws, 'room not found');
      return;
    }
    if (row.started) {
      this.sendError(ws, 'cannot leave a game in progress');
      return;
    }
    this.removePlayer(playerId);
    // Unbind rather than close: the socket stays usable, so the same tab can join again
    // as a fresh player without waiting out the reconnect backoff.
    ws.serializeAttachment(null);
    this.broadcastRoomOrState(this.getRoomRow()!);
  }

  /** Drops a player's seat and hands the room to the next-longest-seated player if they were host. */
  private removePlayer(playerId: string): void {
    // Dummies go with their owner. Left behind they would point at a deleted row: nobody
    // could drive them and nobody could remove them, yet they would still hold a seat and
    // count against `maxPlayers`. This matters most on the disconnect sweep, which removes
    // a player nobody asked to remove.
    this.ctx.storage.sql.exec('DELETE FROM players WHERE id = ? OR dummy_of = ?', playerId, playerId);
    const row = this.getRoomRow();
    if (!row || row.host_id !== playerId) return;
    const heir = this.getPlayers()[0] ?? null;
    this.ctx.storage.sql.exec('UPDATE room SET host_id = ? WHERE id = 1', heir ? heir.id : null);
  }

  /**
   * Sweeps lobby seats whose grace period has run out, then re-arms for the next one due.
   * Re-arming only while a disconnected pre-start player exists is what keeps an idle room
   * from waking itself forever.
   */
  async alarm(): Promise<void> {
    const row = this.getRoomRow();
    if (!row || row.started) return;
    const grace = this.graceMs();
    const cutoff = Date.now() - grace;
    const players = this.getPlayers();
    const stale = players.filter((p) => !p.connected && p.disconnected_at !== null && p.disconnected_at <= cutoff);
    for (const p of stale) this.removePlayer(p.id);

    const waiting = this.getPlayers().filter((p) => !p.connected && p.disconnected_at !== null);
    if (waiting.length > 0) {
      await this.ctx.storage.setAlarm(Math.min(...waiting.map((p) => p.disconnected_at!)) + grace);
    }
    if (stale.length > 0) this.broadcastRoomOrState(this.getRoomRow()!);
  }

  /**
   * A Durable Object has a single alarm slot, so a second disconnect must never push the
   * first player's deadline back — only ever move the alarm earlier.
   */
  private async armSweep(deadline: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > deadline) await this.ctx.storage.setAlarm(deadline);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const playerId = this.boundPlayerId(ws);
    if (!playerId) return;
    const row = this.getRoomRow();
    if (!row) return;
    // A reconnect closes the player's previous socket (`closeOtherSocketsFor`), and that
    // close lands here AFTER the new socket has already been marked online. Flipping
    // `connected` unconditionally would therefore report a live player as offline, so
    // only go offline when this player has no other socket still open.
    if (this.hasOtherOpenSocket(playerId, ws)) return;
    this.setPlayerConnected(playerId, false, row);
    if (!row.started) await this.armSweep(Date.now() + this.graceMs());
    const freshRow = this.getRoomRow()!;
    this.broadcastRoomOrState(freshRow);
  }

  private hasOtherOpenSocket(playerId: string, exclude: WebSocket): boolean {
    for (const other of this.ctx.getWebSockets()) {
      if (other === exclude) continue;
      if (other.readyState !== WebSocket.OPEN) continue;
      if (this.boundPlayerId(other) === playerId) return true;
    }
    return false;
  }

  // ── Storage helpers ──────────────────────────────────────────────────────

  private getRoomRow(): RoomRow | null {
    const rows = this.ctx.storage.sql.exec<RoomRow>('SELECT * FROM room WHERE id = 1').toArray();
    return rows[0] ?? null;
  }

  private getPlayers(): PlayerRow[] {
    return this.ctx.storage.sql
      .exec<PlayerRow>('SELECT * FROM players ORDER BY join_order ASC')
      .toArray();
  }

  private getPlayerById(id: string): PlayerRow | null {
    const rows = this.ctx.storage.sql
      .exec<PlayerRow>('SELECT * FROM players WHERE id = ?', id)
      .toArray();
    return rows[0] ?? null;
  }

  private getPlayerByToken(token: string): PlayerRow | null {
    const rows = this.ctx.storage.sql
      .exec<PlayerRow>('SELECT * FROM players WHERE token = ?', token)
      .toArray();
    return rows[0] ?? null;
  }

  private getState(row: RoomRow): GameState | null {
    if (!row.state) return null;
    type TradeFields = 'trades' | 'tradeSendCounts' | 'nextTradeId';
    const stored = JSON.parse(row.state) as Omit<GameState, TradeFields> & Partial<Pick<GameState, TradeFields>>;
    // `createGame` snapshots the settings into the state, so a game already in flight
    // when a new setting shipped carries the same missing-key hazard as the room row
    // (see `settingsOf`) — and here it would corrupt a live game, not a fresh one. Games
    // saved before trades shipped have no trade fields, so those default the same way.
    const state: GameState = {
      trades: [],
      tradeSendCounts: {},
      nextTradeId: 0,
      ...stored,
      settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    };
    return migrateDebtBalance(state);
  }

  /** Persists a new state without touching `rng_state` — use for connection-flag writes. */
  private writeState(state: GameState): void {
    this.ctx.storage.sql.exec('UPDATE room SET state = ? WHERE id = 1', JSON.stringify(state));
  }

  /** Persists a new state alongside the rng cursor that produced it — use after `reduce`/`createGame`. */
  private writeStateAndRng(state: GameState, rngState: number): void {
    this.ctx.storage.sql.exec(
      'UPDATE room SET state = ?, rng_state = ? WHERE id = 1',
      JSON.stringify(state),
      rngState,
    );
  }

  /** Updates connection status: the lobby roster pre-start, `GameState.players` after. */
  private setPlayerConnected(playerId: string, connected: boolean, row: RoomRow): void {
    this.ctx.storage.sql.exec(
      'UPDATE players SET connected = ?, disconnected_at = ? WHERE id = ?',
      connected ? 1 : 0,
      connected ? null : Date.now(),
      playerId,
    );
    if (row.started) {
      const state = this.getState(row);
      if (state) {
        const players = state.players.map((p) => (p.id === playerId ? { ...p, connected } : p));
        this.writeState({ ...state, players });
      }
    }
  }

  /**
   * Settings persist as one whole JSON blob, so a room row written before a setting
   * existed comes back missing that key. Reading it raw would hand the engine an
   * `undefined` number, and the first `cash + undefined` turns that player's balance
   * into NaN for the rest of the game. Defaults fill the gaps on every read; the blob
   * is only rewritten when the host actually edits settings.
   */
  private settingsOf(row: RoomRow): RoomSettings {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.settings) as Partial<RoomSettings>) };
  }

  private roomMetaFromRow(row: RoomRow): RoomMeta {
    return {
      code: row.code,
      hostId: row.host_id ?? '',
      settings: this.settingsOf(row),
      started: !!row.started,
    };
  }

  /** Placeholder `Player` records for the pre-game lobby roster (no `GameState` exists yet). */
  private lobbyPlayerList(row: RoomRow): Player[] {
    const settings = this.settingsOf(row);
    const startIndex = getMap(settings.mapId).startIndex;
    const grace = this.graceMs();
    return this.getPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      cash: settings.startingCash,
      tileIndex: startIndex,
      inJail: false,
      jailTurns: 0,
      pardonCards: 0,
      skipTurns: 0,
      bankrupt: false,
      connected: !!p.connected,
      ...(p.dummy_of ? { dummyOf: p.dummy_of } : {}),
      ...(p.connected || p.disconnected_at === null
        ? {}
        : { removeInMs: Math.max(0, p.disconnected_at + grace - Date.now()) }),
    }));
  }

  // ── Socket helpers ───────────────────────────────────────────────────────

  private bindSocket(ws: WebSocket, playerId: string): void {
    const attachment: SocketAttachment = { playerId };
    ws.serializeAttachment(attachment);
  }

  private boundPlayerId(ws: WebSocket): string | null {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    return attachment?.playerId ?? null;
  }

  /** A reconnect token maps to one live socket; close any other one already using it. */
  private closeOtherSocketsFor(playerId: string, keep: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== keep && this.boundPlayerId(ws) === playerId) {
        try {
          ws.close(4000, 'reconnected from another device');
        } catch {
          // Already closing; nothing to do.
        }
      }
    }
  }

  private sendJoined(ws: WebSocket, playerId: string, token: string, row: RoomRow): void {
    const msg: ServerMessage = { type: 'joined', playerId, token, room: this.roomMetaFromRow(row) };
    ws.send(JSON.stringify(msg));
  }

  private sendError(ws: WebSocket, message: string, code?: 'unknown_token'): void {
    const msg: ServerMessage = code ? { type: 'error', message, code } : { type: 'error', message };
    ws.send(JSON.stringify(msg));
  }

  /** Broadcasts the lobby roster pre-start, or a full state snapshot once the game is running. */
  private broadcastRoomOrState(row: RoomRow): void {
    if (!row.started) {
      this.broadcast({
        type: 'room',
        room: this.roomMetaFromRow(row),
        players: this.lobbyPlayerList(row),
      });
      return;
    }
    const state = this.getState(row);
    if (state) this.broadcastState(state);
  }

  /**
   * Every state broadcast carries who owns which dummy, because that is the only way a
   * client learns it once the game has started — a reconnecting host is sent a state
   * snapshot, never a lobby roster, and without this they would silently lose control of
   * their own dummies and the game would stall on a dummy's turn.
   *
   * Stamped on the way out only: what gets persisted stays exactly what the engine
   * produced.
   */
  private broadcastState(state: GameState): void {
    const owners = new Map(this.getPlayers().map((p) => [p.id, p.dummy_of]));
    const players = state.players.map((p) => {
      const owner = owners.get(p.id);
      return owner ? { ...p, dummyOf: owner } : p;
    });
    this.broadcast({ type: 'state', state: { ...state, players } });
  }

  /** Broadcasts via `ctx.getWebSockets()` — never a member array, which vanishes on eviction. */
  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket is closing/closed; webSocketClose will flip `connected` for it.
      }
    }
  }
}
