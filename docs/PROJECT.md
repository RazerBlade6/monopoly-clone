# Project

Decisions and conventions that apply across the whole codebase. The per-part design docs
([CLIENT](CLIENT.md), [DATA](DATA.md), [ENGINE](ENGINE.md), [SERVER](SERVER.md),
[SHARED](SHARED.md)) cover each part in depth.

## Product decisions

Settled with the group on 2026-08-20; these override anything in `research/` that assumes otherwise.

1. **A richup.io-style online property-trading board game,** played in the browser with friends.
2. **Share-link rooms are the whole distribution model.** Create a room, send `/<code>`, friends join
   with a name. No accounts.
3. **No monetization.** No coins, store, paid maps or ads. richup's paywall is an observation, not a
   feature.
4. **All four maps ship, free, with identical rules,** including richup's three paid ones.
5. **Zero cost is a hard constraint.** Everything runs on free tiers with no card on file and nothing
   that can bill by surprise. This constrains the stack, not the features.
6. **v1 scope is the playable core:** rooms and share link, roll / move / buy / rent, houses and hotels,
   prison, trades, bankruptcy and win. Auctions, mortgages, double rent, the turn clock, bots and teams
   are v2. richup ships auctions, mortgages and double rent off by default too.

## Principles

- **Server-authoritative, client hostile.** All rules, dice and money are decided on the server by the
  engine. The client renders and requests; every message is validated. (A public cheat suite with a
  socket interceptor exists for richup.)
- **Pure, deterministic engine.** No I/O, clock or global randomness; a game replays from its seed and
  actions.
- **Boards are data.** Tile count, group sizes, corner positions and tile types all come from the map.
  Nothing assumes 40 tiles or groups of 3.
- **One contract.** `src/shared/types.ts` defines every name the parts exchange.
- **Animation is decoration.** What the board shows is always derived from the authoritative state; a
  player joining mid-game sees the current state with nothing to replay.

## IP

Mechanics are not protectable; the specific expression is. So:

- Never use the word "Monopoly" in any user-facing string, product name or domain.
- Never use Hasbro's property names, card wording or board artwork.
- Cards are written fresh from the *effects* of the official decks.

`research/richup-vs-monopoly-diff.md` §4 has the background. It is a factual summary, not legal advice,
and a lawyer should review before any public launch.

## Terminology

richup's vocabulary, used throughout the code and UI:

| Classic name | Here | In code |
|---|---|---|
| Property | City | `city`, grouped by `countryId` |
| Railroad | Airport | `airport` |
| Utility | Company | `company` |
| Chance / Community Chest | Surprise / Treasure | `bonus` with `bonusType` |
| Income / Luxury Tax | Earnings Tax / Premium Tax | `tax` / `premium-tax` |
| Go | START | corner `start` |
| Jail | Prison | corner `jail` |
| Free Parking | Vacation | corner `free_parking` |
| Go to Jail | Go to prison | corner `go_to_jail` |
| Get Out of Jail Free | Pardon card | `pardon` |

## Development

| Command | Does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | `wrangler dev`: the Worker and the built client on port 8787 |
| `npm run build:client` | Build the client into `dist/client` |
| `npx vite` | Client dev server with live reload on port 5173 (proxies `/api` to 8787) |
| `npm test` | Vitest, all suites |
| `npm run check` | TypeScript, no emit |
| `npm run smoke -- [url]` | End-to-end smoke test; defaults to production, pass `http://localhost:8787` for local |

Every change should leave `npm run check` clean and `npm test` passing.

### Git workflow

`dev` is the working branch. Each piece of work goes on a feature branch cut from `dev` and merges
back into `dev`; feature branches are deleted afterwards. `master` is only updated on request:
`origin` is a fork, its `master` is fast-forwarded to `dev`, and a pull request goes upstream from
there.

## History

| When | Milestone |
|---|---|
| 2026-08-20 | Research: richup observed live, four maps captured, rules and edge cases catalogued |
| 2026-08-21 | v1 built against the spec (engine, server, client); deployed |
| 2026-08-23 | Playtest round 1: nine issues fixed (prison fee ends turn, START bonus, Vacation pot and skip, reachable bankruptcy, log in the board centre, card text, dice and token animation) |
| 2026-10-13 | Trades, the negative-balance debt model and selling property to the bank; UI/UX overhaul (lobby overlay, fonts, tile layout, flags and icons, clickable tiles, turn buttons and dice in the board centre) |
| 2026-10-17 | Sprite animation (playback queue, glides, split prison corner) and UI animation |
