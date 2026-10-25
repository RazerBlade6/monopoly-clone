# Shared contract — `src/shared/types.ts`

The one file every other part builds against: board data, cards, room settings, game state,
actions, events and the WebSocket messages. It has no logic except `DEFAULT_SETTINGS`.

## Status

Stable. Every type below is implemented end to end. Changes are deliberate and made in one place
before any dependent work starts, so the engine, server and client always agree on names.

## Design rules

- **This file is the authority on names.** It uses camelCase. The research files carry richup's
  tile schema in two casings (live React props and a snake_case JSON block); the data layer
  transforms them into these names rather than copying keys.
- **Nothing assumes a board shape.** `GameMap.tiles` is 40 or 48 long; `countrySizes` holds group
  sizes of 2 to 6. Indices for START, prison and go-to-prison are fields, never constants.
- **Every action carries who sent it** (`PlayerAction.playerId`), and the server sets that from the
  socket, not from the message.
- **Changing it.** Add the field or variant here first, update every fixture that builds the type,
  and give old persisted data a default (the server merges `DEFAULT_SETTINGS` over stored settings,
  so a new setting needs a default here). The `paid` event's `reason` is a free string, so a new
  reason needs no type change.

## Contents

### Board data

- `MapId`: `classic`, `mr-worldwide`, `death-valley`, `lucky-wheel`.
- `CountryId`: the 14 countries that name the city groups.
- `Tile`, a union on `type`:
  - `corner` with `subtype` `start` · `jail` · `free_parking` · `go_to_jail`
  - `city` with `countryId`, `price`, six `rents`, `housePrice`, `hotelPrice`
  - `airport` with `price` and four `rents`
  - `company` with `price` only
  - `bonus` with `bonusType` `treasure` · `surprise` (card draws), `tax` (with `taxPercentage`),
    or `premium-tax` · `tax-refund` (with `taxAmount`)
- `GameMap`: `id`, `name`, dense `tiles`, derived `startIndex` / `jailIndex` / `goToJailIndex`, and
  `countrySizes`.

### Cards

`DeckId` (`treasure`, `surprise`), `Card` (`id`, `deck`, original `text`, `effect`) and
`CardEffect`: `money`, `money_from_each`, `move_to`, `move_relative`, `move_to_nearest`,
`go_to_jail`, `pardon`, `repairs`.

### Room settings

| Setting | Default | Notes |
|---|---|---|
| `mapId` | `classic` | |
| `startingCash` | 1500 | |
| `maxPlayers` | 8 | |
| `evenBuild` | on | |
| `randomizePlayerOrder` | on | |
| `vacationCash` | off | Bank payments pool on Vacation |
| `noRentInPrison` | off | |
| `unlimitedBuildings` | off | Otherwise 32 houses / 12 hotels |
| `antiCollusion` | off | Off is richup's rule for a debtor's trades |
| `startSalary` | 200 | |
| `landOnStartBonus` | 100 | Extra on landing exactly on START |
| `jailFee` | 50 | |
| `companyRentMultipliers` | [4, 10, 20] | By companies owned |
| `doubleRentOnFullSet`, `auction`, `mortgage` | off | v2: accepted but not implemented |

### Game state

- `Player`: `id`, `name`, `color`, `cash` (negative while in debt), `tileIndex`, `inJail`,
  `jailTurns`, `pardonCards`, `skipTurns`, `bankrupt`, `connected`; lobby-only `removeInMs`, and
  `dummyOf` for seats driven by another player.
- `Ownership` per tile: `owner`, `houses` (0–4), `hotel`, `mortgaged` (always false in v1).
- `Phase`: `LOBBY`, `AWAITING_ROLL`, `AWAITING_BUY`, `RESOLVING_DEBT`, `AWAITING_END_TURN`,
  `GAME_OVER` (see [ENGINE.md](ENGINE.md)).
- `Debt`: `debtor`, `amount`, `creditor` (null = bank) and `queued` follow-on debts.
- `Trade` / `TradeSide`: proposer `from`, recipient `to`, and each side's cash, tiles and pardon cards.
- `GameState`: `version`, `mapId`, a `settings` snapshot, `players`, `turnOrder`,
  `currentPlayerIndex`, `tiles`, `bank` supply, `decks` (order + index), `phase`, `debt`,
  `doublesCount`, `lastRoll`, `vacationPot`, `winner`, pending `trades`, `tradeSendCounts`,
  `nextTradeId`.

### Actions

`start_game`, `roll`, `buy`, `buy_house`, `sell_house`, `buy_hotel`, `sell_hotel`,
`sell_property`, `pay_jail_fee`, `use_pardon`, `end_turn`, `declare_bankruptcy`, `propose_trade`
(with optional `counterOf`), `accept_trade`, `decline_trade`, `cancel_trade`.

### Events

The engine's record of what happened, used for the log and for animation:
`game_started`, `rolled`, `moved` (with `from`, `to`, `passedStart`), `paid`, `bought`, `built`,
`property_sold`, `card_drawn`, `jailed`, `left_jail`, `debt_opened`, `debt_cleared`, `bankrupt`,
`turn_skipped`, `turn_ended`, `game_over`, `trade_proposed`, `trade_accepted`, `trade_declined`,
`trade_cancelled`.

`paid` reasons in use: `start_salary`, `start_bonus`, `rent`, `earnings_tax`, `premium_tax`,
`tax_refund`, `card`, `money_from_each`, `repairs`, `jail_fee`, `bought_property`, `bought_house`,
`bought_hotel`, `sold_house`, `sold_hotel`, `sold_hotels_group`, `debt`, `vacation_pot`,
`bankruptcy_settlement`. (Selling a property is its own `property_sold` event.)

### Transport

- `ClientMessage`: `join`, `leave`, `add_dummy`, `remove_player`, `update_settings`, `action`.
- `ServerMessage`: `joined` (your id, token and the room), `room` (lobby roster), `state`,
  `events` (with the state `version`), `error` (with `code: 'unknown_token'` when a stored
  identity is dead).
- `RoomMeta`: `code`, `hostId`, `settings`, `started`.

See [SERVER.md](SERVER.md) for how these flow.

## Future changes
