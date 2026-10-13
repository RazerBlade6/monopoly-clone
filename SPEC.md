# v1 spec — rules the engine implements

Derived from `research/rules-edge-cases.md` §7 (30 numbered decisions). Only the ~13 that
gate the playable core are settled here; the rest concern auctions and mortgage, which are
**v2**. Numbers below are §7's numbering. Decisions 4, 5, 6, 13 and 30 were revised when
trades and the negative-balance debt model shipped (see "Debt" and "Trades" below).

## Scope

**In v1:** rooms + share link · roll/move/buy/rent · houses + hotels · jail · trades · bankruptcy · win.
**Out of v1:** auctions, mortgage, double-rent-on-full-set, bots, teams, turn clock.

The three out-of-scope *rules* still exist as `RoomSettings` flags (richup ships all three OFF
by default, so a default v1 game is rule-complete). The engine **rejects** actions for them.

## Settled decisions

| # | Decision |
|---|---|
| 1–3 | **Rent auto-collects** inside landing resolution. No claim window, no forfeiture, no decline. |
| 4 | **`RESOLVING_DEBT` is an explicit blocking phase.** Nobody rolls and the debtor can't end their turn until it clears. The debtor may sell buildings or properties, trade, or declare bankruptcy; everyone else may still trade, with the debtor included. |
| 5 | **No auto-bankruptcy.** A debtor who can't raise the money declares bankruptcy themselves (`declare_bankruptcy`). It is the same action as a voluntary concession and runs the same settlement routine. |
| 6 | **No rollback.** Building sales and trades made during `RESOLVING_DEBT` stand. Every dollar the debtor receives goes straight to the creditor(s) as it arrives. |
| 12 | **Asset mutation is gated.** Buying/selling buildings is legal only on your own turn in `AWAITING_ROLL`, `AWAITING_END_TURN`, or when you are the debtor in `RESOLVING_DEBT`. Never between a roll and its resolution. |
| 13 | **Multi-creditor debt pays in turn order** starting from the player to the debtor's left (`Debt.queued`). Whatever the debtor has, and later receives, pays the first creditor in full before the next sees a dollar. Creditors keep what they were paid if the debtor goes bankrupt, and are owed nothing more. A creditor who goes bankrupt is written off the queue. |
| 17 | Buyers of remaining houses have priority over hotel-breakers. A hotel breaks into 4 houses **only if the bank holds 4**; otherwise the only legal move is selling hotels across the whole group. |
| 18 | **Building supply is finite: 32 houses / 12 hotels.** `unlimitedBuildings` is an off-by-default toggle. A hotel purchase returns exactly 4 houses to the pool. |
| 21 | v1 has **no turn clock**. Disconnect sets `player.connected = false` and nothing else — the turn stays theirs. (Turn clock is v2.) |
| 27 | **Resolve the debt before moving the token.** Landing resolution completes, including any `RESOLVING_DEBT` excursion, before a forced move to jail. Debt amounts are snapshotted when incurred. |
| 28 | **Earnings Tax is 10% of net worth** (richup's rule), where net worth = cash + printed price of every property owned + purchase price of every building. The START salary is already in hand when tax resolves. `netWorthForTax()` is a separate function from any endgame valuation. |
| 29 | **Win = last player standing.** No timed mode in v1. |
| 30 | **Voluntary concession allowed** at any time, through the same bankruptcy routine. Bankruptcy never transfers anything to a player: buildings go back to the bank supply, every property becomes unowned again, and positive cash goes to the Bank. Conceding can't hand a leader anything. The `bankrupt` event's `creditor` is always `null`. |

## Debt

When a charge exceeds a player's cash (only ever the current player, during their own
landing), everything they have is paid over at once, in queue order, and their `cash` goes
negative by the remainder. While in debt `player.cash === -(debt.amount + Σ debt.queued)`,
where `debt.amount` is what is still owed to the current creditor. Money owed to the Bank
goes through the Vacation pot when `vacationCash` is on, as any other Bank payment does.

Income while in debt (building sales, trades) goes straight to the creditors, one helper
(`payDebtFromIncome`) for every path, emitting `paid` with `reason: 'debt'`. When the
balance reaches 0 the debt clears (`debt_cleared`) and the phase becomes what landing would
have left (`AWAITING_ROLL` after doubles, else `AWAITING_END_TURN`). Buying a house needs
cash ≥ its price, so a negative balance blocks it without a special case.

## Trades

Proposals carry cash, ownable tiles and pardon cards on each side (`TradeSide`). They are
legal in every phase except `LOBBY` and `GAME_OVER`, on anyone's turn, including during
`RESOLVING_DEBT` and `AWAITING_BUY`.

- Sender and recipient must be different, non-bankrupt players. Only the recipient accepts
  or declines, and only the proposer withdraws.
- Each side's cash is 0 to `max(0, cash)`, tiles are ones that side owns (no duplicates), and
  pardon cards are 0 to the number held. At least one side must contain something.
- A city can't be traded while any city in its country has a house or hotel. Airports and
  companies always can.
- One pending trade per ordered pair (A→B and B→A are different pairs).
- **Send limit:** 3 proposals per ordered pair per turn. Accepting a trade or countering
  one resets both directions of the pair, and a counter doesn't count against the limit.
  Every count resets when the turn passes to another player. A doubles re-roll is the same
  turn.
- **Counter-offer:** the recipient may propose back to the proposer with `counterOf`, which
  atomically replaces the original (`trade_cancelled` with reason `countered`).
- **Accept** re-validates everything against the live state, swaps the contents, and sends
  any cash the debtor receives through the pay-as-you-go helper. That is how a rescue clears
  a debt. Pending trades the swap made impossible are then dropped (reason `invalid`).
- Bankruptcy drops every trade involving that player (reason `bankrupt`), and `GAME_OVER`
  clears the rest. Trade ids are `trade-${n}` from a counter in state, so they need no rng.

**Anti-collusion** applies only to the current debtor's trades, judged from the debtor's
side, on propose and again on accept. Value = cash + printed property price +
`settings.jailFee` per pardon card.

| `antiCollusion` | A debtor's trade is allowed if |
|---|---|
| off (default, richup's rule) | cash in − cash out > 0 |
| on | cash in − cash out ≥ everything owed (it clears the debt), **or** value in ≥ value out |

## Constants the research could not recover from richup

richup keeps these server-side; grepping both bundles found no identifier for any of them
(`research/README.md`, "What nobody could verify"). These are our choices, not observations:

| Constant | v1 value | Basis |
|---|---|---|
| START salary | **$200** | Hasbro |
| Jail release fee | **$50** | Hasbro |
| Company rent multiplier | **4× / 10× / 20×** dice | Hasbro's two rungs; the 20× third rung is invented for Mr. Worldwide's third company, which has no Hasbro analogue |
| Card decks | our own | richup's are server-side and per-map; see §IP |

## Jail

Three ways out, checked in this order when the player is in jail at the start of their turn:
pay the fee · use a Pardon card · roll doubles. After **three** failed turns the player pays
the fee and moves. Rent is still collected while in jail unless `noRentInPrison` is on.

## Building rules

- Build only on a **complete country group** you own with no member mortgaged.
- `evenBuild` (default ON): a house may only be added to the tile with the fewest houses in
  the group, and removed from the tile with the most.
- Houses go 0→4, then a hotel replaces 4 houses.
- Selling returns **half** the purchase price.
- A **property** (city, airport or company) can be sold back to the bank for half its printed
  price, rounded down (`sell_property`), with the same timing as building sales (decision 12).
  A city can only be sold while no city in its country has a house or hotel. The tile becomes
  unowned, the cash comes from the bank (never the Vacation pot), a debtor's proceeds go
  straight to their creditors, and pending trades listing the tile are dropped.
- Group sizes are **2, 3, 4, 5 or 6** depending on map — read `map.countrySizes`, never assume 3.
  (Verified from the data: Death Valley is four groups of 5, 6, 6, 5.)

## Rent

- **City:** `rents[0]` bare · `rents[n]` with n houses · `rents[5]` with a hotel.
  With `doubleRentOnFullSet` on (v2, default off), `rents[0]` doubles when the owner holds the
  whole group undeveloped.
- **Airport:** `rents[ownedCount - 1]`, flat.
- **Company:** `diceTotal × settings.companyRentMultipliers[ownedCount - 1]`.
- No rent on a mortgaged property, or from a bankrupt owner.

## IP

Do not use the word "Monopoly" in any user-facing string, Hasbro's property names, Hasbro's
exact card text, or its board artwork. Mechanics are not protectable; the specific expression
is. Card decks are written fresh from the *effects* catalogued in `research/cards.md`.

## Determinism

The engine is a pure function: `reduce(map, state, playerAction, rng) → { state, events }`.
It performs no I/O, reads no clock, and calls no global `Math.random`. All randomness arrives
through an injected `rng: () => number`, so a game can be replayed from a seed and an action log.

## Module API (pinned — lanes build against these signatures)

```ts
// src/data/maps/index.ts
export function getMap(id: MapId): GameMap;
export const MAPS: Record<MapId, GameMap>;

// src/data/cards/index.ts
export function getDeck(deck: DeckId): Card[];
export function getCard(id: string): Card;

// src/engine/index.ts
export function createGame(map, players: {id,name,color}[], settings, rng): GameState;
export function reduce(map, state, pa: PlayerAction, rng): { state: GameState; events: GameEvent[]; error?: string };
// reduce REJECTS BY RETURNING `error`, never by throwing. On rejection it returns the
// same `state` reference, no events, and does not bump `version`. Callers must check
// `error`; a try/catch alone silently accepts every refused action.
export function legalActions(map, state, playerId): GameAction[];
```
