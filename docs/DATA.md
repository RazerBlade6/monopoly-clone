# Data — `src/data`

The game's content: the four board maps and the two card decks. Plain TypeScript data, typed
against `src/shared/types.ts`, with no logic beyond building and validating it.

## Status

Complete. All four maps ship with full tile and rent data, and both decks have 16 original cards.
The board data is richup's, captured from its running client. The decks are our own writing.

## Architecture

```
src/data/
  maps/
    classic.ts, mr-worldwide.ts, death-valley.ts, lucky-wheel.ts   tile lists
    build.ts       buildMap(): tile list → GameMap (derives indices and group sizes)
    validate.ts    validateMap(): structural invariants, returns a list of problems
    index.ts       MAPS, getMap(id)
  cards/
    surprise.ts, treasure.ts    the two decks
    index.ts                    getDeck(deck), getCard(id)
```

```ts
getMap(id: MapId): GameMap;          MAPS: Record<MapId, GameMap>
getDeck(deck: DeckId): Card[];       // a copy; callers may shuffle it
getCard(id: string): Card;           // throws on an unknown id
```

## Maps

| id | Name | Tiles | Cities | Groups | Airports | Companies | Card / tax tiles |
|---|---|---|---|---|---|---|---|
| `classic` | Classic | 40 | 22 | 8 (sizes 2–3) | 4 | 2 | 8 |
| `mr-worldwide` | Mr. Worldwide | **48** | 28 | 10 (sizes 2–4) | 4 | **3** | 9 |
| `death-valley` | Death Valley | 40 | 22 | **4 (5, 6, 6, 5)** | 4 | 2 | 8 |
| `lucky-wheel` | Lucky Wheel | 40 | 16 | 8 (all 2) | 4 | **0** | **16**, incl. a Tax Refund |

The maps are not reskins of each other. Anything that assumes 40 tiles, `index % 40`, groups of 3,
or exactly two companies breaks at least one of them. So:

- **Everything about a board is data.** `buildMap` derives `startIndex`, `jailIndex`,
  `goToJailIndex` and `countrySizes` from the tiles; nothing hardcodes a corner position or a
  group size.
- **Tiles are dense and ordered:** `tiles[i].index === i`, corners at 0, n/4, n/2 and 3n/4.
- Each city has six rent levels (bare, 1–4 houses, hotel), strictly ascending, and its house price
  equals its hotel price. Airports have four (25 / 50 / 100 / 200 on every map). Companies carry
  only a price; their rent is the dice total times the room's multipliers.
- Groups are keyed by `countryId` (14 countries across the four maps), which is also what the
  client's flag badges and tile tints use.

`validateMap` checks all of this, and `maps.test.ts` runs it over every map along with the
registry counts above, the corner positions and the unusual group sizes.

**Source.** Every number is transcribed from `research/richup-maps-all.md`, which is the authority
for board data. Its JSON block uses snake_case; the map files use the camelCase names in
`src/shared/types.ts`. One value is inferred rather than captured: Death Valley's New York house
price (200), where the live capture was truncated. It is marked in `death-valley.ts` and pinned by
a test.

Building supply is the same 32 houses / 12 hotels on every map, although Hasbro tuned that number
for groups of 2–3 (see [ENGINE.md](ENGINE.md)).

## Cards

Two decks of 16, named as richup names them:

| Deck | Equivalent | Character | Effects |
|---|---|---|---|
| `surprise` | Chance | Movement, sudden costs | 5 move relative, 3 move to nearest, 3 money, 1 each of move to START, pay each player, repairs, go to prison, pardon |
| `treasure` | Community Chest | Windfalls and refunds | 11 money, 1 each of move to START, collect from each player, repairs, go to prison, pardon |

- **Effect set** (`CardEffect` in shared types): `money`, `money_from_each`, `move_to`,
  `move_relative`, `move_to_nearest` (airport or company, with a rent multiplier), `go_to_jail`,
  `pardon`, `repairs`.
- **Modelled on the official decks' structure** (counts, effect mix, amounts), from the catalogue
  in `research/cards.md`, with **original text** on a travel theme. No Hasbro wording or names.
- **Map safety.** The only `move_to` cards target START (index 0), which exists on every map.
  The official cards that advance to a fixed property became `move_relative` "reroute" cards.
- **Maps opt out of cards by their tiles,** not by a list. `isCardPlayableOnMap` (in the engine)
  drops a card that can't work on the map, such as nearest-company on Lucky Wheel, which has no
  companies. The filter runs before shuffling, so the rng stream depends only on the playable set.
- Decks are shared by all four maps. richup's decks are per-map and server-side, so they could not
  be copied even in principle.
- A deck is a shuffled order of card ids plus a rotating index in game state; drawing reads the
  card at the index and advances it.

`cards.test.ts` checks deck sizes, one pardon card per deck, unique deck-prefixed ids, that no text
contains Hasbro's word mark or card phrases, that `move_to` only targets START, and that no card uses
an out-of-scope effect.

## Future changes
