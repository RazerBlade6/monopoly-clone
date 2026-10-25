# Engine — `src/engine`

The rules engine: a pure function from a game state and an action to the next state and the
events that describe what happened. It holds every rule of the game and nothing else. It has
no I/O, no clock and no global randomness, and it never inspects who is connected.

## Status

Complete for v1: rooms start, players roll, move, buy, pay rent and tax, draw cards, build and
sell houses and hotels, sell property back to the bank, go to and leave prison, trade, fall into
debt, go bankrupt and win. Auctions, mortgages, double rent on a full set, the turn clock, teams,
bots and a timed end are **not implemented** (see [Deferred decisions](#deferred-decisions)).

181 tests across the repository pass; the engine's own suites are `turn`, `rent`, `building`,
`propertySale`, `cards`, `debt`, `trades` and `fullgame`.

## Architecture

### Public API (`index.ts`)

```ts
createGame(map, players: {id, name, color}[], settings, rng): GameState
reduce(map, state, { playerId, action }, rng): { state, events, error? }
legalActions(map, state, playerId): GameAction[]
```

- **`reduce` rejects by returning `error`, never by throwing.** On a rejection it returns the
  *same* `state` reference, no events, and does not bump `version`. Callers must check `error`;
  a `try/catch` alone silently accepts every refused action. (`result.ts` defines this shape.)
- **Determinism.** All randomness (dice, turn order, deck shuffles) comes through the injected
  `rng: () => number`, so a game is reproducible from its seed and action log.
- **`legalActions`** lists every concrete action a player could take now. `propose_trade` is the
  one action not listed, since its space of offers is unbounded; it is validated on arrival.
  The client uses this list to enable buttons, never to decide rules.

### Modules

| File | Responsibility |
|---|---|
| `reducer.ts` | `createGame`, `reduce`, action dispatch, roll / buy / jail fee / pardon / end turn / bankruptcy handlers, the asset-mutation gate |
| `landing.ts` | Everything after a token comes to rest: buy prompt, rent, tax, START and Vacation corners, card draws and card effects, sending to prison |
| `debt.ts` | `RESOLVING_DEBT`: opening a debt, paying it from income, bankruptcy settlement, `advanceTurn` (incl. Vacation skips), `phaseAfterLanding` |
| `buildings.ts` | Buy/sell house and hotel, even build, building supply, the hotel-break rule |
| `propertySale.ts` | `sell_property` back to the bank |
| `trades.ts` | Propose / counter / accept / decline / withdraw, send limits, anti-collusion, dropping trades that became invalid |
| `legal.ts` | `legalActions` |
| `state.ts` | Read-only queries and immutable update helpers; the **only** module that reaches into the board's shape |
| `rng.ts` | Dice and shuffling over the injected rng |
| `fixtures.ts` | Test fixtures, including a synthetic map with irregular group sizes |

Every landing path funnels through `resolveLanding` (normal moves, `move_to`, both directions of
`move_relative`). The one exception is `move_to_nearest`, which jumps straight to rent resolution
and only ever targets airports or companies. Rules about where a token lands belong in
`resolveLanding`, not in the movers.

### Phases

```
LOBBY → AWAITING_ROLL ⇄ AWAITING_BUY → AWAITING_END_TURN → (next player) AWAITING_ROLL
                         ↘ RESOLVING_DEBT ↗                      … → GAME_OVER
```

| Phase | Meaning |
|---|---|
| `LOBBY` | Before `start_game` (one seat is enough; solo play is only offered behind the client's developer switch) |
| `AWAITING_ROLL` | The current player rolls, or (in prison) pays the fee or uses a pardon |
| `AWAITING_BUY` | Landed on an unowned property: buy it, or pass by ending the turn / rolling again. There is no separate decline action |
| `RESOLVING_DEBT` | Blocking. Nobody rolls until the debtor's balance is back to 0 or they declare bankruptcy |
| `AWAITING_END_TURN` | Move resolved; the player may build, sell and trade, then end the turn |
| `GAME_OVER` | One player left; `winner` is set |

Every branch of landing resolution leaves the phase fully decided when it returns, so the
reducer never second-guesses it.

## Rules as implemented

Terminology follows richup: **city** (property), **airport** (railroad), **company** (utility),
**prison** (jail), **Vacation** (Free Parking), **pardon card** (Get Out of Jail Free),
**Treasure** / **Surprise** (Community Chest / Chance).

### Turn

- Roll two dice; doubles roll again. A third double in a row sends you to prison without moving.
- Passing START pays `startSalary` (200). Coming to rest exactly on START pays
  `startSalary + landOnStartBonus` (300 at defaults), logged as two `paid` events.
- Moving backwards (a card's "go back") never pays the salary. Coming to rest on START backwards
  would still pay `landOnStartBonus`; that is unreachable today (the only backward card moves 3,
  and three tiles after START is a city on every map), but re-check if a map ever puts a card tile
  there.

### Landing

- **Unowned property** → `AWAITING_BUY`. Building, selling and trading stay open while the
  offer stands, so a player can raise the money first.
- **Owned property** → rent is collected automatically, at once. No rent from a bankrupt owner,
  on your own tile, or (with `noRentInPrison`) while the owner is in prison.
- **Earnings Tax** → `taxPercentage` (10) % of net worth, rounded up. Net worth = cash + printed
  price of every property + purchase price of every building, with the START salary already in
  hand (`netWorthForTax`).
- **Premium Tax** → flat `taxAmount` (75). **Tax Refund** (Lucky Wheel only) → pays `taxAmount` (50).
- **Treasure / Surprise** → draw the top card of that deck and apply it. Card moves resolve the
  new tile exactly like any other landing.
- **Go to prison** corner → straight to prison, no salary.
- **Vacation** corner → the player sits out their next turn (`skipTurns = 1`, a `turn_skipped`
  event when it comes round). With `vacationCash` on, they also collect the whole Vacation pot.

### Rent

- **City:** `rents[0]` bare, `rents[n]` with *n* houses, `rents[5]` with a hotel.
- **Airport:** `rents[owned - 1]` (25 / 50 / 100 / 200).
- **Company:** dice total × `companyRentMultipliers[owned - 1]` (4× / 10× / 20×).
- Card moves to the nearest airport or company can override the multiplier.

### Prison

- Ways out at the start of your turn: pay `jailFee` (50), use a pardon card, or roll doubles.
- **Paying the fee ends the turn on the spot** — no roll and no build window that turn.
  Using a pardon card frees you and you roll as normal. (The two are deliberately asymmetric;
  only the paid case was reported in playtest.)
- Doubles out of prison move you but never grant a re-roll.
- After three failed turns you pay the fee and move. If you can't afford it, it becomes an
  ordinary bank debt and the turn simply ends once it clears.

### Building and selling

- Build only on a complete country group you own. Group sizes are 2–6 depending on the map;
  read `map.countrySizes`, never assume 3.
- `evenBuild` (default on): add a house only to the group's tile with the fewest, remove only from
  the one with the most. A hotel is level 5 on the same scale.
- Houses 0→4, then a hotel replaces the four houses (returning them to the bank).
- **Finite supply: 32 houses / 12 hotels** in `state.bank`, on every map, unless
  `unlimitedBuildings` is on.
- A hotel breaks back into 4 houses only if the bank holds 4; otherwise the only legal move is
  selling the hotels across the whole group (`sold_hotels_group`).
- Buildings sell back for half their price.
- **`sell_property`**: a property sells back to the bank for half its printed price (rounded down)
  and goes back on the market unowned. A city can only be sold while its country has no buildings.
  Pending trades listing the tile are dropped.
- **Asset gate:** buying or selling buildings or property is legal only on your own turn in
  `AWAITING_ROLL`, `AWAITING_BUY` or `AWAITING_END_TURN`, or as the debtor in `RESOLVING_DEBT`
  (selling only). Never between a roll and its resolution — which the engine guarantees anyway,
  since a roll resolves inside one `reduce` call.

### Debt and bankruptcy

- A charge you can't cover takes everything you have at once, in creditor order, and your cash goes
  **negative** by the remainder. While in debt, `cash === -(debt.amount + Σ debt.queued)`.
- `RESOLVING_DEBT` blocks the game. The debtor may sell buildings or property, trade, or declare
  bankruptcy; everyone else may still trade, with the debtor included.
- Every dollar the debtor receives goes straight to their creditors (`payDebtFromIncome`,
  `paid` with `reason: 'debt'`). At 0 the debt clears (`debt_cleared`) and the phase becomes what
  landing would have left.
- **Several creditors** (a "pay each player" card) are paid in turn order, starting from the
  debtor's left. Each is paid in full before the next sees a dollar. A creditor who goes bankrupt
  is written off the queue.
- **No auto-bankruptcy.** A hopeless debtor declares it (`declare_bankruptcy`), which is the same
  action as conceding at any other time.
- **Bankruptcy never enriches a player:** buildings return to the bank supply, every property
  becomes unowned, positive cash goes to the bank, pardon cards leave play with the player, and the
  `bankrupt` event's `creditor` is always `null`. Their pending trades are dropped.
- Sales and trades made while in debt stand; nothing is rolled back.
- **Win:** the last player standing.

### Vacation pot (`vacationCash`)

When on, money paid *to the bank* as a charge pools on the Vacation corner, and whoever lands there
collects it all. In: Earnings and Premium Tax, the prison fee (both paths), negative cards and
repairs, and debts owed to the bank. Out: buying property and buildings. Selling to the bank pays
from the bank, never the pot.

### Trades

- Each side offers cash, properties and pardon cards (`TradeSide`). Legal in every phase except
  `LOBBY` and `GAME_OVER`, on anyone's turn, including during debt and a pending purchase.
- Only the recipient accepts or declines; only the proposer withdraws. One pending trade per
  ordered pair. A city can't be traded while its country has buildings.
- **Send limit:** 3 proposals per ordered pair per turn; accepting or countering resets the pair;
  every count resets when the turn passes. A counter (`counterOf`) atomically replaces the original.
- **Accept** re-validates against the live state, swaps the contents, and routes cash a debtor
  receives through `payDebtFromIncome`. Trades the swap made impossible are dropped (`invalid`).
- **Anti-collusion** applies only to the current debtor's trades, judged from their side, on propose
  and again on accept. Value = cash + printed price + `jailFee` per pardon card.

| `antiCollusion` | A debtor's trade is allowed if |
|---|---|
| off (default, richup's rule) | cash in − cash out > 0 |
| on | cash in − cash out ≥ everything owed, **or** value in ≥ value out |

Whether to keep it off by default is still a group decision.

### Settings the engine reads

From `RoomSettings` (see [SHARED.md](SHARED.md) for the full type and defaults):
`startingCash`, `startSalary`, `landOnStartBonus`, `jailFee`, `companyRentMultipliers`,
`evenBuild`, `randomizePlayerOrder`, `vacationCash`, `noRentInPrison`, `unlimitedBuildings`,
`antiCollusion`. `mapId` and `maxPlayers` are the server's. **`auction`, `mortgage` and
`doubleRentOnFullSet` exist in the type and pass the server's validation, but nothing reads them
and the lobby doesn't show them.**

### Constants we chose

richup keeps these server-side and the research could not recover them, so they are our choices:

| Constant | Value | Basis |
|---|---|---|
| START salary | $200 | Hasbro |
| Landing-on-START bonus | $100 | Our choice, a flat amount rather than a ratio of the salary |
| Prison fee | $50 | Hasbro |
| Company multipliers | 4× / 10× / 20× | Hasbro's two rungs; the third invented for Mr. Worldwide's third company |
| Card decks | our own | richup's are server-side; see [DATA.md](DATA.md) |

## Decisions

Numbering follows the 30 open questions the research identified (the analysis behind each lives in
`research/rules-edge-cases.md` §1–§6). Decision 31 is ours.

### Settled

| # | Decision |
|---|---|
| 1–3 | **Rent auto-collects** during landing. No claim window, no forfeiture, no decline. |
| 4 | **`RESOLVING_DEBT` is an explicit blocking phase**; debtor sells, trades or declares bankruptcy; others may trade with them. |
| 5 | **No auto-bankruptcy.** Declaring is the same action as conceding. |
| 6 | **No rollback** of sales or trades made while in debt; income goes straight to creditors. |
| 9 | Percentages round **up** to the dollar (Earnings Tax). |
| 11 | Trades may be proposed and accepted in any running phase; acceptance re-validates against live state. |
| 12 | **Asset mutation is gated** to your own turn (or debt), never between a roll and its resolution. |
| 13 | **Multi-creditor debt pays in turn order** from the debtor's left. |
| 17 | Hotel-break needs 4 houses in the bank; otherwise sell across the group. |
| 18 | **Finite supply 32 / 12**, `unlimitedBuildings` off by default. |
| 19–20 | Only a debtor's trades are policed (`antiCollusion`); solvent players may make any trade. |
| 21 | **No turn clock.** Disconnecting sets `connected = false` and nothing else. |
| 27 | **Resolve the debt before a forced move** to prison; debts are snapshotted when incurred. |
| 28 | **Earnings Tax = 10% of net worth**, salary already in hand; `netWorthForTax` is its own function. |
| 29 | **Win = last player standing.** No timed mode. |
| 30 | **Concession allowed at any time**, through the same settlement; bankruptcy never transfers anything to a player. |
| 31 | **No decline action** on an unowned property: buy it, or carry on (end turn / roll again). |

Playtest round 1 (all fixed) added: paying the prison fee ends the turn; landing on START pays the
bonus; the Vacation pot fills and pays out; Vacation costs the next turn.

### Deferred

These belong to auctions, mortgages and the other v2 features. Each lists the research's
recommendation, which is a starting point, not a commitment.

| # | Question | Research recommendation |
|---|---|---|
| 7, 8, 10 | Mortgage interest on received/auctioned property | 10% of the mortgage value; creditor who can't pay enters debt; auction bankrupt estates unmortgaged |
| 14 | Auction winner can't pay | Reject bids above cash + liquidation value; above cash → debt to the bank |
| 15 | Auction format | Open at $1, $1 increments, per-bid countdown ~10–15 s; no bids → stays unowned |
| 16 | Housing-shortage auction | Bidder names the target property; floor is its house price |
| 22 | Building with a mortgaged group member | Forbid |
| 23 | Double rent with a mortgaged member | Yes; set completeness comes from ownership, not mortgage state |
| 24 | Pardon cards on bankruptcy | To a player: transfer. To the bank: back to the bottom of its deck |
| 25–26 | Bankruptcy auctions | Board order, blocking, run from a work queue |
| 29 (timed) | Timed / turn-capped mode | Score with the Short Game valuation (half value for mortgaged property) |
| 21 (clock) | Turn clock | richup's refilling clock; on expiry roll and end the turn, never bid or mortgage |

## Testing

`npx vitest run`. The full-game test plays seeded games to `GAME_OVER` and checks two invariants
throughout: cash is conserved (bank-sourced minus bank-sunk money matches every `paid` event) and
buildings are conserved (bank plus board always equals the supply). If a rule change stops the seed
from finishing inside the step cap, swap the seed after checking convergence across many seeds;
don't change the rules to fit the test.

When a change alters a rule, update the assertions that encoded the old rule and add a test for the
new one. Don't delete a test to make the suite pass.

## Future changes
