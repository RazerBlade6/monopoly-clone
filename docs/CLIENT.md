# Client — `src/client`

The browser app: React 18, built with Vite 5, animated with Framer Motion 11. It renders whatever
the server sends and sends back the player's actions. It never rolls dice, computes rent or decides
what is legal; it only presents the server's state, and the engine's `legalActions` decide which
buttons are enabled.

## Status

Complete for v1, with a full UI/UX pass and an animation pass done.

| Area | State |
|---|---|
| Home, lobby, share link, settings | Done |
| Board for 40- and 48-tile maps, flags, tile icons | Done |
| Turn buttons, property cards, building, selling, trades, bankruptcy | Done |
| Token and dice animation, played back in order | Done |
| UI animation (cash bubbles, log, purchase pulse, set glow, button pop, card open) | Done |
| Sound effects | Not started |
| Coherent art style | Not started |
| Mobile layout | Stacks below 900 px; not designed for phones |

## Architecture

```
main.tsx            mounts <App/>, imports fonts and styles.css
App.tsx             routes: dev previews (?dev=…), Home (/), RoomContainer (/<code>)
router.ts           a minimal pushState router
net.ts              useRoomConnection: one WebSocket per room, reconnects, stored identity
pages/
  Home.tsx          create a room; the developer panel
  RoomContainer.tsx Lobby until there is a game state, then Game
  Lobby.tsx         name entry, roster, settings (host), share link, start
  Game.tsx          the game shell: rails, board, modals; runs the playback queue
components/         Board, ActionBar, Sidebar, PlayerCard, PropertiesPanel, PropertyCard,
                    TradeModal, TradesPanel, EventLog, CashDelta, SettingsPanel, ShareLink, TileBadge…
playback.ts         the playback queue (see below)
motionTiming.ts     every animation duration in one place
ringLayout.ts       board geometry for any tile count
devSim.tsx          SimLab: the real engine in the page, every seat played from one tab
devMode.ts          the private developer switch
fixtures.ts         fixture states for the dev previews
styles.css          all styling, colour tokens on :root
assets/             flags and tile icons (see Art assets)
```

### Connection (`net.ts`)

One WebSocket per room, typed against `ClientMessage` / `ServerMessage`. The player's id and
reconnect token are stored in `localStorage` per room code, so a refresh rejoins the same seat. The
socket reconnects after a short delay; an `unknown_token` error drops the stored identity and falls
back to the join form, and a refused join is not replayed.

### Game screen

Left rail: share link and game settings. Middle: the board, with the dice, the turn's buttons and a
six-line log in its centre. Right rail: player cards (balance, owned-property dots, prison status),
trades, a bankruptcy button, and the selected player's properties. Clicking a property row or a board
tile opens its deed card, where the owner builds and sells. The trade modal builds offers with cash,
properties and pardon cards.

### The board

- `ringLayout(tileCount)` gives every tile a grid row/column and edge; the grid's tracks are in `fr`
  units with wider corners, so 40- and 48-tile boards share one layout.
- Tile content is sized in `cqmin` (each tile is a size container), so text and icons scale with the
  board instead of being tuned to one window size. `--tile-scale` scales the centre to the ring.
- Side tiles read along their own edge. A city carries its country's tint and a circular flag
  straddling its inner edge; other tiles carry an icon. Ownership is a thick bar in the owner's colour
  on the outer rim (30 cqmin); buildings show under the price.
- **The prison corner is split**, as on richup: a "Passing by" band and an "In Prison" cell. Prisoners
  stand in the cell behind a cage icon; visitors stand in the band.
- The centre holds the dice and turn buttons at a fixed position above a log box of fixed height, so
  nothing moves as the log fills or the buttons change. A drawn card covers the log for a few seconds.

### Playback queue (`playback.ts`)

The server sends an action's result all at once. Rendered directly, the final state would appear
while the dice were still in the air. `usePlayback(map, state, events)` instead plays each batch back
in order and exposes a *shown* state:

1. Each `state` message is paired with the events that arrived since the last one (found by object
   identity, since the log is capped at 300).
2. Events are stepped through: `rolled` sets the dice and waits for them to settle; `moved` glides the
   token and waits for it to land; `jailed` pauses, then jumps the token to prison; `card_drawn` shows
   the card; `paid` applies the cash change.
3. The batch ends by committing the authoritative state, snapping any token that ended elsewhere.

While a batch plays, `busy` holds the turn buttons (a disabled `<fieldset>`), so a player can't act
on a state they haven't seen yet. A hidden tab, or a queue more than two batches deep, skips straight
to the latest state.

### Motion

All durations live in `motionTiming.ts`. Everything respects `prefers-reduced-motion`.

| Element | Behaviour |
|---|---|
| Dice | 3D cubes tossed up and tumbled over 1.0 s (second die 70 ms behind), landing with a small bounce. At rest each cube snaps to its exact rest angle with only the showing face drawn |
| Token walk | One continuous glide along the ring, rounding corners, fast start and eased stop; duration `0.26 + 0.13·√tiles` s. The token grows with its speed (up to 1.4×) |
| Prison | The token shrinks away and pops up in the cell |
| Shared tiles | Tokens spread into crowd layouts (up to 8) and spring between spots |
| Current turn | The token blinks between 100% and 50% opacity |
| Cash change | A small `+$N` / `-$N` under the balance; gains float up into it, losses drop away (1.1 s) |
| Log | Older lines slide down (0.14 s), the new line fades in 0.1 s later |
| Purchase | The tile flashes its own hue, brightened (0.5 s); the owner's bar grows out from its middle |
| Completed country | Every tile in it glows with an outline and wash in the country colour (1.8 s) |
| Buttons | Swell on hover and squash on press with a springy curve, spring back on release |
| Property card | Grows out of the clicked row or tile (0.2 s) |

Timings were tuned by playtest. richup's measured motion is in `research/richup-motion-observed.md`.
Where we differ: our token walk is slower by choice (about 0.6 s for 7 tiles against richup's 0.22 s),
the walk starts after the dice settle instead of overlapping their flight, and our dice are flat-on
and smaller (about 9% of the board against 13%) with no shadows. richup's isometric dice are a
candidate for the art-style pass.

### Rendering pitfalls found so far

- **Token tracks must be clipped.** Each token rides on a wrapper the size of the whole board,
  translated by its x/y percentage. Unclipped, those wrappers count as scrollable overflow and the page
  grows by up to a board's size. `.board__tokens-layer` has `overflow: clip`.
- **Hairline seams under scale animation.** Chrome drew seams across the dice after a roll (six 3D
  faces at angles like 1080°, re-sorted when a nearby button redrew) and across flat-filled buttons
  while they scaled (solid middles drawn as separate pieces from their rounded ends). Fixes: dice
  settle to exact angles with one face drawn and don't scale in flight; buttons carry a faint gradient
  instead of a flat fill. Promoting layers with `will-change` did not help.
- **Measure layout size, not drawn size,** in anything that animates with a transform
  (`offsetWidth`, not `getBoundingClientRect`).

### Art assets

- **Flags:** 14 circular flags in `assets/flags/`, from HatScripts' `circle-flags` (MIT).
- **Icons:** 15 tile icons in `assets/icons/`, from SVG Repo under several licences (CC0, CC BY,
  CC BY-SA, MIT, Apache 2.0). Each file's source, author and licence is in that folder's `README.md`;
  four dark line icons are lightened by a CSS filter rather than edited.
- Attribution for both is in `public/THIRD_PARTY_NOTICES.txt`, linked from the home page. Any new
  asset needs a row in the folder README and the notices file.
- **Fonts** (via Fontsource, self-hosted): Comfortaa for titles, Nunito for the interface, Nunito Sans
  for tile text.
- Colours are tokens on `:root` in `styles.css`. Country colours are generated by spacing hues evenly
  around the wheel (`colors.ts`), so any subset of the 14 countries stays distinguishable.

## Developer tools

- **Developer switch:** Ctrl+Alt+D toggles it, stored per browser. It adds a developer panel to the
  lobby (seat dummy players you drive from your tab, start with one seat). It is obscurity, not
  security; the server checks dummy ownership on every action.
- **Previews without a server** (`?dev=…`):
  - `board&map=<id>` — the board for any map
  - `lobby`, `join` — the lobby as the host, or before entering a name
  - `game&turn=buy` — the game screen with fixture state (`turn` also takes `doubles`,
    `buy-doubles`, `end`, `jail`, `debt`)
  - `sim` — **SimLab**: the real engine running in the page, every seat played from this tab;
    `&auto=1` lets bots play
- In a dev build (`npx vite`), the home page has a panel to start a simulated game directly.
- Live reload: `npx vite` on port 5173, with `wrangler dev` on 8787 for the real server (Vite proxies
  `/api`). `wrangler dev` alone serves the last `npm run build:client`.

## Testing

Unit tests cover the logic that isn't React: `playback.test.ts` (walk paths and durations),
`ringLayout.test.ts` and `propertyOrder.test.ts`. Visual and motion changes are checked in the
SimLab, by headless Chrome over the DevTools protocol (screenshots and per-frame traces), and by eye.
Headless Chrome does not reproduce GPU compositing artifacts; those need a real browser.

## Future changes
