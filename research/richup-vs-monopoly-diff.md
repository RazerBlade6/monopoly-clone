# THE DIFF — richup.io vs. official Hasbro Monopoly

**Scope:** every place richup.io deviates from the official Hasbro Monopoly rules, plus the naming/trademark situation.
**Researched:** 2026-08-20. **Companion doc:** `research/board-data.md` holds the full 40-space table — deliberately not duplicated here.

## Method and why confidence is what it is

The strongest evidence in this document is **richup.io's own shipped JavaScript bundle**, pulled directly and read for string constants, Zod validation schemas, and socket event names. That is the actual client the actual server talks to, so anything sourced to it is `High` confidence and is quoted as literal identifiers.

Files fetched and mined:

| Asset | Size | What it gave up |
|---|---|---|
| `https://richup.io/index.BAOd0zsy.js` | 1.16 MB | Default settings object, settings Zod schema, block/corner type predicates, socket event names, turn-clock config, gameplay tips |
| `https://richup.io/assets/GamePageContent-DcbcEFrO.js` | 769 KB | In-game UI strings, action names, Pardon-card copy, bankruptcy copy, map browser |
| `https://richup.io/assets/Lobby-D0IgtVfX.js` | 82 KB | Lobby copy, starting-cash marketing text |
| `https://richup.io/info` | — | richup's own copyright/trademark disclaimer |

The single most useful artifact is this literal default-settings object from the main bundle — it is the spine of most of the table below:

```js
const DEFAULT_SETTINGS = {
  maxPlayers: 4, canBotsJoin: true, isPrivate: false, onlyUsers: false,
  payDoubleRentWhenOwnFullSet: false, vacationCash: false, auction: false,
  noRentPaymentsWhileInPrison: false, mortgage: false,
  startingCash: 1500, evenBuild: true, shufflePlayerOrder: true,
  teams: { enabled: false }
}
```

Alongside it: `startingCash` is constrained to `[500, 1000, 1500, 2000, 2500, 3000]`, and `maxPlayers` to `[2, 3, 4, 5, 6]` **plus a per-map extension** — the bundle carries `{"6276ab519dd516c1aec96ae1": [7, 8]}`, so one specific board map unlocks 7- and 8-player games.

The bundle also exposes the **board map registry** outright:

```js
const MAPS_BY_ID = { "6289420d8e44343ae5eb4b22": "mr-worldwide",
                     "62cb385f36cbccd7e0fbd3c1": "death-valley",
                     "62cc5d0636cbccd7e0fbd3c2": "lucky-wheel" }
const VALID_MAP_IDS = ["classic", ...Object.values(MAPS_BY_ID)]
```

So richup ships **four boards**: `classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`. The names alone imply these are not mere reskins — "lucky-wheel" and "death-valley" suggest rule variants, not just retextured tiles.

**The headline structural insight.** richup's deviations are not mostly *additions*. Three of the most important ones are **core Hasbro rules shipped switched off and demoted to optional toggles**: `auction: false`, `mortgage: false`, and `payDoubleRentWhenOwnFullSet: false`. In official Monopoly all three are mandatory rules, not options. A player who opens richup and clicks Start is playing a game that has removed the auction, removed mortgaging, and removed the unimproved-monopoly rent doubling. That is a far bigger fidelity gap than any single feature richup added, and it is the thing most worth understanding before cloning.

---

## 1. THE DIFF TABLE

Confidence: `High` = read out of the shipped bundle or richup's own pages. `Medium` = consistent secondary reporting or strong inference from bundle structure. `UNVERIFIED` = could not source; do not treat as fact.

| Area | Official Hasbro rule | richup.io behavior | Source URL | Confidence |
|---|---|---|---|---|
| **Auctions** | **Mandatory.** If a player declines to buy at list price, the property is immediately auctioned to all players, opening at any bid. | **Off by default.** `auction: false` in the default settings; an optional room toggle. Auction UI exists ("Auction", "Current bid", "I'm bidding...") and validation refuses auctions on already-owned blocks. | `https://richup.io/index.BAOd0zsy.js`; `https://richup.io/assets/GamePageContent-DcbcEFrO.js` | High |
| **Mortgaging** | **Core rule.** Any unimproved property may be mortgaged for half price; 10% interest on unmortgage. | **Off by default.** `mortgage: false` is an optional toggle. Actions `mortgage-property` / `unmortgage-property` exist and are gated behind it. | `https://richup.io/index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Double rent on unimproved monopoly** | **Core rule.** Owning all of a colour group doubles rent on the unimproved lots of that group. | **Off by default.** `payDoubleRentWhenOwnFullSet: false` — an optional toggle, not baseline behavior. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Free Parking** | A **do-nothing** space. No money, no penalty. (Cash-in-the-middle is the single most common unofficial house rule, explicitly not in the rulebook.) | Renamed **Vacation**, and it is *not* inert. Two separate deviations: (a) optional `vacationCash` toggle pays accumulated money — the house rule promoted to a first-class setting; (b) the Vacation corner carries a per-player `suspendedTurnsRemaining` map — strongly suggesting **landing on Vacation costs you turns**. | `https://richup.io/index.BAOd0zsy.js` | High for (a); **Medium** for (b) — see note below |
| **Jail** | "Jail". Leave by paying $50, using a Get Out of Jail Free card, or rolling doubles within 3 turns. **Rent is still collected while in jail.** | Renamed **Prison**. Same three exits (`pay-out-of-prison`, `paid-out-of-prison`, Pardon card, doubles). Adds an optional `noRentPaymentsWhileInPrison` rule (default `false`) — a purely richup invention to stop prison-camping. | `https://richup.io/index.BAOd0zsy.js`; in-game tip: `Enable the "Don't collect rent while in prison" rule, so people will not camp in prison` | High |
| **Jail as strategy** | Emergent, unacknowledged by the rulebook. | richup **explicitly coaches it** in its tip rotation: "Sometimes it's better to stay in prison, so you won't pay rent for as long as possible" — then sells the counter-rule as a toggle. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Go to Jail** | Corner space, sends player to Jail, no $200 for passing Go. | Same mechanic, renamed corner type `go-to-prison`. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Even build** | **Mandatory.** Houses must be built evenly across a colour group; same for selling. | **Enforced, and on by default** (`evenBuild: true`) — but exposed as a **toggle players can switch off**. Hasbro has no notion of disabling it. | `https://richup.io/index.BAOd0zsy.js` | High |
| **House / hotel supply** | **Hard global limit: 32 houses, 12 hotels.** Scarcity is a real strategic lever (the "housing shortage" squeeze). | No evidence of any global building bank in the client. Buildings appear to be a per-property level, and the UI speaks only of upgrade/downgrade ("Click on a property to upgrade, downgrade or sell it."). Almost certainly **unlimited supply**, but the bank could live server-side. | `GamePageContent-DcbcEFrO.js` | UNVERIFIED (leaning: not enforced) |
| **Starting cash** | Fixed **$1500**. | Default $1500, but **configurable**: `[500, 1000, 1500, 2000, 2500, 3000]`. | `https://richup.io/index.BAOd0zsy.js`; `Lobby-D0IgtVfX.js` ("All players start with $1500.") | High |
| **Player count** | 2–8. | **2–6 on most maps; 7–8 on one specific map.** The base validated set is `[2,3,4,5,6]`, extended per-map by `{"6276ab...": [7,8]}`. So richup matches Hasbro's ceiling only on that one board. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Turn order** | Determined by an initial high-roll. | `shufflePlayerOrder: true` by default — randomised, not rolled for. Toggleable. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Turn timer** | **No analogue.** Physical board game, untimed. | **Chess-style clock.** `turnClock` config carries `minRefillMs`, `maxRefillMs`, `refillMs`, `grantCooldownTurns`; time is *refilled* per turn, not a flat countdown. Tracked stats: `expiredTurns`, `expiredTurnsAfterSelfAction`, `expiredTurnsWhileOffline`, plus `offlineMs` and `grantedWhileOfflineMs`. | `https://richup.io/index.BAOd0zsy.js` | High |
| **Begging for time** | No analogue. | Players can **request extra clock time from opponents**, who grant it: `request-clock-time` / `clock-time-requested` / `grant-clock-time` / `clock-time-granted`, UI "Ask for more time", rate-limited by `grantCooldownTurns`. A genuinely novel social mechanic. | `https://richup.io/index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Bankruptcy** | Player is bankrupt when they cannot pay; assets go to the creditor (or the bank, which auctions them). Not voluntary. | **Voluntary, player-declared**: `do-bankrupt` / `submitBankrupt`, UI "File your bankruptcy", "Are you sure you want to bankrupt?", "You will lose all your money and purchased properties!". Server tracks `creditorRecoveries`, implying creditor-directed asset transfer. | `GamePageContent-DcbcEFrO.js`; `https://richup.io/index.BAOd0zsy.js` | High |
| **Negative cash mid-turn** | Not a state that exists; you must raise funds or go bankrupt at the moment of debt. | richup **permits a transient negative balance** and only blocks turn-end: "You can't end your turn with a negative amount of money. Sell properties or trade with other players." A real deviation, and a UX improvement. | `GamePageContent-DcbcEFrO.js` | High |
| **Trading** | Property may be traded any time. **Improved property may NOT be traded** — buildings must be sold back to the bank first. Mortgaged property may be traded (with interest due). | Full trade lifecycle: `trade-create`, `trade-negotiate`, `trade-confirm`, `trade-decline`, `trade-delete`, `accept-trade`, `cancel-trade` — including a **counter-offer/negotiate step Hasbro has no analogue for**. A `stampedFlags.tradeFairnessRules` boolean is versioned per game, so trade constraints changed at some point and are stamped per room. | `https://richup.io/index.BAOd0zsy.js` | High (that trading exists) |
| **Trading improved / mortgaged property specifically** | Improved: forbidden. Mortgaged: allowed with interest. | **Could not determine.** `tradeFairnessRules` exists but its semantics are server-side. Do not assume richup enforces the improved-property restriction. | — | UNVERIFIED |
| **Rent collection** | Owner **must ask** for rent before the next player rolls, or forfeits it. | Rent is almost certainly **auto-collected** by the server — no "claim rent" action appears anywhere in the client's action list. The forfeit-if-you-don't-ask rule is effectively deleted. | `https://richup.io/index.BAOd0zsy.js`, `GamePageContent-DcbcEFrO.js` (absence of a claim action) | Medium |
| **Chance / Community Chest** | Two decks, "Chance" and "Community Chest". | Two decks renamed **`treasure`** and **`surprise`**, held in a `bonusCards` record; spaces are block `type === "bonus"`. | `https://richup.io/index.BAOd0zsy.js` (`const EN=["treasure","surprise"]`) | High |
| **Card contents** | ~16 cards per deck, fixed published text. | **Not in the client** — decks are resolved server-side. Effects and text could not be enumerated. | — | UNVERIFIED |
| **Get Out of Jail Free card** | One in each deck; keepable or sellable to another player. | Renamed **"Pardon card"**. Tracked as `pardonCardHolderId` **per deck** — so, as in Hasbro, exactly two exist. UI: "While in prison, you can use a Pardon card to get out of prison immediately, and for free." | `GamePageContent-DcbcEFrO.js`; `index.BAOd0zsy.js` | High |
| **Railroads** | Four railroads. | **Airports** (block `type === "airport"`), four of them. | `https://richup.io/index.BAOd0zsy.js`; secondary count | High (type) / Medium (count) |
| **Utilities** | Exactly two: Electric Company, Water Works. | Block `type === "company"`. Count is **not** reliably two: the game chunk imports **three** company icons — `bolt` (electric), `faucet` (water) and `gas` — alongside `airplane` for airports. Either the classic map has a third utility or the extra maps add one. At least one retains the literal name **"Electric Company"**. | `assets/GamePageContent-DcbcEFrO.js` (icon imports); greasyfork replacer | Medium |
| **Board variants** | One canonical board. | **Four selectable board maps** — `classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`, validated via `mapId`. UI has "Board Maps", "Browse maps", "Change map tiles, properties and stacks". Player caps and likely rules vary per map. No Hasbro analogue outside licensed editions. | `https://richup.io/index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Teams** | No analogue. | **Team play** with `teams.enabled` and `balanceStartCash`; "Smaller teams receive more starting cash", "Balance teams". On elimination, "Your cash, properties, and pardon cards will transfer to your teammates." | `index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Bots** | No analogue. | **On by default** — `canBotsJoin: true`. "Bots will join the game based on availability", "Ramp up your skills by practicing with bots". | `index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Doubles** | Roll again; three doubles in a row sends you to Jail. | Doubles grant another turn ("Got doubles? You'll have another turn!"); `double-roll-dice` action and a "Doubles" label exist. Three-doubles-to-jail not directly confirmed in client strings. | `https://richup.io/`; `GamePageContent-DcbcEFrO.js` | Medium |
| **Player moderation** | No analogue. | `votekick-player`, `host-kick-player`, `mute-player`, `report-player`, plus a karma/ban system and Cloudflare Turnstile anti-bot. Necessary infrastructure for a public lobby; entirely digital-native. | `index.BAOd0zsy.js`; `GamePageContent-DcbcEFrO.js` | High |
| **Monetisation** | One-time retail purchase. | Free-to-play with a **cosmetic store and coins** (`store.coins`, `StoreCoinsPackDisplay`), plus in-game advertising in the room chunk. Cosmetics only — no evidence of pay-to-win. | `assets/store.coins-DjEzJmyh.js`, `assets/room._roomId-Boj9rj7z.js` | High |
| **Game restart** | Set the board up again. | `room-restart` — rematch with the same lobby and settings. | `index.BAOd0zsy.js` | High |
| **Luxury / Income Tax** | Two tax spaces ($200 Income, $100 Luxury in current editions). | Tax spaces are reported to exist, but **no `type === "tax"` predicate appears** in the client — the five confirmed block types are `city`, `airport`, `company`, `corner`, `bonus`. Tax may be modelled as a bonus-block subtype. | `index.BAOd0zsy.js` (type predicates); secondary reporting | UNVERIFIED |

**Note on the Vacation turn-suspension claim.** What is proven at High confidence is that the vacation corner *carries* a per-player `suspendedTurnsRemaining` field. A shared corner type with an optional field would explain that too. The tie-breaker is that richup ships a **dedicated predicate reading that field off the vacation block specifically** (`pEe`), separate and parallel to the prison one (`hEe`) — nobody writes a distinct helper for a field that is never populated. That is strong circumstantial evidence, not proof, so the claim is labelled **Medium**. It is the most novel deviation in this document and the one most worth confirming by direct play before designing around it.

### Confirmed richup data model (useful for the clone)

Block types: `city` | `airport` | `company` | `corner` | `bonus`.
Corner types: `prison` | `vacation` | `go-to-prison` (+ a start corner, implied by the `start-label` / `start-arrow` assets).
`boardConfig` carries `prisonBlockIndex` and `vacationBlockIndex` — corners are **indexed, not hardcoded**, which is what makes multiple board maps possible. Worth copying.

---

## 2. TERMINOLOGY MAP

| Hasbro term | richup.io term | Source | Confidence |
|---|---|---|---|
| Chance | **Surprise** (`surprise` deck) | `index.BAOd0zsy.js` | High (identifier) / Medium (which Hasbro deck it maps to) |
| Community Chest | **Treasure** (`treasure` deck) | `index.BAOd0zsy.js` | High (identifier) / Medium (mapping) |
| Free Parking | **Vacation** (`cornerType: "vacation"`) | `index.BAOd0zsy.js` | High |
| Jail | **Prison** (`cornerType: "prison"`) | `index.BAOd0zsy.js` | High |
| Go to Jail | **Go to Prison** (`cornerType: "go-to-prison"`) | `index.BAOd0zsy.js` | High |
| Get Out of Jail Free card | **Pardon card** (`pardonCardHolderId`) | `GamePageContent-DcbcEFrO.js` | High |
| Railroad | **Airport** (`type: "airport"`) | `index.BAOd0zsy.js` | High |
| Utility | **Company** (`type: "company"`) | `index.BAOd0zsy.js` | High |
| Property / street | **City** (`type: "city"`) | `index.BAOd0zsy.js` | High |
| Colour group | **Country** (group = a country, tiles = its cities) | greasyfork replacer script | Medium |
| Board / gameboard | **Map** (`mapId`, "Board Maps") | `index.BAOd0zsy.js` | High |
| GO | **Start** (`start-label`, `start-arrow` assets) | `index.BAOd0zsy.js` asset names | Medium |
| Houses / hotels | **Unchanged** — "houses" and "hotels" are used literally | `Lobby-D0IgtVfX.js`, `https://richup.io/` | High |
| Bank | No distinct client-side term found | — | UNVERIFIED |
| Title deed | No distinct client-side term found | — | UNVERIFIED |

Note the asymmetry: richup renamed **every proper noun that Hasbro could claim as expression** (Chance, Community Chest, Free Parking, Jail, Get Out of Jail Free, and all property names) while keeping **generic functional nouns** (houses, hotels, rent, dice, bankrupt, auction). That split is not accidental — see §4.

---

## 3. THE PROPERTY NAMING SCHEME

**The scheme: real-world cities, grouped by country.** Each colour group is a country; the 2–3 tiles in that group are cities in that country. This replaces Hasbro's Atlantic City street names (Boardwalk, Park Place, Mediterranean Avenue) wholesale.

Best evidence is a third-party userscript that reskins the richup board into Lithuanian cities. To do that it must enumerate richup's *original* names as replacement keys, so its source is effectively a dump of the live board vocabulary.

Confirmed group structure — **8 country groups**, matching the ~22 city tiles reported for the default map:

| Country group | Cities (from the replacer's key set) |
|---|---|
| Brazil | Salvador, Rio |
| Israel | Tel Aviv, Haifa, Jerusalem |
| Italy | Venice, Milan, Rome |
| Germany | Frankfurt, Munich, Berlin |
| China | Shenzhen, Beijing, Shanghai |
| France | Lyon, Toulouse, Paris |
| United Kingdom | Liverpool, Manchester, London |
| USA | San Francisco, New York |

Source: `https://greasyfork.org/en/scripts/534514-richup-io-name-flag-replacer-lithuanian-cities/code`. Confidence **Medium-High** — derived from the live DOM by a third party, not from richup's own bundle. Treat `research/board-data.md` as authoritative for exact ordering and prices.

**Why this scheme is the right choice, and worth copying.** Three reasons, in descending order of importance:

1. **It is the legal fix.** "Boardwalk" and "Mediterranean Avenue" as a curated set are Hasbro's creative expression. City and country names are facts about the world — unownable, individually and as a geographic set. Swapping Atlantic City streets for world cities removes the single largest copyright exposure in a Monopoly clone at near-zero design cost.
2. **It replaces the group identifier.** Hasbro's groups are identified by *colour* alone. richup's are identified by **country plus flag**, which is a stronger, more memorable, and more localisable handle. Colour remains as secondary encoding — better accessibility for colour-blind players as a free side effect.
3. **It makes the board reskinnable.** Because a group is "a country and its cities", new maps are pure data. That is exactly what `mapId` and "Change map tiles, properties and stacks" exist to exploit. The Atlantic City theme cannot be extended this way.

**Two cautions.** The scheme is not perfectly executed: at least one utility appears to retain the literal name **"Electric Company"**, which is a Hasbro board term (generic and descriptive, so probably defensible, but it is copying where copying was unnecessary). And the group sizes are uneven — Brazil and USA have two cities where the rest have three — mirroring Hasbro's own uneven first/last groups rather than being designed fresh.

---

## 4. LEGAL / IP NOTES

**This section summarises publicly reported information. It is not legal advice. Have a lawyer review before any public launch.**

### What Hasbro actually holds

- **The MONOPOLY word mark** — a registered trademark, vigorously enforced. This is the strongest and most dangerous piece.
- **Board artwork and trade dress** — the specific visual design, the colour-bar layout, the card backs, the overall look.
- **The property names as a curated set** — Boardwalk, Park Place, Marvin Gardens, Mediterranean Avenue, and the rest.
- **The specific card text** — the exact wording of the Chance and Community Chest cards.
- **Mr. Monopoly (Rich Uncle Pennybags)** and the token designs (top hat, thimble, Scottie dog) as character/design works.
- Named spaces as expression: "Free Parking", "Community Chest", "Go to Jail".

### What is not protectable

- **The game mechanics themselves.** Roll-and-move, buying properties, collecting rent, colour-group monopolies, building houses, mortgaging, bankruptcy: these are *ideas, systems, and methods of play*, and US copyright does not reach them. richup states this position on its own `/info` page, quoting copyright.gov to the effect that copyright does not protect the idea for a game, its name or title, or the method of playing it, and that once a game is public nothing prevents others from developing another game on similar principles — copyright protects only the particular manner of expression. Source: `https://richup.io/info`.
- **The historical origin undercuts exclusivity.** *(The two bullets that follow are general background from public history, not from a source fetched during this research — verify both before relying on either.)* The design descends from **Lizzie Magie's The Landlord's Game**, patented 1904 — nearly two decades before Parker Brothers published Monopoly in 1935. The core loop is not Hasbro's invention.
- **Anti-Monopoly** (*Anti-Monopoly, Inc. v. General Mills Fun Group*, 9th Cir.) held that the MONOPOLY trademark had become generic. Congress then amended the Lanham Act (the Trademark Clarification Act of 1984) to change the genericness test **prospectively** — it did not vacate that judgment — and Hasbro's mark stands today. The takeaway is narrow but real: the mark has been litigated and is not unassailable, while the *mechanics* were never the contested asset.

**What richup's own Terms & Conditions do and do not say.** Fetched at `https://richup.io/terms-and-conditions`. The IP clause is standard boilerplate running the *other* direction — richup asserts that all content on the game (text, graphics, logos, icons, images, sound, page layout, code) is its own property, licensed not sold to users, and states the material is protected under "applicable Israeli and International intellectual property" law. Two things are notable for this project. First, richup positions itself as an **Israeli-law entity**, so its risk calculus is not a US one and should not be read as a template for a US launch. Second, and more telling: **the T&C never mentions Hasbro or Monopoly at all.** The entire trademark posture lives on the separate `/info` page. The legal disclaimer and the marketing surface are deliberately kept apart.

### How richup.io and similar clones avoid infringement

They keep the unprotectable layer and replace the protectable one, systematically:

| Layer | Strategy |
|---|---|
| Mechanics | **Copied wholesale** — unprotectable ideas |
| Proper nouns | **All renamed** — Chance→Surprise, Community Chest→Treasure, Free Parking→Vacation, Jail→Prison, Get Out of Jail Free→Pardon card |
| Property names | **Wholly new scheme** — world cities by country, not Atlantic City streets |
| Card text | **Rewritten**, not paraphrased from Hasbro's |
| Artwork | **Original** — own tile art, own tokens, no Mr. Monopoly |
| Product name / domain | **"Richup.io"** — no "Monopoly" in the name or domain |
| Disclaimer | Explicit non-affiliation notice on `/info` |

Two nuances worth noting. richup does use the word "Monopoly" in its `<title>` and meta description ("Monopoly Alternative", "a free online alternative to Monopoly") — that is **nominative/comparative reference**, using a mark to describe what a product is an alternative to. It is a recognised concept but it is also the most aggressive thing on the site, and it is unmistakably SEO-motivated. It is not a pattern to copy without advice. Second, richup's `/info` disclaimer follows the standard form: independent work, not affiliated with or endorsed by any third-party trademark holder, all brands the property of their respective owners.

### Specific things this project MUST NOT copy

1. **The word "Monopoly" in the product name, domain, logo, or app-store listing.** The brightest line there is.
2. **Hasbro property names** — Boardwalk, Park Place, Mediterranean Avenue, Marvin Gardens, and the rest of the set.
3. **Exact Chance / Community Chest card text.** Write original card text. Paraphrasing Hasbro's wording with small substitutions is *worse* than writing fresh, not better.
4. **Board artwork, trade dress, colour-bar layout, card-back designs.**
5. **Mr. Monopoly / Rich Uncle Pennybags**, and the classic token designs.
6. **The names "Chance", "Community Chest", "Free Parking", "Go to Jail", "Title Deed".**
7. **Hasbro's font, palette, and the distinctive red-and-white styling.**

Safe to reuse: the mechanics, the 40-space structure, the 2-3-3 group topology, rent progressions and price ladders (numbers/systems), and generic vocabulary — rent, houses, hotels, dice, bankrupt, auction, mortgage.

One further flag not covered by copyright: **"Electric Company" and "Water Works"** should be renamed anyway. They are generic enough to be defensible, but they are Hasbro board vocabulary and there is no design cost to replacing them. richup left "Electric Company" in place; don't inherit that.

---

## 5. (Moved) Lessons for the clone

The design lessons drawn from this comparison (server authority and a hostile client, index-based board
data, the block model, original card text) are in `docs/PROJECT.md` under "Principles" and "IP".
The cheat-suite evidence behind treating the client as hostile: a public Selenium bot
(`https://github.com/shadazls/Monopoly-Bot-Richup.io`) and a greasyfork "richup.io Advanced Cheat
Suite" with a socket interceptor, client-state reader, auto-play bot and HUD overlay
(`https://greasyfork.org/en/scripts/573868-richup-io-advanced-cheat-suite`).

---

## 6. SOURCES

### Primary (richup.io itself) — High confidence

| URL | Usefulness |
|---|---|
| `https://richup.io/index.BAOd0zsy.js` | **Most valuable source in this document.** Default settings object, settings Zod schema, block/corner predicates, `treasure`/`surprise` decks, `pardonCardHolderId`, turn-clock config, all socket event names, gameplay tips |
| `https://richup.io/assets/GamePageContent-DcbcEFrO.js` | In-game UI strings: auction/bidding, Pardon card copy, bankruptcy flow, negative-balance rule, board-map browser, teams |
| `https://richup.io/assets/Lobby-D0IgtVfX.js` | Lobby and onboarding copy; $1500 starting cash confirmation |
| `https://richup.io/info` | **Best legal source.** richup's own copyright reasoning quoting copyright.gov, plus its non-affiliation disclaimer |
| `https://richup.io/` | Marketing copy, doubles rule, desktop-preference admission, meta description |
| `https://richup.io/assets/room._roomId-Boj9rj7z.js` | Chunk manifest (led to GamePageContent); in-room ad configuration |
| `https://richup.io/terms-and-conditions` | richup's IP clause, Israeli-law governance, and the notable *absence* of any Hasbro/Monopoly mention |
| `https://richup.io/assets/index-BliZ6Xms.js` | Route stub only; no gameplay content (listed for completeness) |
| `https://richup.io/assets/terms-and-conditions-j6oZ5W-b.js` | Route stub only; the T&C text is server-rendered, not in this chunk |
| `https://richup.io/app-config.js` | Only a PostHog key — no API base URL, which is why card contents stayed unreachable |

### Secondary — Medium confidence

| URL | Usefulness |
|---|---|
| `https://greasyfork.org/en/scripts/534514-richup-io-name-flag-replacer-lithuanian-cities/code` | **Key source for §3.** Enumerates richup's original city/country names as replacement keys; also revealed "Electric Company" |
| `https://greasyfork.org/en/scripts/573868-richup-io-advanced-cheat-suite` | Publicly listed cheat suite (socket interceptor, state reader, auto-play bot, HUD) — the strongest evidence that client-trust and anti-automation are unsolved on richup |
| `https://greasyfork.org/en/scripts/by-site/richup.io` | Index of all richup userscripts; the practical place to look for further board/card data dumps |
| `https://greasyfork.org/en/scripts/485085-richup-io-palestine` | Second independent tile/name replacer — corroborates that board names are plain DOM text |
| `https://github.com/shadazls/Monopoly-Bot-Richup.io` | Selenium bot for richup — evidence that automated play is a live problem |
| `https://github.com/jeremy341/Poorup` | Comparable independent clone (Node/Socket.io); useful sanity reference on architecture |
| `https://github.com/Leagueopoly` | Competitive league built on richup — evidence of a serious player community |
| `https://github.com/intrepidcoder/monopoly` | Reference JS implementation of the standard rules |

### Low value — SEO content farms

`kevin.games/richup-io` (HTTP 520 on fetch), `igre.games`, `rocketgames.io`, `solitaireparadise.com`, `iogamesio.org`, `miniplay.com`, `gameflare.com`, `bubbleshooter.net`. These copy each other's text and cite nothing. Used **only** for the 40-space composition figure (22 cities / 8 groups / 4 airports / 2 utilities) and the "properties all over the world" theme note — both independently corroborated by the greasyfork key set. No claim in this document rests on them alone.

### Searches that came up empty

Reddit complaint threads, Discord logs, Product Hunt, and HN discussion of richup.io. Either the discussion is not indexed or it lives in the Discord, which is not publicly fetchable. **This is the single biggest gap in the research.**

---

## 7. CONFIDENCE ASSESSMENT

**High — build on these directly.** The default settings object and every rule toggle in it; block and corner type taxonomies; `treasure`/`surprise` deck identifiers; Pardon card; the turn clock and time-request mechanic; voluntary bankruptcy; the negative-balance-until-turn-end rule; the trade action set; teams; bots on by default; the four-map registry (`classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`) and the per-map 7–8 player extension; starting-cash and player-count option sets; moderation tooling. All read out of the shipped client.

**Medium.** The Chance→Surprise / Community Chest→Treasure mapping (the identifiers are certain; which Hasbro deck each corresponds to is inference). Rent auto-collection (inferred from the *absence* of a claim action — strong but negative evidence). **Vacation costing turns** (field confirmed, dedicated predicate confirmed, effect inferred — see the note in §1). The property naming scheme and city list (third-party, DOM-derived). Company/utility count, where the three icon imports actively conflict with the reported figure of two. Space counts. Three-doubles-to-jail. GO→"Start".

**Unsourced general background — flagged in place, verify before relying on it.** The Landlord's Game / Anti-Monopoly / Lanham Act history in §4, and the Monopoly Plus characterisation in §5. These are from general knowledge, not from anything fetched during this research. They are marked as such at both locations.

**UNVERIFIED — do not treat as fact.**
1. **Treasure/surprise card contents.** Server-side; not in any client chunk. The largest single gap.
2. **House/hotel supply limits.** No client evidence of a global bank; likely unlimited, unproven.
3. **Whether improved or mortgaged property can be traded.** `tradeFairnessRules` exists; semantics unknown.
4. **Jail/vacation suspension duration.** `suspendedTurnsRemaining` is confirmed to exist on both corners; its values are server-side.
5. **Tax space modelling.** No `type === "tax"` predicate found.
6. **Exact rent/price tables.** Server-side — see `research/board-data.md`.

**How to close the gaps.** Everything unverified sits behind the game's WebSocket. Joining a live room and capturing the initial game-state payload would resolve all six items at once — the board blocks, rent ladders, card decks, and suspension counts all arrive in that snapshot. That is the single highest-value follow-up, and it requires driving a real browser session rather than fetching static assets.

**Update — this lead was chased and partly closed.** greasyfork's richup index was searched: it hosts name/flag replacers and the cheat suite, but **no card-text script**, so the `treasure`/`surprise` deck contents remain UNVERIFIED. The consolation is that the cheat suite's socket interceptor confirms the game state *is* readable off the live socket, which is exactly the capture described above. Separately, the bundle's JSX runtime confirms the richup client is **React**, not Vue as that script's description claims.

The original reasoning, retained: **search greasyfork for other richup userscripts.** The Lithuanian name-replacer handed over the entire property naming scheme at zero cost; a card-text reskinner, if one exists, would expose the `treasure` and `surprise` decks the same way.
