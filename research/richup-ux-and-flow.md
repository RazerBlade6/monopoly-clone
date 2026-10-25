# richup.io — UX, UI and Multiplayer Flow Research

**Researcher lane:** how the app *feels and behaves* (not the rules engine).
**Research date:** 2026-08-20. **Method:** live fetch of richup.io HTML + its production JavaScript
bundles, plus the official dev blog and web search. The parent session is separately opening the site
in a browser; anything below marked UNVERIFIED is a good candidate for that pass.

## How to read the sourcing

Most of the high-confidence detail here comes from reading richup.io's own shipped front-end bundles.
Those files are content-hash-named and **will 404 after the next deploy**, so each claim cites the file
*plus the literal string or identifier I matched*, so a human can re-find it in whatever the current
hash is (`view-source:https://richup.io/` → follow the `<script>`/modulepreload links).

Bundles fetched 2026-08-20 (Sentry release id `c727590f`):

| File | Size | What's in it |
|---|---|---|
| `https://richup.io/index.BAOd0zsy.js` | 1.16 MB | app shell, router, auth, room/lobby socket layer, game-settings schema |
| `https://richup.io/assets/Lobby-D0IgtVfX.js` | 82 KB | landing page |
| `https://richup.io/assets/room._roomId-Boj9rj7z.js` | 4 KB | `/room/:id` route shell + pre-game ad interstitial |
| `https://richup.io/assets/GamePageContent-DcbcEFrO.js` | 769 KB | **the entire game screen** |
| `https://richup.io/GamePageContent.BPaaiLsN.css` | 66 KB | game screen layout/CSS |
| `https://richup.io/manifest.webmanifest` | — | PWA manifest |

Three confidence tiers are used below:

- **[OBSERVED]** — a literal string, constant, or code path I read in the shipped bundle, or text on a
  fetched page. Treat as fact about the code, though a string's existence doesn't prove where on
  screen it renders.
- **[INFERRED]** — my reading of what the code does. Logic is sound but I did not watch it run.
- **[UNVERIFIED]** — I could not evidence it. Stated as an open question, never as fact.

---

## 1. Entry & room lifecycle

### Landing page

- The homepage headline is "Play Monopoly Alternative Online with friends for free", with three primary
  actions: **Play**, **All rooms**, and **Create a private game**, plus a Discord link.
  [OBSERVED — https://richup.io/ ; strings `"Play"`, `"All rooms"`, `"Create a private game"`,
  `"Enter Game"`, `"How to play"`, `"What's new"` in `Lobby-D0IgtVfX.js`]
- **Play** vs **All rooms** is the public matchmaking split: one presumably drops you into an available
  public room, the other lists them. The room-list item states are `joinable` / `full` / `in_progress`
  / `ended`, computed from player count vs `maxPlayers` and game phase.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `"joinable"`,`"full"`,`"in_progress"`,`"ended"`]
  Which button does which is [UNVERIFIED].
- Rooms live at `/room/{roomId}`. [OBSERVED — route id `"/room/$roomId"`, `index.BAOd0zsy.js`]
- The site itself tells users "Richup is better on desktop PCs and laptops".
  [OBSERVED — https://richup.io/]

### Account required?

**No.** Guest play is first-class; login is an upsell, not a gate.

- The PWA manifest describes it as "A free online multiplayer board game. Play with friends, strangers,
  or bots." [OBSERVED — https://richup.io/manifest.webmanifest]
- Login prompts are framed as optional benefits: "Why login?", "Sign in to collect coins and enhance
  your experience", and at game end "You earned a coin for this win" / "Log in to claim it".
  [OBSERVED — `index.BAOd0zsy.js`, `GamePageContent-DcbcEFrO.js`]
- A room setting `onlyUsers` ("Only logged-in users" / "Only allow logged-in users to join the game")
  lets a host require accounts. A guest hitting such a room sees "This room is exclusive for logged-in
  users" and a **Login to join** button; the host is blocked from starting with the message that some
  players are not logged in and must be kicked or told to sign in.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- Auth is OAuth-ish per-provider: the client builds `/api/auth/{provider}?origin=…`, and Google,
  Facebook, Apple and Discord identifiers all appear. "Choose a way to log in:" is the picker label.
  [OBSERVED — `index.BAOd0zsy.js`]

### Guest / nickname / appearance flow

- Joining emits `join-game` with a payload of `{ name, bot?, captchaToken? }` — so the nickname is
  typed at join time and the same call is reused to seat a bot.
  [OBSERVED — `index.BAOd0zsy.js`, near `"join-game"`]
- The join panel makes you pick a **player appearance** (token) from a palette before joining:
  "Select your player appearance:", "Choose an appearance from the palette.", **Join game**.
  Appearances are exclusive per room — "This appearance is already taken", and a race-condition
  toast: "Oops! another player has just joined the game with your selected appearance. Choose another
  one." Extra appearances are a store item ("Get more appearances", "Premium").
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `index.BAOd0zsy.js`]
- **Cloudflare Turnstile** captcha gates joining: "Verify below to join", plus the Turnstile script URL
  and `cf-turnstile` container. [OBSERVED — `GamePageContent-DcbcEFrO.js`, `index.BAOd0zsy.js`]
- Appearance can be changed later ("Change appearance", `update-player-appearance`).
  [OBSERVED]

### Private vs public

`isPrivate` is a room setting toggled in the lobby, and the copy spells out the tradeoff:

- Private: "Private rooms can be accessed using the room URL only" and, when applicable, "Private room.
  The host can remove players who run out of time."
- Going public is **one-way** and pops a confirm: "Making the room public permanently removes your
  ability to remove players who run out of time. Continue?" with a **Make public** button.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]

That is a notable design decision worth copying: host moderation power is the price of privacy.

### Shareable link

- Sharing is by **URL, not by short code** — the invite panel is "Invite friends" / "Share this game" /
  "Copy link to clipboard" → "Copied!", and the landing loading tip says "Share the link for your
  private room to friends so they can join".
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `index.BAOd0zsy.js`]
- The share dialog explicitly states the mid-game behavior: **"Everyone with the link will be able to
  join this game. If it has already started, they will join as spectators."**
  [OBSERVED — `GamePageContent-DcbcEFrO.js`] This is the clearest single answer on joining mid-game.
- Friend-invite is a separate in-app channel: "Invite" / "Invited" / "Invite sent", an `invite-nudge`,
  online/offline friend lists, push notifications ("Invited you to join room …", "Let friends invite you
  to their game even if you're offline", `/push/subscribe`, `/push/reachable-friends`).
  [OBSERVED — `index.BAOd0zsy.js`, `Lobby-D0IgtVfX.js`, `GamePageContent-DcbcEFrO.js`]

### Lobby screen

The lobby is the same page as the game (phase `"lobby"` vs `"playing"` vs `"ended"`), with a
**Game settings** panel replacing the board-side controls. [OBSERVED]

Settings, with their exact defaults from the shipped defaults object
[OBSERVED — `index.BAOd0zsy.js`, the object containing `startingCash:1500`]:

| Setting | Default | UI label / description |
|---|---|---|
| `maxPlayers` | `4` | "Maximum players" / "How many players can join the game" |
| `canBotsJoin` | `true` | "Allow bots to join" (**Beta** badge) / "Bots will join the game based on availability" |
| `isPrivate` | `false` | "Private room" |
| `onlyUsers` | `false` | "Only logged-in users" |
| `startingCash` | `1500` | dropdown, options `$500 / $1000 / $1500 / $2000 / $2500 / $3000` |
| `shufflePlayerOrder` | `true` | "Randomize player order" / "Randomly reorder players at the beginning of the game" |
| `auction` | `false` | under "Gameplay rules" |
| `mortgage` | `false` | under "Gameplay rules" |
| `evenBuild` | `true` | under "Gameplay rules" |
| `payDoubleRentWhenOwnFullSet` | `false` | under "Gameplay rules" |
| `noRentPaymentsWhileInPrison` | `false` | "Don't collect rent while in prison" |
| `vacationCash` | `false` | under "Gameplay rules" |
| `teams` | `{enabled:false}` | "Teams" (**Beta**) / "Partner with other players" |
| `mapId` | `classic` | "Board map" / "Browse maps" / "Change map tiles, properties and stacks" |

Worth flagging for a clone: **auctions and mortgages are OFF by default** on richup.

- Player-count options are `[2,3,4,5,6]` for everyone; `[7,8]` are unlocked by a **paid store upgrade**
  — picking "More options…" opens `/store/upgrades` with "To play with more than N players, get the
  upgrade from the Store." So free room capacity is **6**, paid is **8**.
  [OBSERVED — `index.BAOd0zsy.js` (arrays `[2,3,4,5,6]` and `[7,8]`), `GamePageContent-DcbcEFrO.js`]
- Board maps shipped: `classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`.
  [OBSERVED — `index.BAOd0zsy.js`, map-id → slug table]
- Only the host edits settings: "Only the room host can change settings", "Settings cannot be changed
  after starting the game", "To change settings, first join the game", "View room settings", and a
  "Updating settings…" spinner while `update-game-room` round-trips. Non-hosts see "Waiting for
  host…" / "Waiting for players…" / "Waiting for {player} to start the game…".
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]

### Ready-up and who can start

- **There is no ready-up step.** The host presses **Start Game**; the button is disabled with an
  explanatory tooltip when it can't be used: "You must have at least two players for the game to
  start", "There are more players than you limited in the game settings. Kick some of them.", the
  not-logged-in message, and (teams) "At least two teams must have players. Move someone onto the
  empty team." [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- There is a **"Force Start Game"** variant shown to someone who is *not* the host. The gate is
  explicit: the component checks whether the current user's account `type === "admin"`. So it is a
  staff power, not a player-facing one, and it sits alongside `admin:kick-participant` and
  "Admin mode". [OBSERVED — `GamePageContent-DcbcEFrO.js`, the `"Waiting for … to start the game…"`
  component]
- Minimum 2 players, maximum 6 (8 with upgrade). [OBSERVED]

### Spectators

- Spectating is explicit: a **Spectate game** button on the join panel, and "The room is full."
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- Anyone arriving via the link after start becomes a spectator (see share-dialog copy above).
  [OBSERVED]
- Players removed for timeout are offered **"Keep watching"** vs **"Back to home"** — i.e. a kicked
  player is demoted to spectator rather than ejected. [OBSERVED]
- What spectators can/can't do (chat? see hidden info?) is [UNVERIFIED].

### Room lifecycle edges

`room-not-found` ("We couldn't find room …", "Room not found"), `room-deleted` ("This room was expired
or deleted."), and a deploy-drain path: "Richup is getting an update 🎉" / "The update is rolling out.
This room will be deleted in the next few minutes." / "All games will be shut down in {timer}".
[OBSERVED — `index.BAOd0zsy.js`, `GamePageContent-DcbcEFrO.js`]

There is also an **ad interstitial between the room link and the game**: "loading advertisement, hold
on" / "You will be taken to the game room after the advertisement ends."
[OBSERVED — `room._roomId-Boj9rj7z.js`]

---

## 2. The game screen layout

### Board rendering: 2D, top-down, plain DOM/CSS — not canvas, not 3D

This is the single most useful structural finding for a clone. The board is a **CSS Grid of DOM
elements**, laid out as a literal ring:

```
grid-template-areas: "start    top     prison"
                     "left     center  right"
                     "gotoprison bottom sleep"
```

[OBSERVED — `GamePageContent.BPaaiLsN.css`] The four corners are named `start`, `prison`,
`gotoprison`, `sleep` (vacation/free-parking equivalent), the four sides are `top`/`left`/`right`/
`bottom` strips, and `center` is the middle panel. There is no `<canvas>` board and no
`perspective`/3D transform in the game CSS. Icons are Font Awesome SVG; animation is Framer Motion
(`AnimationStart`, `LayoutMeasure`, `_dragX`, `data-motion-pop-id`) and react-spring-style value
interpolation. [OBSERVED — `GamePageContent-DcbcEFrO.js`]

The board scales rather than reflows: there is a scale/zoom controller with `shouldScale`,
`toggleScale`, `canResize`, and a `boardRef`. [OBSERVED]

Corner/tile types in the model: `corner` (with `cornerType` of `prison` / `vacation` / `go-to-prison`),
`airport`, `company`, and properties with a `level` (`ONE_HOUSE` … `FOUR_HOUSES`, `HOTEL`).
[OBSERVED — `index.BAOd0zsy.js`]

### Panels

- **Players list** with cash: `player-money`, `PlayerUserDisplay`, and the tip "Click any player in the
  players list to highlight them on the board". [OBSERVED] Each row composes: name (linking to a
  profile for logged-in users), then conditional badges — **a bot badge when `isBot`**, a
  guest/not-logged-in badge on your own row when you have no `userId`, and a **connectivity indicator
  carrying its own `connectivityKickAt` countdown**. Row actions (report / votekick) are rendered only
  when the phase isn't `lobby`, the row isn't you, **and the row isn't a bot**.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, the row component around `t.isBot&&`]
- **Property lists / ownership**: properties carry `ownerId`, `level`, and `isMortgaged`
  (serialized compactly as `owner` / `level` / `im`). Board and cards show "Owned", "Sold", "Free".
  Clicking a tile is the primary interaction: "Click on a property to see its price and rent
  payments." (loading tip) and, on your own, "Click on a property to upgrade, downgrade or sell it."
  (a dismissible `property-click-hint`). [OBSERVED]
- **Dice area**: `roll-dice` / `roll-dices` / `dice-rolled` / `double-roll-dice`, with a `dice` sound
  and a `/dice` asset path. [OBSERVED]
- **Action log / feed**: a scrolling log component driven by typed entries — `player-joined`,
  `player-left`, `update-settings`, `update-player-appearance`, `roll-dice`, `start-game`, `end-turn`,
  `purchase-property`, `upgrade-city`, `downgrade-city`, `pay-out-of-prison`, `use-pardon-card`,
  `sell-property`, `end-game`, plus removal entries typed `timeout` / `kick` / `votekick` /
  `host-kick` / `player-bankrupt`. That list is effectively a spec for the feed.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- **Chat**: a real chat panel with typing indicators, per-player mute, minimize, and blocked-message
  hiding. It keeps only the **last 75 messages** client-side. Incoming messages play `chatIn` and
  **vibrate the device 200 ms**; your own play `chatOut`. Channels are global, `team` (Teams mode
  "Team whisper"), and `admin`. [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- **Presence line** — a nice touch worth stealing: instead of only "is typing…", richup shows what a
  player is *doing*: "is playing…", "is typing…", "is creating a trade…", "is looking at a trade…",
  "is negotiating a trade…". [OBSERVED]
- **Emotes/reactions**: an "Emoji" control exists in chat; team identity uses emoji (🦁 🐯 🐻 … a
  ~60-emoji table). A *board* emote/reaction system separate from chat is [UNVERIFIED].

### Responsive / mobile

- Two named breakpoints drive layout: `single-column-media-query` at **max-width 85.25rem (≈1364px)**
  and a second at **max-width 600px**; the CSS also uses 920px, 800px, 690px(69.25rem) and 480px
  breakpoints. An `isMobile` flag feeds the chat context.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `GamePageContent.BPaaiLsN.css`]
- The main game shell is a three-area grid (`left` / `center` / `right`, where `center` is the board),
  and it **reflows in four stages** [OBSERVED — `GamePageContent.BPaaiLsN.css`, the rule carrying
  `grid-template-areas:"left center right"` and its media overrides]:

  | Viewport | `grid-template-areas` | Effect |
  |---|---|---|
  | wide (default) | `"left center right"` | three columns side by side |
  | ≤ 85.25rem (~1364px) | `"center right"` / `"left right"` | right rail goes full-height; board on top-left, left panel beneath it. Adds 6.5rem bottom padding (room for a fixed bottom bar) |
  | ≤ 69.25rem (~1108px) | `"center center"` / `"left right"` | board spans the full width on top; left and right split 50/50 below |
  | ≤ 600px | `"left"` / `"center"` / `"right"` | **single column**, stacked left → center → right |

- On wide screens only, the board area is `position: sticky` (top/bottom 1rem) so it stays put while
  the side panels scroll. [OBSERVED — the `@media not screen and (max-width:85.25rem)` +
  `@supports (position: sticky)` rule]
- Both the site and a loading tip nudge users off mobile: "Richup is better on desktop PCs and
  laptops", "Richup is better on larger screens". [OBSERVED]
- It is an installable PWA (`display: standalone`, dark theme `#130f1d`), with iOS install coaching
  ("On iPhone? Here's how", "Choose 'Add to Home Screen'") and push-notification opt-in
  ("Open Richup from your home screen, then turn on notifications").
  [OBSERVED — manifest + `GamePageContent-DcbcEFrO.js`]

---

## 3. Turn flow UX

### What the active player sees

A single primary action button that changes label by state
[OBSERVED — all four strings adjacent in `GamePageContent-DcbcEFrO.js`]:

1. **"Roll the dice"** → after doubles, **"Roll again"** (a `Doubles` stat is tracked, and the
   state carries `doublesInARow` and `cubesRolledInTurn`).
2. On an unowned tile: **"Buy for ${price}"** (`buy-property` / `purchase-property`), with the failure
   toast "You don't have enough money to pay for it." (`onPurchaseFailed`).
3. **"End turn"** (`end-turn` → `turn-ended`).

Guard rail: you cannot end a turn in debt — **"You can't end your turn with a negative amount of
money. Sell properties or trade with other players."** [OBSERVED]

In prison the action set becomes **"get free for $N"** (`pay-out-of-prison` → `paid-out-of-prison`)
and **"Use Pardon card"** (`use-pardon-card` → `used-pardon-card`), with the explainer "While in
prison, you can use a Pardon card to get out of prison immediately, and for free." [OBSERVED]

There is a nudge event `plz-roll-dices` — presumably the "someone is waiting on you" prompt.
[OBSERVED for the event name; its UI is INFERRED]

### Animation and feel

- Roll and move animations are Framer Motion/DOM based, with a `dice` sound on roll and a `yourTurn`
  sound when it becomes your turn. [OBSERVED — sound keys `dice`, `yourTurn`]
- The exact token-movement animation (hop per tile vs tween along the path) is [UNVERIFIED].
- `prefers-reduced-motion: reduce` is respected — the code swaps in zero-duration transitions.
  [OBSERVED — `GamePageContent-DcbcEFrO.js` and CSS]
- Keyboard: **Ctrl re-centres the view on your token** — "On the computer, click CTRL anytime to find
  yourself on the board". [OBSERVED — loading tip, `index.BAOd0zsy.js`]

### Non-active players

They are not idle spectators: during someone else's turn they can chat, open trades (see §5), manage
their own properties, mute/report, votekick, and **grant the active player extra time** (§7). The
presence strings above are designed so everyone can see who is mid-trade. [OBSERVED/INFERRED]

### Auto-actions

If the clock expires, the server plays for you — it rolls and ends your turn, but deliberately will not
bid in auctions or mortgage on your behalf. [OBSERVED — https://blog.richup.io/richup-v1-17-the-turn-clock/]

---

## 4. Auction UI

This one I can describe almost exactly, because the auction component is small and readable.
[all OBSERVED — `GamePageContent-DcbcEFrO.js`, around the `"start-auction"` / `"place-bid"` handlers]

- Auctions only exist if the host enabled the `auction` rule (**off by default**).
- It renders as a **modal titled "Auction" with no close button** — it is blocking, and it is open
  whenever auction state is `running` and the game phase is `playing`.
- Contents, top to bottom:
  1. The property card being auctioned.
  2. **"Current bid"** — the amount, animated, next to the current bidder's token/appearance, with a
     floating bubble showing the delta when it changes.
  3. A **countdown progress bar** tinted with the leading bidder's colour. The label reads
     **"Sold in {n}…"** when there is a bidder and **"Ends in {n}…"** when there isn't — a nice
     going-once affordance.
  4. **"I'm bidding…"** — a row of fixed-increment quick-bid buttons. Each button shows the resulting
     total (`$N`) on top and the increment (`+$X`) underneath. There is no free-text bid field.
  5. A live auction log: "{player} bids $N".
- **Timer:** the initial window is **10 seconds** (`endsAt = now + 10s` on `start-auction`). Every
  `place-bid` carries a **new `endsAt` from the server**, so the clock resets on each bid.
- **Who can bid:** every active player. A bid button is disabled when `myMoney < targetAmount`, or when
  **you are already the highest bidder** — you cannot bid against yourself.
- **Minimum increment:** the ladder of increments is a constant array imported from the shared app
  bundle. I tried to resolve it through the minified export-alias table and the lookup came back
  inconsistent, so I am not going to guess. **[UNVERIFIED — the increment amounts]** This is the
  cheapest thing to read off a live auction screen.
- **No bids:** the auction simply ends (`end-auction`) when `endsAt` passes; state goes to `"ended"`.
  Whether the property stays with the bank or is re-offered is [UNVERIFIED] (it is a server rule).
- **The active player can start an auction deliberately.** The turn action bar builds its buttons
  conditionally, and when the current tile is an unowned property, an **"Auction"** button
  (`startAuction`) is offered *instead of* the buy button under one branch of the condition — i.e.
  declining to buy routes the tile to auction. Auctions can also be `serverInitiated`.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, the turn-action builder that pushes an `"auction"` key]
- Auction state on the wire: `{ state, currentBidderId, currentBid, blockIndex, endsAt, bidderIds }`.
  [OBSERVED]

---

## 5. Trade UI

Evidence here is thinner than for auctions — the trade panel's visible text is mostly dynamic, so I
have the protocol but not the pixel layout.

**Protocol [OBSERVED]** — client → server: `propose-trade`, `accept-trade`, `reject-trade`,
`cancel-trade`, `set-trade-creator-state`, `set-trade-watch-state`. Server → client:
`onTradeCreated`, `onTradeConfirmed`, `onTradeDeclined`, `onTradeDeleted`, `onTradeCreatorChanged`,
`onTradeWatchStateChanged`. The lobby-level socket mirrors these as `trade-create`, `trade-confirm`,
`trade-decline`, `trade-delete`, `trade-negotiate`.

What this implies:

- **Trades are objects with an id that live in shared game state** (`state.trades` is an array kept in
  the synced snapshot), not ephemeral request/response. [OBSERVED]
- **Counter-offers are modelled as the trade changing hands**, via `trade-negotiate` /
  `onTradeCreatorChanged` and client state `negotiatedTrade` / `negotiatedTradeId`. The recipient
  edits the same trade and becomes its creator rather than spawning a new offer. [INFERRED — strong,
  but worth eyeballing]
- **Trades are visible to other players**, at least as activity: `set-trade-watch-state` plus the
  presence strings "is creating a trade…", "is looking at a trade…", "is negotiating a trade…" mean
  the room is told when someone opens or watches a trade. Whether non-participants can see the *terms*
  is [UNVERIFIED].
- **Trading is not turn-gated** — nothing in the trade path checks whose turn it is, and the debt
  message actively directs you to trade on your own turn ("Sell properties or trade with other
  players"). [INFERRED]
- Contents of an offer: cash, properties, and pardon cards. The bankruptcy copy confirms those three
  are the transferable asset classes ("Your cash, properties, and pardon cards will transfer…").
  [OBSERVED]
- The trade builder's actual layout (two columns? drag-and-drop? a cash slider?) is **[UNVERIFIED]**.
  Note that the bundle does ship a generic `Slider` chunk and dnd-kit drag-and-drop (used at minimum
  for dragging players onto teams — "Drop here to create a team"), so either mechanism is plausible.
- A `tradesCount` appears in end-of-game statistics. [OBSERVED]

---

## 6. Manage-property UI

- The controls are **on the tile itself**, not in a separate inventory screen. The in-game hint is
  literally "Click on a property to upgrade, downgrade or sell it." [OBSERVED]
- Actions: `upgrade-city` (build), `downgrade-city` (sell a house back), `sell-property`,
  `mortgage-property` / `unmortgage-property` (server confirms via `onPropertyMortgaged` /
  `onPropertyMortgageLifted` / `onPropertySold` / `onCityLevelChange`). "Manage" is a control label.
  [OBSERVED]
- Vocabulary note for a clone: richup calls building levels **"cities"** internally, and
  build/sell are framed as *upgrade/downgrade*, which reads better than Monopoly's houses/hotels
  language. Display levels are still `ONE_HOUSE`…`FOUR_HOUSES`, `HOTEL`. [OBSERVED]
- **Mortgaging is off by default** (`mortgage: false`) and is a host-enabled rule, so in a default game
  the only liquidity options are selling buildings and trading. [OBSERVED]
- `evenBuild` (even-build rule) is **on** by default. [OBSERVED]
- Availability windows (can you build on another player's turn? only your own?) are [UNVERIFIED].

---

## 7. Turn timers, idle, disconnect, reconnect

This is richup's most recently reworked area — the **Turn Clock**, shipped 15 Aug 2026 in v1.17.
[https://blog.richup.io/richup-v1-17-the-turn-clock/]

### The clock model

Per the dev blog, in the author's words: every turn has time on it; you get free thinking time at the
start of a turn, and when you need more you dip into a **personal reserve**. The reserve refills each
turn you complete, so at normal pace it stays full and you never see the clock at all.

The client implementation matches exactly [OBSERVED — `GamePageContent-DcbcEFrO.js`]:

- Clock state is `{ reserveStartsAt, expiresAt }` plus a per-grant `grantMs`; the player record also
  tracks `turnsTaken` and `lastGrantTurnFrom`.
- Phases, in order: **`hidden` → `grace` → `reserve` → `danger` → `expired`**.
  `danger` begins when remaining time drops below `min(10 s, 25% of the window)`.
- The clock **hides itself until it matters** — the pill only appears partway into the window (at half
  the free-time mark normally, immediately if your connection is flagged `unstable`). Great feel
  detail: no timer pressure on players who are keeping pace.
- The UI is a small **pill** (`data-testid="turn-clock-pill"`, `data-phase=…`) with an SVG progress
  ring and a countdown (`turn-clock-time`), which pulses in the danger phase
  (`pill-danger-pulse`).
- **Exact durations of free time and reserve are [UNVERIFIED]** — the blog post deliberately doesn't
  give numbers and they are set server-side. A clone builder must measure these in a live game.

### Asking for and granting time

- The player under pressure gets **"Ask for more time"** (`request-clock-time` → `clock-time-request`),
  then shows **"Waiting for a grant…"**. A 15-second constant sits immediately beside these two
  strings alongside `setTimeout`/`clearTimeout` handling; whether it is a request cooldown or simply
  how long the waiting state stays on screen is **[UNVERIFIED]**. [OBSERVED — the constant and its
  adjacency]
- Everyone else sees a button **"Grant +{time}"** with tooltip **"Give this player extra time"**
  (`grant-clock-time` → `clock-time-granted`); the blog says anyone at the table can hand over an extra
  minute with one click. Granted time animates in as `+N` bubbles on the pill, with a `moreTime` sound.
  [OBSERVED + blog]

### When time runs out

- The server **auto-plays**: it rolls and ends the turn for you. It will *not* bid in auctions or
  mortgage on your behalf. **Two consecutive auto-played turns and you are removed, with your
  properties returned to the bank.** [OBSERVED — blog post]
- The removed player gets a full-screen card: **"Your time ran out"** — "You were removed to keep the
  game moving. You can head back or stay and watch how it ends." — plus **"Leaving or timing out costs
  1 karma."** and two buttons, **Keep watching** / **Back to home**.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- A second variant, **"You lost your seat"** — "Your seat was removed while you were away…" — covers
  the case where you were absent (`seat-gone`). [OBSERVED]
- Karma is a real reputation currency: leaving or timing out costs 1 karma, and being removed by the
  host after your time ran out is explicitly free ("The host removed you after your time ran out. It
  costs no karma."). [OBSERVED — `index.BAOd0zsy.js`, `GamePageContent-DcbcEFrO.js`]

### Vote-kick and host-kick

- **Votekick** (`votekick-player` → `new-votekick-request` → `player-votekicked`): UI shows
  "Votekick (n)", "Final votekick", "Your vote is the last one required to kick", "You already voted to
  remove this player", "No one to votekick right now", and in Teams mode "Also needs a vote from one of
  their teammates". [OBSERVED]
- Vote state is shared: the store holds a `votekickerIds` list (hence the "Votekick (n)" counter), and
  a predicate decides whether *your* click is the deciding vote — if so you get the "Final votekick"
  confirm instead of an instant vote. [OBSERVED — `GamePageContent-DcbcEFrO.js`]
- **Threshold: [UNVERIFIED].** `index.BAOd0zsy.js` does contain a helper computing
  `ceil((nonBotParticipants + 1) / 2)` immediately beside the non-bot counter, which would be a
  majority-of-humans rule — but I could not trace it to the votekick UI, so treat it as a lead, not a
  fact.
- Teams adds an approval gate: a vote can require sign-off from one of the target's teammates
  ("Also needs a vote from one of their teammates"), and when that is structurally impossible the UI
  says so outright — **"Only the inactivity timer can kick this player"**. [OBSERVED]
- The v1.17 rules change: **a player can only be removed once their time has actually run out**, and
  "winning is no longer a reason to get kicked." [OBSERVED — blog post] This is an anti-griefing fix
  worth copying.
- **Host kick** (`host-kick-player` → `player-host-kicked`) exists in **private rooms only** and is
  advertised as such in the privacy toggle copy. Confirm dialog: "Are you sure you want to kick …",
  "Kick player" / "Remove player" / "Remove (timed out)". The kicked player sees "You got kicked out of
  the game." [OBSERVED]
- There is also a countdown warning tied to `timedVotekickAt`: "You'll be kicked out in {timer} if you
  don't end your turn" (and the third-person variant for onlookers). [OBSERVED]
- Separately, an **admin** channel exists (`admin:kick-participant`, "Richup.io Admin", "Admin mode").
  [OBSERVED]

### Disconnect / reconnect

- Transport is **socket.io** with reconnection (`reconnect_attempt`, `reconnect_error`,
  `reconnect_failed`), plus a `/keepalive` endpoint. [OBSERVED]
- Connectivity is a **first-class, broadcast player attribute**: `update-player-connectivity` /
  `participant-connectivity-changed`, with an `"unstable"` state that other players can see and that
  makes the clock pill appear earlier for that player. There's also "the player is not connected to the
  game". [OBSERVED]
- The disconnected player sees **"Connection lost"** → **"Connection lost. reconnecting…"** with
  "Make sure your internet connection is stable." and a countdown: **"You will be automatically kicked
  out of the game in {timer}"**. [OBSERVED]
- **Rejoining works**: state recovery is `request-sync` → `sync-game-state` (plus
  `request-server-time` for clock alignment) and there's an `initialization-pending` / `join-window`
  concept. The timed-out overlay's "head back" wording also implies re-entry.
  [OBSERVED for the sync events; whether you get your *seat* back vs spectate is INFERRED — the
  overlay copy suggests a lost seat is not returned]
- **Host migration: [UNVERIFIED].** `hostId` exists in state and a host-derivation helper reads it,
  but I found no explicit reassignment-on-leave path in the client (it would be server-side anyway).

---

## 8. Bots

- Bots are a **room setting, not a manual add**: "Allow bots to join" (marked **Beta**) with the
  description **"Bots will join the game based on availability"** — i.e. the server decides when to
  seat them, presumably to fill a waiting public room. Default is **on** (`canBotsJoin: true`).
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `index.BAOd0zsy.js`]
- The `join-game` payload has an optional `bot` field, so bots are seated through the same join path
  as humans. [OBSERVED]
- Participants carry an `isBot` flag, and bots are **excluded from the votekick denominator**.
  [OBSERVED / INFERRED]
- **Bots are visibly badged** in the player list (a dedicated badge component renders when `isBot`),
  they are **not reportable** (the report/votekick row actions are suppressed for bots), and removing a
  bot **skips the "Are you sure?" confirm** that a human removal requires.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`] The badge's exact glyph/wording is [UNVERIFIED].
- Marketing positions them as practice: "Ramp up your skills by practicing with bots" (loading tip),
  and the PWA description offers "friends, strangers, or bots". [OBSERVED]
- **[UNVERIFIED]:** what names/appearances bots get, their difficulty, whether a bot replaces a player who drops (the v1.17 timeout flow suggests
  **no** — timed-out players are removed and their properties go back to the bank, rather than being
  bot-substituted), and whether a host can add a specific number of bots on demand.

---

## 9. End of game

### Bankruptcy

- Self-declared bankruptcy is a deliberate, confirmed action: **"Bankrupt"** / **"File your
  bankruptcy"** → confirm dialog "Are you sure you want to bankrupt?", "You will lose all your money
  and purchased properties!", "This cannot be undone." (`do-bankrupt` / `submitBankrupt` →
  `player-bankrupted`). [OBSERVED]
- The dialog explains estate handling, and Teams mode changes it: "Your estate will be liquidated to
  pay your debt. Any remaining cash goes to your teammates. Unsold properties return to the bank." /
  "Your cash, properties, and pardon cards will transfer to your teammates." [OBSERVED]

### Winner screen

- A dramatic reveal: **"Game over!"** then **"and the winner is…"** (or "and the winning team is…"),
  with the winner's token; a confetti module is lazily loaded for this screen
  (`confetti.module-…js`), and `gameOverWin` / `gameOverLose` sounds play.
  [OBSERVED — `GamePageContent-DcbcEFrO.js`, `room._roomId-…js`]
- Logged-in winners get a coin: **"You earned a coin for this win"**, guests see **"Log in to claim
  it"** (`winner-coin-claim`, `/game/claim-coin-reward`). [OBSERVED]
- Share row with prewritten text for Facebook / Twitter / WhatsApp: "I just won first place in
  Richup.io. Can you beat that?" and, for non-winners, "I just finished a game in Richup.io. For how
  long can you survive?" [OBSERVED]

### Rematch

- **"Another game"** restarts the same room (`restartRoom` → `room-restart`) and is **host-only** —
  everyone else sees "Waiting for host…". [OBSERVED]

### Post-game stats

- A **Game statistics** panel with "View all statistics", a **Leaderboard**, and a **"Net worth over
  time"** line chart lazily loaded as its own chunk (`NetWorthsChart-…js`, with a "Net worth chart
  failed to load" fallback and a "Chart view" toggle). "Back to board" returns you to the board.
  [OBSERVED]
- Tracked stats seen in the summary: **Duration**, **Turns**, **Doubles**, trades count, and a
  "Most times in prison" superlative. The synced state also carries an `instrumentation` block with
  `trades`, `creditorRecoveries`, `auctions`, and clock counters `expiredTurns`,
  `expiredTurnsAfterSelfAction`, `expiredTurnsWhileOffline`. [OBSERVED]
- Per-user history exists outside the game (`/user/{id}/last-games`, `/user/{id}/profile`, "Game
  statistics", karma points). [OBSERVED]

---

## 10. Sound, animation, polish

- **Sound effect set is small and deliberate** — exactly eight keys: `dice`, `yourTurn`, `bid`,
  `chatIn`, `chatOut`, `moreTime`, `gameOverWin`, `gameOverLose`. A loading tip asks users to "Play
  with sound on for the best experience". [OBSERVED]
- **Haptics**: incoming chat vibrates for 200 ms on supported devices. [OBSERVED]
- **Confetti** on the winner screen, code-split so it isn't paid for during play. [OBSERVED]
- **Number bubbles**: cash/bid changes spawn floating `+N` / delta bubbles rather than snapping.
  [OBSERVED — bid delta bubbles, clock grant bubbles]
- **Reduced-motion respected** throughout. [OBSERVED]
- **Loading tips** rotate on the "Loading game…" screen — strategy hints, UI hints, and Discord
  promos. A cheap, high-value polish item to copy. [OBSERVED — ~20 tips in `index.BAOd0zsy.js`]
- **Progressive disclosure** as a theme: the turn clock hides until it matters; the property-click hint
  is dismissible; the share dialog states its own consequences.
- **Toasts** (react-toastify, `richup-toast-container`) and tooltips (tippy/popper) for transient
  feedback. [OBSERVED]
- **Ads are part of the feel**, honestly framed: "Richup is free and wants to stay free. We use ad
  revenue to keep maintaining the game. Thanks! ❤", "Disable your ad blocker to support Richup.io",
  a dismiss confirm, and a pre-room video interstitial. [OBSERVED]
- Moderation is built into the social surface: per-player **Mute** / **Unmute**, **Block**, **Report**
  with a fixed reason list ("AFK or griefing", "Cheating or multi-accounting", "Ganging up on other
  players", "Hate speech or harassment", "Inappropriate username or avatar", "Leaving or griefing",
  "Stalling or time-wasting", "Threats or harmful content", "Something else"), plus friends/friend
  requests. [OBSERVED — `index.BAOd0zsy.js`]

---

## 11. Tech observations

All [OBSERVED] unless noted.

- **Frontend:** React 19-era + **TanStack Router** (file-based route ids like `/room/$roomId`,
  `store.$categoryId`, `profile.$userId`), built with **Vite** (content-hashed ESM chunks,
  `__vite__mapDeps`). CSS Modules (hashed class names) — no Tailwind signature.
- **State:** Zustand-style stores (`getState`/`setState`/provider pattern), **Zod** for schema
  validation of every socket payload, **TanStack Query** for REST, **Framer Motion** for animation,
  **dnd-kit** for drag-and-drop, **Luxon** for time, **Font Awesome** for icons, react-toastify,
  tippy/popper, `canvas-confetti`.
- **Realtime: socket.io over WebSocket**, not polling. **Two separate namespaces**:
  - `/api/app/socket.io/` — app/lobby: `enter-room`, `entered-room`, `join-game`, `joined-game`,
    `player-joined`, `player-left`, `game-room-updated`, `update-game-room`, `room-restart`,
    `room-deleted`, `room-not-found`, `chat-message`, `trade-*`, `votekick-player`,
    `host-kick-player`, `mute-player`, `report-player`, `do-bankrupt`, `game-ended`,
    `game-over-winner`, `clock-time-*`, `team-*`.
  - `/api/game/socket.io/` — in-game: `roll-dice`, `dice-rolled`, `end-turn`, `turn-ended`,
    `buy-property`, `purchase-property`, `upgrade-city`, `downgrade-city`, `sell-property`,
    `mortgage-property`, `unmortgage-property`, `start-auction`, `place-bid`, `end-auction`,
    `pay-out-of-prison`, `use-pardon-card`, `propose-trade`/`accept-trade`/`reject-trade`/
    `cancel-trade`, `sync-game-state`, `request-sync`, `request-server-time`, `start-game`,
    `game-started`, `end-game`.
  - Splitting lobby/social traffic from game traffic is a design decision worth noting for a clone.
- **State sync:** full snapshot sync on demand (`sync-game-state`) plus incremental
  `applyServerAction({type, …})` events — an event-sourced client store with a checksum-style compact
  serialization (keys shortened to `prts`, `prps`, `cp`, `crit`, `diar`, `d`, `stck`…). Server time is
  requested explicitly so timers agree across clients. [OBSERVED / INFERRED]
- **REST endpoints** seen in the bundle (all under `/api`): `/auth/self`, `/auth/{provider}`, `/coins`,
  `/features`, `/settings`, `/dice`, `/keepalive`, `/game/claim-coin-reward`, `/game/reauth`,
  `/maintenance/maintenance-info`, `/announcements`, `/push/{public-key,subscribe,unsubscribe,verify,
  mute,reachable-friends}`, `/user/bulk`, `/user/friends`, `/user/self/profile-picture-options`,
  `/user/self/update-name`, `/user/self/update-profile-picture`, `/user/{id}/{profile,last-games,
  friendship,block}`. Note: guessed paths like `/api/app/rooms` return a JSON `{"error":"Not found"}`
  404, so the API is real but I did not enumerate a public room-list endpoint. [OBSERVED]
- **Third-party:** Sentry (release `c727590f`, `_sentryBundlerPluginAppKey:richup-frontend`), PostHog
  analytics with feature flags and surveys (key exposed in `/app-config.js`), Google Tag Manager
  (`GTM-KD6CN2M`), Cloudflare Turnstile, web-push.
- **Funnel instrumentation** is unusually explicit and reads like a product roadmap:
  `funnel_room_landed`, `funnel_room_joinability`, `funnel_socket_connect{ed,_failed}`,
  `funnel_socket_disconnected`, `gameplay-login-open`, `gameplay-login-complete`.
- **Hosting:** [UNVERIFIED] — I did not inspect response headers for a CDN/host fingerprint.

---

## 12. Sources

### Primary (richup.io itself), all fetched 2026-08-20

| URL | Usefulness |
|---|---|
| `https://richup.io/` | Landing copy, nav, footer, "better on desktop" note. Discovered the bundle URLs. **High.** |
| `https://richup.io/info` | Legal/positioning only. Low. |
| `https://richup.io/manifest.webmanifest` | PWA: standalone display, dark theme, "friends, strangers, or bots". Medium. |
| `https://richup.io/app-config.js` | PostHog key only. Low. |
| `https://richup.io/index.BAOd0zsy.js` | **Highest value.** Room settings defaults + allowed values, lobby socket events, report/karma/friends, loading tips, board block types. |
| `https://richup.io/assets/GamePageContent-DcbcEFrO.js` | **Highest value.** Whole game screen: turn buttons, auction component, turn clock, votekick, chat, end-game, stats. |
| `https://richup.io/GamePageContent.BPaaiLsN.css` | Board grid areas (proves 2D DOM board), breakpoints. **High.** |
| `https://richup.io/assets/Lobby-D0IgtVfX.js` | Landing page copy, maintenance/ban states, invite mute. Medium. |
| `https://richup.io/assets/room._roomId-Boj9rj7z.js` | Route shell; revealed `GamePageContent` chunk + ad interstitial. Medium. |
| `https://richup.io/api/{app,game}/rooms`, `/api/rooms`, `/api/app/maintenance` | All JSON 404 — confirms a real JSON API, no public room list found. Low. |

### Secondary

| URL | Usefulness |
|---|---|
| `https://blog.richup.io/` | Dev changelog with dates — dated the Turn Clock (v1.17, 15 Aug 2026) and Teams (v1.16, 27 Jun 2026). **High.** |
| `https://blog.richup.io/richup-v1-17-the-turn-clock/` | **Critical.** The only source for auto-play-then-remove behavior, "two turns and you're out", properties to bank, one-click +1 minute grant, and the "can only be removed once time ran out" rule. |
| `https://blog.richup.io/richup-v1-16-introducing-teams-mode/` | Teams mechanics + separate Team chat channel. Medium. |
| Web search (Reddit / GitHub / clones) | **Dry.** No richup clone or reverse-engineered client on GitHub; no substantive Reddit threads surfaced. Do not re-run. |
| `https://richup.itch.io/richupio` (via search) | 4.8/5 from 11 ratings; no UI detail. Low. |

### What I deliberately did not pursue

YouTube gameplay videos (transcripts aren't reachable via plain fetch), and repeat GitHub/Reddit
searches after the first two came back empty. The bundle turned out to be a far richer source than any
of those would have been.

---

## Confidence assessment

### Solid — safe to build from

- Room settings: every key, its default, and its allowed values. Player caps (2–6 free, 7–8 paid).
  Starting-cash options. Auctions and mortgages off by default.
- No account required; Turnstile captcha at join; nickname + exclusive appearance chosen at join.
- Private-vs-public tradeoff, including the one-way "make public" confirm.
- Sharing is by room URL; late arrivals become spectators; spectating is an explicit button.
- No ready-up; host-only Start with a disabled-state tooltip taxonomy; min 2 players.
- Board is a **2D CSS-grid DOM board**, not canvas or 3D, and its four-stage responsive reflow down to
  a single column.
- "Force Start Game" is an admin-account power, not a player one.
- Bots are badged, unreportable, and removable without a confirm.
- Turn action button progression: Roll → Roll again on doubles → Buy for $N → End turn; can't end in debt.
- **Auction UI in near-complete detail**: blocking modal, 10-second window that resets per bid,
  fixed-increment quick-bid buttons, can't outbid yourself, can't bid what you can't afford,
  "Sold in…" vs "Ends in…", live bid log.
- Turn clock: phase model, hide-until-it-matters pill, ask-for-time / grant-time, auto-play then
  removal after two turns, properties back to the bank, karma cost.
- Votekick and host-kick copy and rules; connectivity as a broadcast player attribute; reconnect via
  `request-sync`/`sync-game-state`.
- Bankruptcy confirmation flow; winner reveal, coin claim, share row, host-only "Another game" rematch,
  post-game statistics including the net-worth chart.
- Sound set (eight cues), haptics, confetti, reduced-motion support, loading tips.
- Tech stack: React 19 + TanStack Router + Vite + Zod + socket.io on two namespaces.

### Needs a human to open the site and check

1. **Auction bid increments** — I have the mechanism but not the ladder values. Highest-value single gap.
2. **Turn clock durations** — free time and reserve, in seconds. Server-side; must be measured live.
3. **The trade builder's actual layout** — two-sided panel? drag-and-drop? cash slider? And whether
   non-participants can see offer *terms* or only "is negotiating a trade…".
4. **Confirm the counter-offer model** — that `trade-negotiate` really means "recipient edits the same
   trade and becomes its creator".
5. **Votekick threshold** — how many votes actually remove a player, and whether bots count.
6. **Bots** — what the bot badge looks like, bot names, difficulty, whether a host can add N bots on
   demand, and whether a bot ever takes over an abandoned seat.
7. **Spectator permissions** — can spectators chat? see full state?
8. **Host migration** when the host leaves — no client-side evidence either way.
9. ~~**Token movement animation**~~ — answered in `richup-motion-observed.md`: a smooth tween, measured.
10. **Board emotes/reactions** separate from chat emoji — I found no evidence these exist.
11. **What `Play` vs `All rooms` actually do** on the landing page.
12. **No-bid auction outcome** — property back to bank, or re-auctioned?
13. **Hosting/CDN** — check response headers.
14. **The "Ask for more time" 15s constant** — cooldown, or display duration?

### Explicitly *not* claimed

I found no evidence of: a numeric room code (it's a URL), an in-lobby ready-up toggle, a
"replaced by a bot on disconnect" behavior, or a board-level emote wheel. Absence of evidence in a
minified bundle is not proof of absence, but none of these left the fingerprints the real features did.
