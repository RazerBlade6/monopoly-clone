# Chance & Community Chest Card Decks

Research lane: card decks for a web Monopoly clone modeled on richup.io.
Board index reference used throughout (standard US 40-space board, GO = 0, clockwise):

```
0 GO            10 Jail/Just Visiting  20 Free Parking   30 Go To Jail
1 Mediterranean 11 St. Charles Pl.     21 Kentucky       31 Pacific
2 COMMUNITY CH. 12 Electric Company    22 CHANCE         32 North Carolina
3 Baltic        13 States              23 Indiana        33 COMMUNITY CHEST
4 Income Tax    14 Virginia            24 Illinois       34 Pennsylvania Ave.
5 Reading RR    15 Pennsylvania RR     25 B&O RR         35 Short Line RR
6 Oriental      16 St. James           26 Atlantic       36 CHANCE
7 CHANCE        17 COMMUNITY CHEST     27 Ventnor        37 Park Place
8 Vermont       18 Tennessee           28 Water Works    38 Luxury Tax
9 Connecticut   19 New York Ave.       29 Marvin Gardens 39 Boardwalk
```

Chance spaces: **7, 22, 36**. Community Chest spaces: **2, 17, 33**.
Railroads: 5, 15, 25, 35. Utilities: 12 (Electric Company), 28 (Water Works). Jail: 10.

---

## Sourcing note (read before trusting any "verbatim" string)

Card text varies slightly between printings. This document uses the **2008–2021 US Standard ("Atlantic City") edition**, the version most clones copy.

Two of the most-linked list sites — monopolyland.com and zpag.net — both print the railroad card as *"pay **wonder** twice the rental"*. That is a typo propagated between them (they are not independent); the real word is **owner**. Corrected here against the Monopoly Wiki transcription of the physical cards.

Sources used:
- Official Hasbro rules PDF (Parker Brothers / Hasbro, PN 00009): https://www.hasbro.com/common/instruct/00009.pdf — rules of play, not card text (verified HTTP 200, text extracted).
- Monopoly Wiki, *Chance*: https://monopoly.fandom.com/wiki/Chance (fetched via https://web.archive.org/web/2024id_/https://monopoly.fandom.com/wiki/Chance — live site returned HTTP 402)
- Monopoly Wiki, *Community Chest*: https://monopoly.fandom.com/wiki/Community_Chest (via web.archive.org)
- MonopolyLand card list: https://www.monopolyland.com/list-monopoly-chance-community-chest-cards/
- zpag.net card list: https://www.zpag.net/Jeux/list_of_all_monopoly_Chance_Community_Chest.html
- richup.io production JS bundles (`https://richup.io/index.BAOd0zsy.js`, `https://richup.io/assets/GamePageContent-DcbcEFrO.js`), `https://richup.io/api/game/maps`, `https://richup.io/info` — fetched directly, see RICHUP section.

Any statement below that could not be confirmed by two sources is tagged **UNVERIFIED**.

---

## 1. CHANCE — 16 cards  [OFFICIAL] (US Standard Edition, 2008–2021)

`collect_go` = does the player receive $200 for passing GO during this movement?

| # | id | Verbatim text | Mechanical effect |
|---|----|---------------|-------------------|
| 1 | `chance_advance_boardwalk` | Advance to Boardwalk. | Move to index **39**. Forward-only. Pays GO salary only if the move crosses GO — which it never does from 7, 22 or 36, so in practice **no GO salary, ever**. Then resolve space normally (buy/auction, or pay rent). |
| 2 | `chance_advance_go` | Advance to Go (Collect $200). | Move to index **0**. Pay **$200**. Note the double-GO case in §4.8. |
| 3 | `chance_advance_illinois` | Advance to Illinois Avenue. If you pass Go, collect $200. | Move forward to index **24**. From Chance 7 → no pass; from 22 → no pass; from **36 → passes GO, collect $200**. Then resolve space. |
| 4 | `chance_advance_st_charles` | Advance to St. Charles Place. If you pass Go, collect $200. | Move forward to index **11**. From 7 → no pass; from **22 → passes GO, +$200**; from **36 → passes GO, +$200**. Then resolve space. |
| 5 | `chance_nearest_railroad_a` | Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled. | Move **forward** to the next index in {5,15,25,35}: from 7→**15**, 22→**25**, 36→**5** (**passes GO, +$200**). See §4.1 for owned/unowned/mortgaged. |
| 6 | `chance_nearest_railroad_b` | Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled. | Identical duplicate of #5. **Two physical copies exist** — the deck has 16 cards, of which 2 are this card. |
| 7 | `chance_nearest_utility` | Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times amount thrown. | Move **forward** to the next index in {12,28}: from 7→**12**, 22→**28**, 36→**12** (**passes GO, +$200**). See §4.2 — the 10× multiplier applies **regardless** of how many utilities the owner holds. |
| 8 | `chance_bank_dividend` | Bank pays you dividend of $50. | Collect **$50** from bank. |
| 9 | `chance_get_out_of_jail_free` | Get Out of Jail Free. This card may be kept until needed, or traded/sold. | Card is **removed from the Chance deck** and held by the player. See §4.5. |
| 10 | `chance_go_back_3` | Go Back 3 Spaces. | Move **backward 3**: 7→**4** (Income Tax, pay), 22→**19** (New York Ave.), 36→**33** (**Community Chest — draw a CC card**). Never passes GO (no Chance space is within 3 of GO). See §4.3. |
| 11 | `chance_go_to_jail` | Go to Jail. Go directly to Jail, do not pass Go, do not collect $200. | Move to index **10**, set `inJail = true`. **No GO salary.** Turn ends; doubles do not grant another roll. |
| 12 | `chance_repairs` | Make general repairs on all your property. For each house pay $25. For each hotel pay $100. | Pay bank **$25 × houses + $100 × hotels**. A hotel counts as 1 hotel, not 5 houses. See §4.4. |
| 13 | `chance_speeding_fine` | Speeding fine $15. | Pay bank **$15**. (Pre-2008 printings read "Pay Poor Tax of $15".) |
| 14 | `chance_trip_reading` | Take a trip to Reading Railroad. If you pass Go, collect $200. | Move forward to index **5**. From **7 → passes GO, +$200**; from **22 → passes GO, +$200**; from **36 → passes GO, +$200**. (All three Chance spaces are past index 5, so this card **always** pays $200.) Then resolve as a normal railroad landing (**single** rent, not double). |
| 15 | `chance_chairman_of_board` | You have been elected Chairman of the Board. Pay each player $50. | Pay **$50 to every other player still in the game**. See §4.7. |
| 16 | `chance_building_loan` | Your building loan matures. Collect $150. | Collect **$150** from bank. |

**Textual variants worth knowing** (do not mix into the table above):
- Card 1 in older US printings: *"Take a walk on the Boardwalk. Advance token to Boardwalk."* [OFFICIAL, pre-2008]
- Card 16 in older US printings: *"Your building and loan matures. Receive $150."* [OFFICIAL, pre-2008]
- Card 5/6 Monopoly-Wiki transcription reads *"pay owner twice the **rent** to which they are otherwise entitled"*; the list sites read *"twice the **rental**"*. Mechanically identical.
- UK/EU decks substitute Trafalgar Square (24), Mayfair (39), Pall Mall (11), Kings Cross Station (5), "Station" for "Railroad". [OFFICIAL, UK]
- Some 2021+ printings replace `chance_bank_dividend` with a **"MONEY GRAB!"** card (throw all $100 bills in the air, players race to catch them) — unimplementable online, **do not use**. [OFFICIAL, 2021+]

---

## 2. COMMUNITY CHEST — 16 cards  [OFFICIAL] (US Standard Edition, 2008–2021)

| # | id | Verbatim text | Mechanical effect |
|---|----|---------------|-------------------|
| 1 | `cc_advance_go` | Advance to Go (Collect $200). | Move to index **0**, pay **$200**. See §4.8 for the CC-at-index-2 double-GO case. |
| 2 | `cc_bank_error` | Bank error in your favor. Collect $200. | Collect **$200** from bank. |
| 3 | `cc_doctors_fee` | Doctor's fee. Pay $50. | Pay bank **$50**. |
| 4 | `cc_sale_of_stock` | From sale of stock you get $50. | Collect **$50** from bank. |
| 5 | `cc_get_out_of_jail_free` | Get Out of Jail Free. This card may be kept until needed or sold/traded. | Removed from the CC deck, held by player. See §4.5. |
| 6 | `cc_go_to_jail` | Go to Jail. Go directly to jail, do not pass Go, do not collect $200. | Move to index **10**, `inJail = true`, **no GO salary**, turn ends. |
| 7 | `cc_holiday_fund` | Holiday fund matures. Receive $100. | Collect **$100** from bank. (Pre-2008: "Xmas Fund matures. Collect $100.") |
| 8 | `cc_income_tax_refund` | Income tax refund. Collect $20. | Collect **$20** from bank. |
| 9 | `cc_birthday` | It is your birthday. Collect $10 from every player. | Collect **$10 from each other player still in the game**. See §4.7. |
| 10 | `cc_life_insurance` | Life insurance matures. Collect $100. | Collect **$100** from bank. |
| 11 | `cc_hospital_fees` | Pay hospital fees of $100. | Pay bank **$100**. (Older printings: "Hospital Fees. Pay $50.") |
| 12 | `cc_school_fees` | Pay school fees of $50. | Pay bank **$50**. (Older printings: "Pay school tax of $150.") |
| 13 | `cc_consultancy_fee` | Receive $25 consultancy fee. | Collect **$25** from bank. (Older printings: "Receive for services $25.") |
| 14 | `cc_street_repairs` | You are assessed for street repair. $40 per house. $115 per hotel. | Pay bank **$40 × houses + $115 × hotels**. Note the **odd $115** — it is correct, not a typo. See §4.4. |
| 15 | `cc_beauty_contest` | You have won second prize in a beauty contest. Collect $10. | Collect **$10** from bank. |
| 16 | `cc_inherit` | You inherit $100. | Collect **$100** from bank. |

**Note — the 2021 Community Chest rewrite** [OFFICIAL, 2021+]: In October 2021 Hasbro replaced the entire Community Chest deck with community-good-deed themed cards ("You help build a new school playground… COLLECT $100", "…FOR EACH HOUSE YOU OWN, PAY $40. FOR EACH HOTEL YOU OWN, PAY $115", etc.). The **mechanics are unchanged** — same amounts, same effect types, same 16-card structure — only the flavor text differs. If you want the modern feel, keep the effects above and swap the strings. Source: monopolyland.com and the Monopoly Wiki lists.

**Discontinued cards** (pre-2008, listed so you recognize them in other clones and do **not** implement them by accident): "Grand Opera Opening. Collect $50 from each player"; "Advance token to nearest Utility"; "Go back to Baltic Avenue"; "Go to Income Tax or Go To Jail"; "Pay a $10 fine or take a Chance"; "Pay your insurance premium $50"; "We're off the Gold Standard, collect $50"; "Everyone must donate 10% of his holdings to you in cash".

---

## 3. Structured deck data (JSON)

### Schema legend

Top level is a **flat array of 32 card objects** (16 `chance`, 16 `community_chest`).

| Field | Meaning |
|---|---|
| `id` | Stable string key. Duplicated physical cards get `_a` / `_b` suffixes. |
| `deck` | `"chance"` or `"community_chest"` |
| `text` | Verbatim printed text |
| `effect` | Object; `effect.type` selects the shape |

`effect.type` values:

| type | Fields | Semantics |
|---|---|---|
| `move_to` | `space` (int), `collect_go` (bool), `go_amount` (int, when collecting) | Move **forward** to an absolute index. `collect_go: true` means "pay salary if the move passes/lands on GO". For `space: 0` the salary is unconditional. After moving, **resolve the destination space normally**. |
| `move_relative` | `offset` (int, negative = backward), `collect_go` (bool) | Move by a signed offset. Backward movement **never** collects GO. Resolve destination normally, **including drawing another card**. |
| `move_to_nearest` | `group` (`"railroad"` \| `"utility"`), `collect_go` (bool), `if_owned` (obj), `if_unowned` (obj) | Move **forward** (never backward) to the next space of that group. |
| `move_to_nearest.if_owned` | `rent_multiplier` (int) \| `{roll_dice, dice_multiplier, override_normal_rent}` | Railroad: pay 2× the normal railroad rent for the owner's count. Utility: reroll and pay 10× the new roll, overriding the standard 4×/10× rule. |
| `move_to_nearest.if_unowned` | `may_buy` (bool), `price` (`"printed"`), `on_decline` (`"auction"`) | Player may buy from the bank at printed price; declining triggers an auction. |
| `collect` | `amount` (int), `from` (`"bank"`) | Bank pays player. |
| `pay` | `amount` (int), `to` (`"bank"`) | Player pays bank. |
| `pay_each_player` | `amount` (int) | Player pays `amount` to **each** other active player. |
| `collect_from_each_player` | `amount` (int) | Each other active player pays `amount` to the drawer. |
| `repairs` | `per_house` (int), `per_hotel` (int), `to` (`"bank"`) | Sum over all owned buildings. A hotel counts as exactly one hotel. |
| `get_out_of_jail_free` | `deck`, `tradeable` (bool), `return_on_use` (`"bottom"`) | Card leaves the deck and is held. |
| `go_to_jail` | `space` (int), `collect_go` (`false`), `ends_turn` (`true`) | Direct to jail. |

Optional per-card fields: `notes` (implementer hint), `duplicate_of` (for the second railroad card).

### JSON

```json
[
  {"id":"chance_advance_boardwalk","deck":"chance","text":"Advance to Boardwalk.","effect":{"type":"move_to","space":39,"collect_go":true,"go_amount":200},"notes":"Never pays in practice: no Chance space (7/22/36) reaches 39 by crossing GO. Flag kept true for schema consistency."},
  {"id":"chance_advance_go","deck":"chance","text":"Advance to Go (Collect $200).","effect":{"type":"move_to","space":0,"collect_go":true,"go_amount":200}},
  {"id":"chance_advance_illinois","deck":"chance","text":"Advance to Illinois Avenue. If you pass Go, collect $200.","effect":{"type":"move_to","space":24,"collect_go":true,"go_amount":200},"notes":"Only pays when drawn at space 36."},
  {"id":"chance_advance_st_charles","deck":"chance","text":"Advance to St. Charles Place. If you pass Go, collect $200.","effect":{"type":"move_to","space":11,"collect_go":true,"go_amount":200},"notes":"Pays when drawn at space 22 or 36."},
  {"id":"chance_nearest_railroad_a","deck":"chance","text":"Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.","effect":{"type":"move_to_nearest","group":"railroad","collect_go":true,"go_amount":200,"if_owned":{"rent_multiplier":2},"if_unowned":{"may_buy":true,"price":"printed","on_decline":"auction"}},"notes":"7->15, 22->25, 36->5 (passes GO)."},
  {"id":"chance_nearest_railroad_b","deck":"chance","text":"Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.","effect":{"type":"move_to_nearest","group":"railroad","collect_go":true,"go_amount":200,"if_owned":{"rent_multiplier":2},"if_unowned":{"may_buy":true,"price":"printed","on_decline":"auction"}},"duplicate_of":"chance_nearest_railroad_a"},
  {"id":"chance_nearest_utility","deck":"chance","text":"Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times amount thrown.","effect":{"type":"move_to_nearest","group":"utility","collect_go":true,"go_amount":200,"if_owned":{"roll_dice":true,"dice_multiplier":10,"override_normal_rent":true},"if_unowned":{"may_buy":true,"price":"printed","on_decline":"auction"}},"notes":"7->12, 22->28, 36->12 (passes GO). 10x applies even if the owner holds only one utility."},
  {"id":"chance_bank_dividend","deck":"chance","text":"Bank pays you dividend of $50.","effect":{"type":"collect","amount":50,"from":"bank"}},
  {"id":"chance_get_out_of_jail_free","deck":"chance","text":"Get Out of Jail Free. This card may be kept until needed, or traded/sold.","effect":{"type":"get_out_of_jail_free","deck":"chance","tradeable":true,"return_on_use":"bottom"}},
  {"id":"chance_go_back_3","deck":"chance","text":"Go Back 3 Spaces.","effect":{"type":"move_relative","offset":-3,"collect_go":false},"notes":"7->4 Income Tax, 22->19 New York Ave, 36->33 Community Chest (chained draw)."},
  {"id":"chance_go_to_jail","deck":"chance","text":"Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.","effect":{"type":"go_to_jail","space":10,"collect_go":false,"ends_turn":true}},
  {"id":"chance_repairs","deck":"chance","text":"Make general repairs on all your property. For each house pay $25. For each hotel pay $100.","effect":{"type":"repairs","per_house":25,"per_hotel":100,"to":"bank"}},
  {"id":"chance_speeding_fine","deck":"chance","text":"Speeding fine $15.","effect":{"type":"pay","amount":15,"to":"bank"}},
  {"id":"chance_trip_reading","deck":"chance","text":"Take a trip to Reading Railroad. If you pass Go, collect $200.","effect":{"type":"move_to","space":5,"collect_go":true,"go_amount":200},"notes":"Always passes GO from 7, 22 or 36. Pays SINGLE railroad rent, not double."},
  {"id":"chance_chairman_of_board","deck":"chance","text":"You have been elected Chairman of the Board. Pay each player $50.","effect":{"type":"pay_each_player","amount":50}},
  {"id":"chance_building_loan","deck":"chance","text":"Your building loan matures. Collect $150.","effect":{"type":"collect","amount":150,"from":"bank"}},

  {"id":"cc_advance_go","deck":"community_chest","text":"Advance to Go (Collect $200).","effect":{"type":"move_to","space":0,"collect_go":true,"go_amount":200}},
  {"id":"cc_bank_error","deck":"community_chest","text":"Bank error in your favor. Collect $200.","effect":{"type":"collect","amount":200,"from":"bank"}},
  {"id":"cc_doctors_fee","deck":"community_chest","text":"Doctor's fee. Pay $50.","effect":{"type":"pay","amount":50,"to":"bank"}},
  {"id":"cc_sale_of_stock","deck":"community_chest","text":"From sale of stock you get $50.","effect":{"type":"collect","amount":50,"from":"bank"}},
  {"id":"cc_get_out_of_jail_free","deck":"community_chest","text":"Get Out of Jail Free. This card may be kept until needed or sold/traded.","effect":{"type":"get_out_of_jail_free","deck":"community_chest","tradeable":true,"return_on_use":"bottom"}},
  {"id":"cc_go_to_jail","deck":"community_chest","text":"Go to Jail. Go directly to jail, do not pass Go, do not collect $200.","effect":{"type":"go_to_jail","space":10,"collect_go":false,"ends_turn":true}},
  {"id":"cc_holiday_fund","deck":"community_chest","text":"Holiday fund matures. Receive $100.","effect":{"type":"collect","amount":100,"from":"bank"}},
  {"id":"cc_income_tax_refund","deck":"community_chest","text":"Income tax refund. Collect $20.","effect":{"type":"collect","amount":20,"from":"bank"}},
  {"id":"cc_birthday","deck":"community_chest","text":"It is your birthday. Collect $10 from every player.","effect":{"type":"collect_from_each_player","amount":10}},
  {"id":"cc_life_insurance","deck":"community_chest","text":"Life insurance matures. Collect $100.","effect":{"type":"collect","amount":100,"from":"bank"}},
  {"id":"cc_hospital_fees","deck":"community_chest","text":"Pay hospital fees of $100.","effect":{"type":"pay","amount":100,"to":"bank"}},
  {"id":"cc_school_fees","deck":"community_chest","text":"Pay school fees of $50.","effect":{"type":"pay","amount":50,"to":"bank"}},
  {"id":"cc_consultancy_fee","deck":"community_chest","text":"Receive $25 consultancy fee.","effect":{"type":"collect","amount":25,"from":"bank"}},
  {"id":"cc_street_repairs","deck":"community_chest","text":"You are assessed for street repair. $40 per house. $115 per hotel.","effect":{"type":"repairs","per_house":40,"per_hotel":115,"to":"bank"}},
  {"id":"cc_beauty_contest","deck":"community_chest","text":"You have won second prize in a beauty contest. Collect $10.","effect":{"type":"collect","amount":10,"from":"bank"}},
  {"id":"cc_inherit","deck":"community_chest","text":"You inherit $100.","effect":{"type":"collect","amount":100,"from":"bank"}}
]
```

---

## 4. Tricky cards — explicit implementer rules

### 4.1 Nearest Railroad (×2) [OFFICIAL]

Destination table (movement is **always forward**, wrapping past GO):

| Drawn at | Goes to | Passes GO? |
|---|---|---|
| 7 | 15 (Pennsylvania RR) | no |
| 22 | 25 (B&O RR) | no |
| 36 | 5 (Reading RR) | **yes, +$200** |

- **Owned by another player, unmortgaged:** pay **2 × the normal railroad rent** for the number of railroads that owner holds. Normal rent is 25/50/100/200 for 1/2/3/4 railroads, so this card charges **50/100/200/400**.
- **Owned by another player, mortgaged:** *"If the property is mortgaged, no rent can be collected"* (Hasbro rules, MORTGAGES). Double of zero is **zero — pay nothing**. The card does not override the mortgage rule.
- **Owned by the drawing player:** move there, pay nothing.
- **Unowned:** the player **may buy it from the Bank at the printed price ($200)**. If they decline, *"the Banker sells it at auction to the highest bidder… Any player, including the one who declined the option to buy it at the printed price, may bid"* (Hasbro rules, PAYING). So: **decline → auction**, exactly as a normal landing.
- The **doubling applies only to this card**, not to `chance_trip_reading` (#14), which is a plain move.
- The deck contains **two identical copies**; give them distinct ids so the deck array has 16 entries.

### 4.2 Nearest Utility [OFFICIAL]

| Drawn at | Goes to | Passes GO? |
|---|---|---|
| 7 | 12 (Electric Company) | no |
| 22 | 28 (Water Works) | no |
| 36 | 12 (Electric Company) | **yes, +$200** |

- **Owned, unmortgaged:** the player **throws the dice again** and pays the owner **10 × the new throw**. This **overrides** the normal utility rule (4× with one utility, 10× with both). So even if the owner holds a single utility, the multiplier is **10×**, not 4×.
  - Implementer detail: the reroll is a *rent roll only* — it must **not** move the token and must **not** count toward the doubles / three-doubles-to-jail counter.
- **Owned, mortgaged:** no rent collected. Do not even roll. The official mortgage rule names utilities explicitly — *"No rent can be collected on mortgaged properties or utilities"* (Hasbro PN 00009, MORTGAGES) — so this is not an inference.
- **Unowned:** may buy at printed price ($150); decline → auction. **No dice are thrown at all** — the roll only exists to compute rent.
- **Owned by the drawing player:** move there, pay nothing, no roll.

### 4.3 Go Back 3 Spaces [OFFICIAL]

Only three landing positions are possible, because Chance appears only at 7, 22, 36:

| Drawn at | Lands on | What happens |
|---|---|---|
| 7 | **4 — Income Tax** | Pay the Income Tax space its configured amount (owned by the board-spaces research lane). Official amount **since Sept 2008: flat $200**. Pre-2008 (Hasbro PN 00009): the player chose **$200 or 10% of total worth**, deciding *before* totalling worth; total worth = cash + printed prices of all properties (mortgaged included) + cost price of all buildings. The 10% option is a **[HOUSE-RULE]** today. Sources: https://www.monopolyland.com/monopoly-income-tax-rules/ , https://monopoly.fandom.com/wiki/Income_Tax , https://www.hasbro.com/common/instruct/00009.pdf |
| 22 | **19 — New York Avenue** | Normal property landing: buy / auction / pay rent. |
| 36 | **33 — Community Chest** | **Draw a Community Chest card and resolve it.** This is a chained card draw; your resolution engine must be re-entrant. The drawn CC card can itself move the player again (e.g. `cc_advance_go`, `cc_go_to_jail`). |

- **GO is never involved.** No Chance space is within 3 spaces after GO, so a backward move can never cross GO. `collect_go` is structurally unreachable here, not merely set false.
- Backward movement does **not** pay a GO salary in any case — GO salary is only for passing GO in the direction of travel.
- Guard against infinite loops: a chained CC draw at 33 cannot produce another Go-Back-3 (that card is Chance-only), so the chain depth is bounded at 2.

### 4.4 Repairs / Street repairs [OFFICIAL]

Two different cards with **different amounts** — do not share a constant:

| Card | Per house | Per hotel |
|---|---|---|
| Chance — "Make general repairs on all your property" | **$25** | **$100** |
| Community Chest — "You are assessed for street repair" | **$40** | **$115** |

- Count buildings across **all** properties the player owns, all color groups.
- A **hotel is one hotel**, charged the hotel rate — it is *not* counted as 5 houses. A property at hotel level contributes `1 × per_hotel` and `0 × per_house`.
- **Mortgaged properties cannot hold buildings** (all buildings in the group must be sold before mortgaging), so there is no mortgage interaction. Properties with 0 houses contribute $0.
- Payment goes to the **Bank**, not to other players. If the player cannot pay, normal bankruptcy-to-bank rules apply (liquidate; if still short, assets go to the Bank and are auctioned).

### 4.5 Get Out of Jail Free [OFFICIAL]

Official text (Hasbro PN 00009, "CHANCE" AND "COMMUNITY CHEST"):
> *The "Get Out of Jail Free" card is held until used and then returned to the bottom of the deck. If the player who draws it does not wish to use it, he/she may sell it, at any time, to another player at a price agreeable to both.*

- On draw: the card is **removed from its deck** and held by the player. The deck temporarily has 15 cards.
- It is **tradeable and sellable** to another player, at any time, for any agreed price (and may be included in property trades).
- On use: the player leaves Jail immediately and for free; the card is returned **face down to the bottom of its own deck** — a Chance GOOJF returns to the Chance deck, a CC GOOJF to the CC deck. Track the source deck on the card object.
- Two such cards exist in the game (one per deck), and **one player can hold both**. richup's client models exactly this: each deck object carries a single `pardonCardHolderId`.
- Held cards transfer to the **creditor** when the holder goes bankrupt to another player; if bankrupt to the Bank, the card returns to the bottom of its deck. **UNVERIFIED** — the printed rules say a bankrupt player "must turn over to that player all that you have of value", which covers it by implication but does not name the card.

### 4.6 Go to Jail (both decks) [OFFICIAL]

- Move directly to index **10** with `inJail = true`. **Do not pay the GO salary** even though the move from 7/22/36 to 10 would otherwise wrap past GO for 22 and 36.
- The **turn ends immediately**. Even if the player arrived at the Chance/CC space by rolling doubles, they do **not** roll again.
- Do not resolve the Jail space as "Just Visiting".
- Being sent to jail by a card does **not** count as one of the three-doubles.

### 4.7 Pay each player / Collect from each player

- `chance_chairman_of_board`: **$50 to each** other player. With 4 players total, that is $150 out.
- `cc_birthday`: **$10 from each** other player.
- Only **players still in the game** count. Bankrupt/retired players are neither paid nor charged.
- **Teams:** if you implement richup-style teams, decide whether a teammate counts as "another player". Default to yes (per-player, not per-team). [HOUSE-RULE]
- **Bankruptcy mid-resolution** — the printed rules do **not** specify an order, so this is an implementation choice. [HOUSE-RULE] Recommended deterministic policy:
  1. **Collect-from-each:** charge players in clockwise seat order starting from the player to the drawer's left. If a payer cannot cover $10, they must liquidate (sell buildings, mortgage); if still short they go bankrupt **to the drawer**, handing over all assets. The drawer receives assets rather than the $10.
  2. **Pay-each:** compute the **full total first** ($50 × N). If the drawer cannot cover the total after liquidating, they are bankrupt. Distribute their remaining cash to creditors in clockwise seat order until it runs out; each creditor is capped at $50. Then the drawer retires. (Alternative common house rule: split remaining cash **pro-rata**. Pick one and document it.)
  3. Resolve the whole card as a single atomic transaction — do not let a mid-card bankruptcy change the set of players counted for the remaining payments.

### 4.8 The double-GO case [OFFICIAL]

From Hasbro PN 00009, "GO":
> *if a player passing GO on the throw of the dice lands 2 spaces beyond it on Community Chest, or 7 spaces beyond it on Chance, and draws the "Advance to GO" card, he/she collects $200 for passing GO the first time and another $200 for reaching it the second time.*

So a player who passes GO with a roll, lands on space **2** or space **7**, and draws Advance to Go collects **$400 total**. Your GO-salary logic must be per-movement, not once-per-turn.

---

## 5. Deck mechanics [OFFICIAL]

From Hasbro PN 00009:
> *PREPARATION: Place the board on a table and put the Chance and Community Chest cards facedown on their allotted spaces on the board.*
> *"CHANCE" AND "COMMUNITY CHEST": When you land on either of these spaces, take the top card from the deck indicated, follow the instructions and return the card facedown to the bottom of the deck.*

Rules for the implementation:

1. **Shuffle both decks once at game start.** Two independent 16-card decks, shuffled separately, placed face down.
2. **Draw from the top** of the indicated deck.
3. **Return to the bottom, face down**, after the card's instructions are fully resolved (including any chained draw and any auction it triggered).
4. **Exception — Get Out of Jail Free**: not returned. It leaves the deck and is held by the player; the deck shrinks to 15 until the card is used, at which point it goes to the **bottom**.
5. **The deck never runs out, so there is no reshuffle.** Return-to-bottom is a rotation, not a discard pile — after 16 draws the deck has cycled once and the order repeats. There is no official reshuffle-on-exhaustion rule because exhaustion cannot occur. Cards are effectively a fixed cyclic order determined by the opening shuffle.
   - Practical consequence: the order becomes **predictable** to attentive players after one cycle. Reshuffling after each full cycle is a common online variation. [HOUSE-RULE]
   - Implementation shape: store each deck as an array plus a `currentIndex` pointer; drawing = read at `currentIndex`, then `currentIndex = (currentIndex + 1) % deck.length`. This is exactly what richup.io does (see §6).
6. **Draws are per-landing.** Landing on a Chance space by any means (dice, card movement, Go Back 3) triggers a draw.
7. **Serialization**: persist the shuffled order + `currentIndex` + `pardonCardHolderId` per deck. That is the complete deck state.

---

## 6. RICHUP CARD DECK

**Summary: richup.io does NOT use Hasbro's card text. Deck size and per-card text could not be verified from public sources — marked UNVERIFIED. Do not copy Monopoly card strings into a richup-styled clone and claim they match.**

### What IS verified (fetched directly from richup.io production code, 2026-08-20)

| Finding | Evidence |
|---|---|
| The two decks are named **`treasure`** (= Community Chest) and **`surprise`** (= Chance). | `https://richup.io/index.BAOd0zsy.js` contains `const EN=["treasure","surprise"]`, used as `e.bonusCards[n]`. Corroborated by https://www.solitaireparadise.com/games_list/monopoly.html ("landing on a Treasure or Surprise space"). |
| Card spaces have block `type: "bonus"`. | Same bundle: `function Qwe(e){return e.type==="bonus"}` alongside `"city"`, `"airport"`, `"company"`, `"corner"`. |
| richup renames the whole vocabulary: **Railroad → "airport"**, **Utility → "company"**, **Property → "city"**, **Jail → "prison"**, **Free Parking → "vacation"**, **Go To Jail → "go-to-prison"**, **Get Out of Jail Free → "Pardon card"**. | Bundle: `e.type==="airport"`, `e.type==="company"`, `cornerType==="prison"` / `"vacation"` / `"go-to-prison"`; UI string: *"While in prison, you can use a Pardon card to get out of prison immediately, and for free."* |
| Deck state per deck = `{ pardonCardHolderId, currentIndex }`. | `https://richup.io/assets/GamePageContent-DcbcEFrO.js`: `n=[e.bonusCards.treasure,e.bonusCards.surprise].map(v=>({pch:v.pardonCardHolderId??null,ci:v.currentIndex}))` |
| → Therefore richup uses **exactly one Pardon card per deck** (a single holder id, not a count) and a **fixed-order deck with a rotating index**, i.e. the same draw-top / return-to-bottom cycle as the official rules. Deck **length** is not exposed client-side. | Same. |
| A player can hold **multiple** Pardon cards (one from each deck), and the UI pluralizes. | Bundle: `` e>1?`${e} Pardon cards`:"Pardon card" `` and `vEe(e,t){return EN.filter(n=>e.bonusCards[n].pardonCardHolderId===t)}` |
| Pardon cards **transfer to teammates on bankruptcy** in teams mode. | UI string: *"Your cash, properties, and pardon cards will transfer to your teammates."* |
| Multiple board maps exist (Classic, Mr. Worldwide, Death Valley, Lucky Wheel), and the blog states new maps ship **"new properties, surprise & treasure cards"** — i.e. **card decks are per-map**. | `https://richup.io/api/game/maps` returns those four ids; https://blog.richup.io/richup-v1-12/ |
| richup deliberately does **not** reuse Hasbro's copyrighted card wording. | https://richup.io/info : *"Copyright protects only the particular manner of an author's expression… Richup.io is an independent work and is not affiliated with… any third-party trademark holder."* |

### What could NOT be verified — UNVERIFIED

- **The verbatim text of any richup Surprise or Treasure card.**
- **The number of cards in each richup deck.**

Reason: richup's card content is entirely **server-side**. The client JS contains the deck *state* (`currentIndex`, `pardonCardHolderId`) but no card text and no effect-type enum — the rendered card string arrives over the game socket at draw time. Verified by exhaustive string extraction over `index.BAOd0zsy.js` (1.1 MB) and `GamePageContent-DcbcEFrO.js` (231 KB): zero hits for `advance`, `dividend`, `birthday`, `bank error`, `beauty`, `inherit`, `repairs`, or any card-like phrase. Public HTTP endpoints probed and rejected: `/api/game/maps/classic`, `/api/game/map/classic`, `/api/game/board/classic`, `/api/game/cards`, `/api/game/config`, `/api/game/settings` — all `{"error":"Not found"}`. `richup.io/info` and the blog (all 9 posts enumerated) contain no card list; searches of Reddit/YouTube/aggregators returned only reskin portals with no card text.

**To resolve this**, someone must observe a live game: join a richup.io room, land on Surprise/Treasure spaces (or spectate), and record the card text + the socket payload. That is the only reliable path and it needs a browser session, not HTTP fetches.
