# Server — `src/server`

A Cloudflare Worker with one Durable Object per room. It runs the lobby, holds the authoritative
game state, applies every action through the engine, persists the result and broadcasts it. All game
rules live in `src/engine`; the server never inspects a `GameAction` beyond routing it to `reduce`.

## Status

Complete for v1 and deployed (`https://boardclone.parthkohale.workers.dev`). Rooms are created,
shared by link, joined, configured, started and played to the end; disconnected players reconnect
into their seat; rooms survive hibernation and eviction. There is no turn clock, no kicking of
disconnected players mid-game, and no spectating.

## Architecture

```
browser ──HTTP──▶ Worker (worker.ts) ──RPC / WebSocket──▶ Room Durable Object (room.ts)
                     │                                       ├─ SQLite: room row + players
                     └─ everything else → static assets       ├─ engine (via engine-adapter.ts)
                        (dist/client, SPA fallback)           └─ mulberry32 rng (rng.ts)
```

| File | Responsibility |
|---|---|
| `worker.ts` | Routes; room-code allocation and normalisation; falls through to `env.ASSETS` |
| `room.ts` | The `Room` Durable Object: lobby, joins and reconnects, settings, start, actions, persistence, broadcast, the lobby sweep alarm |
| `protocol.ts` | Parses and validates every incoming `ClientMessage`; name collision checks |
| `engine-adapter.ts` | Re-imposes the engine's pinned `createGame` / `reduce` signatures |
| `rng.ts` | Seeded PRNG whose internal state can be persisted and resumed |
| `env.ts` | Bindings: `ROOM`, `ASSETS`, optional `LOBBY_GRACE_MS` |

### Routes

| Route | Does |
|---|---|
| `POST /api/rooms` | Allocates a 6-character code (alphabet without O/0/I/1) and initialises its room; retries on collision |
| `GET /api/rooms/:code` | Room metadata (`RoomMeta`) or 404 |
| `GET /api/rooms/:code/ws` | WebSocket upgrade into the room |
| anything else | Static client from `dist/client`, with single-page-app fallback |

Codes are case-insensitive to type and normalised to uppercase. A malformed code is rejected
before it reaches the Durable Object namespace, since touching a stub runs the object's constructor
(a SQLite write).

### The room

- **Storage (SQLite).** One `room` row (code, host, settings JSON, started flag, rng seed, rng state,
  game state JSON) and a `players` table (id, reconnect token, name, colour, join order, connected,
  `disconnected_at`, `dummy_of`). Schema changes are additive `ALTER TABLE`s guarded by
  `PRAGMA table_info`, inside `blockConcurrencyWhile`; a throw there would leave the room unbootable.
- **Hibernation.** WebSockets are accepted as hibernatable; the socket's player id rides on its
  attachment, so a woken room knows who each socket belongs to.
- **Randomness.** The rng's internal word is persisted alongside every state it produced, so a cold
  room resumes the exact sequence without replaying the log. Seeds come from
  `crypto.getRandomValues`, never `Math.random`.
- **Reading old data.** Settings are merged over `DEFAULT_SETTINGS` on every read, both the room's
  and the game state's snapshot: a key missing from an older room would otherwise reach the engine as
  `undefined` and turn a balance into `NaN`. Games saved before trades get empty trade fields, and
  debts saved before negative balances are shifted once on read (`migrateDebtBalance`).

### Messages

Client → server: `join` (name, optional reconnect token), `leave`, `add_dummy`, `remove_player`,
`update_settings`, `action` (optionally `asPlayerId`). Server → client: `joined`, `room` (lobby
roster), `state`, `events`, `error`. Types are in [SHARED.md](SHARED.md).

**For every accepted action the server sends `events` first, then `state`.** The client's playback
queue relies on this order to pair a state with the events that produced it. A refused action
(`reduce` returned `error`) produces only an `error` to the sender; nothing is persisted or broadcast.

### Lobby lifecycle

- **Join.** Names are 1–24 characters and unique per room after trimming and case-folding. A join
  is refused once the room is full or started. The first player is the host. Each player gets a
  reconnect token, which the client keeps in `localStorage`.
- **Reconnect.** A join with a known token rebinds the seat and closes the player's older socket.
  An unknown token gets `error` with `code: 'unknown_token'`, so the client drops it rather than
  retrying forever. A player only goes offline when their *last* open socket closes, since a
  reconnect's old socket closes after the new one is live.
- **Grace sweep.** Before the game starts, a disconnected player keeps their seat for two minutes
  (`LOBBY_GRACE_MS` overrides it, e.g. `wrangler dev --var LOBBY_GRACE_MS:5000`). One alarm sweeps
  expired seats and re-arms only while someone is still waiting, so an idle room stops waking.
  The roster carries `removeInMs` so the client can count down. After the start nobody is removed.
- **Host.** Only the host changes settings (lobby only; `maxPlayers` can't drop below the seated
  count) and starts the game. If the host leaves, the next player by join order inherits it.
- **Dummies.** A developer aid: the host can seat extra players (`add_dummy`) and act for them with
  `asPlayerId`. Ownership is checked against the table on every action. Dummies are ordinary players
  to the engine, and leave with their owner.
- **Start.** `createGame` seats the players, then a `start_game` reduction randomises turn order and
  enters `AWAITING_ROLL`; both are persisted together.

### Treating the client as hostile

A public socket-interceptor cheat suite exists for richup, so the protocol assumes a hostile client:

- Every message is shape-checked; unknown message types and unknown keys are rejected. Ids and trade
  sizes are bounded, and settings patches are checked against a per-key whitelist of types.
- The acting player is always the one bound to the socket (or one of its own dummies). Nothing read
  off the wire is trusted as a player id.
- Dice, money, ownership and legality are decided only by the engine on the server.

## Development and deployment

- `npm run dev` runs `wrangler dev` on port 8787, serving the built client from `dist/client`.
  Run `npm run build:client` after client changes, or run `npx vite` (port 5173) alongside it for
  live reload; Vite proxies `/api` and the WebSocket to 8787.
- `wrangler.toml` routes every request through the Worker first (`run_worker_first = true`): the
  installed Wrangler 3 only accepts a boolean there, not route patterns.
- **Zero cost is a hard constraint.** Workers, Durable Objects with SQLite and static assets all fit
  Cloudflare's free tier; nothing may require a paid plan.
- `node scripts/smoke.mjs [base-url]` is an end-to-end check of the Worker → Durable Object → two
  WebSocket clients seam. It defaults to the **production** Worker; pass `http://localhost:8787` to
  test a local `wrangler dev`. Run it after every deploy.
- `protocol.test.ts` unit-tests message validation. Nothing else in `src/server` has unit tests, which
  is what the smoke script is for.

## Future changes
