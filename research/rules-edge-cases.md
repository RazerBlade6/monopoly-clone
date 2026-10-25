# Monopoly Rules Edge Cases — Bankruptcy, Insolvency, Trading & Ambiguity

Research lane: every ambiguous situation a digital implementer must resolve deterministically.
Target: a web Monopoly clone modeled on richup.io.

**Tag legend**

| Tag | Meaning |
| --- | --- |
| `[OFFICIAL]` | Printed in a Hasbro / Parker Brothers / Winning Moves rulebook, or a direct Hasbro ruling. |
| `[RICHUP-DEFAULT]` | Richup.io behavior that is not configurable (or is the shipped default). |
| `[RICHUP-TOGGLE]` | A named room setting in richup.io's `update-game-room` schema. |
| `[HOUSE-RULE]` | Not in any rulebook — common table practice or tournament practice. |
| `UNVERIFIED` | Could not be confirmed from a primary source. Treat as a guess. |

**Tag qualifiers** (the bare tag alone would overstate the source, so these refinements are used throughout):

| Qualifier | Meaning |
| --- | --- |
| `[OFFICIAL]`-by-inference | Not printed, but forced by printed text elsewhere in the same rulebook. |
| `[OFFICIAL]` by absence | **No rule exists.** There is nothing to enforce — only an affordance not to build. |
| `[OFFICIAL]` by construction | Legal because the printed rules combine to permit it, not because they name it. |
| `[OFFICIAL]`-literal | What the printed words say when read strictly, including where that is clearly unintended. |
| `[OFFICIAL]` reading / `[HOUSE-RULE]` interpretation | A cited adjudication of genuinely ambiguous printed text, not the text itself. |
| `[OFFICIAL]` — conflict | Two printings state opposite rules. Both cited; you must choose. |

---

## 0. Primary sources used

| # | Source | What it is | URL |
| --- | --- | --- | --- |
| **S1** | Parker Brothers rulebook, footer `40009-I-Rev 2` (© 1935…1997) | **The canonical Hasbro-hosted rules PDF.** All verbatim quotes below are taken from this text unless noted. Includes the official Short Game and Time Limit Game variants. | https://www.hasbro.com/common/instruct/monins.pdf |
| **S2** | Hasbro/Parker Brothers rulebook, footer `00009-1` (© 2004, 2007) | The Speed Die printing. Text of BANKRUPTCY / MORTGAGES / SELLING PROPERTY / BUILDING SHORTAGES is **word-for-word identical** to S1. **Do not quote from this file directly** — the hosted PDF is a bad scan and OCRs Income Tax as "$900" (it is $200) and mangles headings. | https://www.hasbro.com/common/instruct/00009.pdf |
| **S3** | Winning Moves Games, *MONOPOLY Game Rules of Play, Standard Edition* (current retail printing) | Third printing. Reworded ("buildings" for "houses and hotels", "penalties" for "taxes and penalties") but **rules-identical** on every point in this document. | https://winning-moves.com/images/monorulesclassicV2.pdf |
| **S4** | richup.io client bundle `/assets/index-BliZ6Xms.js` → `/index.BAOd0zsy.js` | Primary source for richup's room-settings schema and default object (extracted 2026-08-20). | https://richup.io/index.BAOd0zsy.js |
| **S5** | Richup blog changelog | v1.12 (even build), v1.16 (teams), v1.17 (turn clock + anti-collusion trade rule). | https://blog.richup.io/ |
| **S6** | boardgames.stackexchange, Monopoly tag | Adjudicated edge cases. Individual answer URLs cited inline. | https://boardgames.stackexchange.com/questions/tagged/monopoly |

> **Note on "printings differ".** For every rule in this document, S1, S2 and S3 agree. Where a genuine
> printing conflict exists it is called out explicitly (there is exactly one: double rent with a mortgaged
> group member — see §5.4).

---

## 1. BANKRUPTCY

### 1.1 The definition and the forced-liquidation sequence

> "You are declared bankrupt if you owe more than you can pay either to another player or to the Bank."
> — S1, BANKRUPTCY `[OFFICIAL]`

> "Should you owe the Bank … more than you can pay (because of taxes or penalties) **even by selling off
> buildings and mortgaging property**, you must turn over all assets to the Bank."
> — S1, BANKRUPTCY `[OFFICIAL]`

The bolded clause is the only statement of the liquidation sequence in the rulebook. Expanded, the debtor's
legal cash-raising moves are:

1. **Cash on hand.** `[OFFICIAL]`
2. **Sell buildings back to the Bank at half the price paid.** `[OFFICIAL]` — "Houses and hotels may be sold
   back to the Bank at any time for one-half the price paid for them." (S1, SELLING PROPERTY). Must come down
   **evenly, in reverse of the order built** (S1). A hotel counts as five houses when broken down one at a time.
3. **Mortgage unimproved properties** for the printed mortgage value. `[OFFICIAL]` — buildings on *any* property
   of the color group must be sold first (S1, MORTGAGES).
4. **Sell properties to other players at any agreed price** — including to the creditor. `[OFFICIAL]` by
   inference from SELLING PROPERTY; see §3.3 for the timing ambiguity.
5. Only if the debt still cannot be met: **declare bankruptcy.**

**Selling property back to the Bank is not step 5.** There is no such rule — see §3.5.

**Rollback if liquidation fails.** The rules never say whether mortgages/trades taken during a doomed
liquidation stand or unwind. Two competing SE answers:
- "You are supposed to restore the *status quo ante* … hand over your property to your creditor as they *were*"
  — https://boardgames.stackexchange.com/a/24447 `[HOUSE-RULE]`
- "any and all attempted transactions are contingent on … avoiding bankruptcy … otherwise the trustee will not
  approve the transactions" — https://boardgames.stackexchange.com/a/24451 `[HOUSE-RULE]`

Both are house rules. See Decision #6.

### 1.2 Bankruptcy TO A PLAYER

> "If your debt is to another player, you must turn over to that player all that you have of value and retire
> from the game. In making this settlement, if you own houses or hotels, you must return these to the Bank in
> exchange for money to the extent of one-half the amount paid for them; **this cash is given to the creditor**."
> — S1, BANKRUPTCY `[OFFICIAL]`

So, unambiguously:

| Asset | Where it goes |
| --- | --- |
| Cash | Creditor `[OFFICIAL]` |
| Unmortgaged properties (title deeds) | Creditor `[OFFICIAL]` |
| Mortgaged properties (title deeds) | Creditor, **still mortgaged** `[OFFICIAL]` |
| Houses & hotels | **Sold to the Bank at half price first; the *cash* goes to the creditor.** `[OFFICIAL]` |
| Get Out of Jail Free cards | Creditor — inference from "all that you have of value"; cards have a market price under the rules, so they are "of value". Not stated explicitly. `[OFFICIAL]`-by-inference, see https://boardgames.stackexchange.com/a/22830 |

**Answering the task's question directly: yes — buildings are always sold to the Bank at half price, even when
bankrupting to a player.** The creditor never receives houses or hotels, only the cash from their forced sale.
`[OFFICIAL]` (S1, S2, S3 all identical). This matters for the building supply: a bankruptcy always returns
buildings to the pool.

### 1.3 The mortgaged-property fee on transfer — exact rule, and a correction

The task brief describes this as a choice between "pay the 10% fee immediately, or unmortgage in full
immediately," differing by printing. **That framing is wrong, and the distinction is real but is between two
different rulebook sections, not between two printings.** All three sourced printings (S1, S2, S3) carry the
same wording in both sections. No printing with alternative bankruptcy wording was found — `UNVERIFIED`.

**(a) On BANKRUPTCY transfer — the 10% is MANDATORY and IMMEDIATE:** `[OFFICIAL]`

> "If you have mortgaged property you also turn this property over to your creditor but **the new owner must at
> once pay the Bank the amount of interest on the loan, which is 10% of the value of the property**. The new
> owner who does this may then, **at his/her option**, pay the principal or hold the property until some later
> turn, then lift the mortgage. If he/she holds property in this way until a later turn, he/she must pay the
> interest again upon lifting the mortgage." — S1, BANKRUPTCY

**(b) On a VOLUNTARY SALE / TRADE — the buyer gets a genuine choice:** `[OFFICIAL]`

> "However, the owner may sell this mortgaged property to another player at any agreed price. If you are the new
> owner, **you may lift the mortgage at once if you wish** by paying off the mortgage plus 10% interest to the
> Bank. **If the mortgage is not lifted at once, you must pay the Bank 10% interest when you buy the property**
> and if you lift the mortgage later you must pay the Bank an additional 10% interest as well as the amount of
> the mortgage." — S1, MORTGAGES

**The consequence, stated as arithmetic** (let `M` = mortgage value, `V` = printed price; note the rulebook says
"10% of the value of the property" in BANKRUPTCY and "10% interest" on the mortgage in MORTGAGES — in practice
every table and every implementation reads both as **10% of `M`**; the discrepancy is `UNVERIFIED` and see
Decision #8):

| Route | Cost to end up owning it unmortgaged |
| --- | --- |
| Trade, lift at once | `M + 0.10M` — **one** 10% |
| Trade, lift later | `0.10M` now, then `M + 0.10M` later — **two** 10%s |
| Bankruptcy transfer, lift immediately after | `0.10M` (forced) + `M + 0.10M` — **two** 10%s, unavoidable |
| Bankruptcy transfer, never lift | `0.10M` (forced), property stays mortgaged and earns no rent |

**A bankruptcy transfer therefore always costs the creditor at least one un-avoidable 10% fee per mortgaged
property, and always costs two 10%s if they ever unmortgage it.** This is a strictly worse deal than buying the
same property in a negotiated trade. Implementations that let the creditor "lift at once for M+10%" are giving
away a fee that the rules charge.

**Edge case with no official answer: what if the creditor cannot afford the mandatory 10%?** The rulebook makes
the payment compulsory and immediate but never contemplates failure. By the plain definition of bankruptcy —
"you owe more than you can pay" — the creditor is now bankrupt to the Bank. See
https://boardgames.stackexchange.com/questions/50930 (a creditor may avoid this by **declining to collect the
rent at all**, since the rules give the owner the right but no obligation to ask —
https://boardgames.stackexchange.com/a/53757 `[HOUSE-RULE]`; note this conflicts with
https://boardgames.stackexchange.com/a/7899 which reads "the owner collects rent from you" as non-optional
`[OFFICIAL]`). See Decision #7.

### 1.4 Bankruptcy TO THE BANK

> "…you must turn over all assets to the Bank. In this case, **the Bank immediately sells by auction all
> property so taken, except buildings**. A bankrupt player must immediately retire from the game."
> — S1, BANKRUPTCY `[OFFICIAL]`

Resolution, in order:

1. Cash → Bank. `[OFFICIAL]`
2. Buildings → back to the supply (they are explicitly excluded from the auction). `[OFFICIAL]`
3. **Every property is auctioned, one at a time, immediately, to the highest bidder.** `[OFFICIAL]` — Hasbro
   consumer-support ruling obtained and quoted at
   https://boardgames.stackexchange.com/a/50491 : *"Are all of the properties auctioned off at once as a single
   lot? **No. All properties should be auctioned off one at a time.** … In what order? **No specific order
   needed. The banker can randomly select.**"* (Hasbro speaking directly, but a support email, not printed text.)
4. Get Out of Jail Free cards → returned to the bottom of their deck. **Not stated in the rulebook**; inferred
   from "The 'Get Out of Jail Free' card is held until used and then returned to the bottom of the deck"
   (S1, CHANCE AND COMMUNITY CHEST). `[HOUSE-RULE]` / `UNVERIFIED` as to the bankruptcy case specifically.

**Are the auctioned properties mortgaged or clear?** The rulebook is silent. The top SE answer argues the Bank
writes off its own mortgage loan and sells them clear:
https://boardgames.stackexchange.com/a/20454 `[HOUSE-RULE]`. A competing answer agrees the Bank "gets to
unmortgage your property for free": https://boardgames.stackexchange.com/a/20461 `[HOUSE-RULE]`. See Decision #10.

**Same Hasbro ruling covers auction mechanics** (https://boardgames.stackexchange.com/a/50491) `[OFFICIAL]`:
- *"There is no minimal bid so the starting price will always be $1."*
- *"The price is binding. So if a player bids more than they have they can unintentionally bankrupt themselves."*
- *"The auctioned property cannot be mortgaged by the highest bidder in order to complete the purchase."*
- *"All players can participate … this includes the banker, any players who may be in jail, and the person who
  originally declined to purchase the property."*

### 1.5 Winner condition

> "The last player left in the game wins." — S1, BANKRUPTCY `[OFFICIAL]`

**Official timed / point-scoring variants — yes, two, both printed in S1:**

**RULES for a SHORT GAME (60–90 minutes)** `[OFFICIAL]`
> "5. END OF GAME: The game ends when **one player goes bankrupt**. The remaining players value their property:
> (1) cash on hand; (2) lots, utilities and railroads owned, **at the price printed on the board**; (3) any
> mortgaged property owned, **at one-half the price printed on the board**; (4) houses, **valued at purchase
> price**; (5) hotels, valued at purchase price **including the value of the three houses turned in**. The
> richest player wins!"
> (Also: 3 title deeds dealt free at start; only **three** houses needed before a hotel; Income Tax is a flat
> $200; you may attempt doubles *and then* pay $50 in the same jail turn.)

**TIME LIMIT GAME** `[OFFICIAL]`
> "Before starting, agree upon a definite hour of termination, when **the richest player** will be declared the
> winner. Before starting, the Banker shuffles and cuts the Title Deed cards and deals two to each player.
> Players immediately pay the Bank the price of the properties dealt to them."
> (Note the Time Limit Game does not restate a valuation formula; the Short Game's 5-item list is the only
> printed net-worth definition and is the natural one to reuse — `[HOUSE-RULE]` to apply it here.)

**Richup:** the standard win condition is last-player-standing. In **Teams Mode**, "The last team standing wins
together" and "**If a teammate bankrupts, everything they own passes to a surviving teammate**"
`[RICHUP-TOGGLE]` (`teams.enabled`) — https://blog.richup.io/richup-v1-16-introducing-teams-mode/

---

## 2. MID-GAME MONEY & PROPERTY

### 2.1 The Bank never runs out of money

> "The Bank never 'goes broke.' If the Bank runs out of money, the Banker may issue as much more as may be needed
> **by writing on any ordinary paper**." — S1, THE BANK `[OFFICIAL]`

**Implementation:** bank cash is unbounded. Do not model it. `[RICHUP-DEFAULT]` — richup's settings schema has
no bank-cash field, and its only cash knob is `startingCash` (S4).

Note the asymmetry: **money is infinite, buildings are not.** The 32 houses / 12 hotels are the game's only
genuinely scarce resource and the entire late-game shortage strategy depends on that scarcity being enforced
(§4). Richup's finiteness of the building supply is `UNVERIFIED` (no house/hotel count appears in the client
bundle chunks that were readable).

### 2.2 Loans between players — forbidden

> "MISCELLANEOUS… Money can be loaned to a player **only by the Bank** and then only by mortgaging property.
> **No player may borrow from or lend money to another player.**" — S1 `[OFFICIAL]`

Verbatim-identical in S2 and S3. This forbids: IOUs, "pay me back next turn", "I'll cover your rent for a cut of
your future income", and every rent-immunity-for-consideration arrangement structured as a debt. See
https://boardgames.stackexchange.com/a/14353 — *"Any exchange of money for future considerations is a form of
loan."* `[OFFICIAL]` reading.

### 2.3 Gifts and cash-for-free — the rules do *not* prohibit them

**The task brief says "official: no." That is not what the rulebook says.** Loans are forbidden; gifts are
simply **not addressed**. And the rules supply a fully legal laundering route:

> "Another way to give money to another player is to **sell them an unimproved property for $0, then buy it
> back for the amount you wish to give them**. This is allowed by a different rule: *Unimproved properties,
> railroads and utilities … may be sold to any player as a private transaction for any amount…*"
> — https://boardgames.stackexchange.com/a/7899 (accepted) `[OFFICIAL]` by construction

So: `[OFFICIAL]` an outright cash gift is **not prohibited** (absence of a rule, not permission); `[OFFICIAL]`
the $0-trade-then-buyback achieves the same effect entirely within the printed rules; `[OFFICIAL]` a loan (any
transfer with an expectation of return) is prohibited. Phrase this to your users as "no rule forbids it," not
"the rules allow it."

**Richup, by contrast, has explicitly closed the game-throwing version of this.** `[RICHUP-DEFAULT]`,
v1.17 (Aug 2026):

> "**Trades got fairer too.** You know the trick. A player about to lose hands their whole empire to a friend,
> and whoever bankrupted them collects nothing. That's over. You can still sell, still raise money, still accept
> a rescue gift. **You just can't give the game away.**"
> — https://blog.richup.io/richup-v1-17-the-turn-clock/

The exact predicate ("give the game away") is not published — likely a solvency/fair-value test on trades made
by a player in debt. `UNVERIFIED`. This is the single most important richup-vs-official divergence in this
document and is the model for Decision #19.

### 2.4 Selling property to another player — the commonly-broken rule

> "SELLING PROPERTY… **Unimproved** properties, railroads and utilities (but not buildings) may be sold to any
> player as a private transaction for any amount the owner can get; however, **no property can be sold to another
> player if buildings are standing on any properties of that color-group. Any buildings so located must be sold
> back to the Bank before the owner can sell any property of that color-group.**" — S1 `[OFFICIAL]`

Three separate constraints, all routinely broken at real tables and all easy to get wrong in code:

1. **You may never transfer a building.** Buildings are only ever bought from and sold to the Bank.
2. **The blocker is group-wide, not property-wide.** One house anywhere on the light blues blocks the sale of
   *all three* light blues — including the two with nothing on them. See
   https://boardgames.stackexchange.com/a/4294.
3. **Price is unconstrained** — $0 and $9,999 are both legal. This is the collusion surface (§3.6).

Practical consequence: to trade a developed monopoly you must first demolish it at 50% loss, then the buyer
rebuys at full price. In a building shortage this can be irreversible — the houses you return may be bought by
someone else before you can rebuild (§4).

### 2.5 Selling property back to the Bank — no such rule exists

`[OFFICIAL] by absence.` There is no mechanism anywhere in S1/S2/S3 for a player to sell a title deed to the
Bank. The Bank *sells and auctions* properties; the only property→cash channel with the Bank is **mortgaging**.
Buildings are the sole exception ("Houses and hotels may be sold back to the Bank at any time for one-half the
price paid for them").

State it to implementers as *absence of a rule* rather than a prohibition, because the difference matters: there
is nothing to enforce, only a UI affordance you must not build.

(The one printed exception is the tournament-practice multi-creditor procedure in §6.2, where "the bank then
rebuys your properties at face value" — but that is Orbanes tournament practice, `[HOUSE-RULE]`.)

### 2.6 Trading with a player in jail

> "**Even though you are in Jail, you may buy and sell property, buy and sell houses and hotels and collect
> rents.**" — S1, JAIL `[OFFICIAL]`

Jail restricts **movement only**. A jailed player may trade, build, mortgage, unmortgage, bid in auctions, and
collect rent. https://boardgames.stackexchange.com/a/38772 (96 votes) and
https://boardgames.stackexchange.com/a/8785 (accepted) — a jailed player may even win an auction at $1.

Staying in jail late-game is a **correct strategy**, not an accident: you cannot land on hotels while immobile.
Richup surfaces this as an in-game tip: *"Sometimes it's better to stay in prison, so you won't pay rent for as
long as possible"* (S4, string in `index.BAOd0zsy.js`) `[RICHUP-DEFAULT]`.

Richup adds `noRentPaymentsWhileInPrison` `[RICHUP-TOGGLE]` — the client string is *"Don't collect rent while in
prison"* (S4). This **inverts** the official rule (§2.6 first quote) and exists precisely to defuse the
sit-in-jail strategy. Default in the client's default object: `false` (i.e. official behavior).

### 2.7 Trading during another player's turn

**The rules do not say.** This is one of the few timing gaps in the rulebook, and it is a real one:

> "The official rules don't state if you are able to sell properties at any time (in fact, it is one of the few
> rules that don't have the timing explicitly stated) … All other types of transactions state that you can do
> them at any time: selling Get Out of Jail Free cards, mortgaging properties to the bank, selling houses back to
> the bank, **buying houses from the bank**. The most troubling transaction that can be done 'at any time' … is
> 'Buying Houses.' They probably didn't mean that you can buy houses **after another player rolls the dice, but
> before they were forced to pay rent** … This makes me believe that this is probably an oversight."
> — https://boardgames.stackexchange.com/a/6476 (accepted) `[HOUSE-RULE]`

Taken literally, "buy and erect at any time" (S1, HOUSES) lets you slam a hotel onto Boardwalk in the moment
between an opponent's roll and their landing. Universal table practice forbids this. The common formulation:

> "Selling Property: This may only be done at any time **other than after a player rolls the dice, but before
> they have paid rent and/or tax**." — https://boardgames.stackexchange.com/a/31358 `[HOUSE-RULE]`

A second SE answer notes the literal rule does permit simultaneous building by multiple players:
https://boardgames.stackexchange.com/a/39273 `[OFFICIAL]`-literal. See Decision #11 and #12.

### 2.8 Get Out of Jail Free card

> "The 'Get Out of Jail Free' card is held until used and then returned to the bottom of the deck. If the player
> who draws it does not wish to use it, **he/she may sell it, at any time, to another player at a price agreeable
> to both**." — S1, CHANCE AND COMMUNITY CHEST `[OFFICIAL]`

- Freely tradeable and sellable, at any time, at any price. `[OFFICIAL]`
- Its natural face value is $50 (the jail fine); its *time* value is lower, since it saves $50 at an
  indefinite future point — https://boardgames.stackexchange.com/a/22841 `[HOUSE-RULE]` analysis.
- **You may decline to use it** — nothing compels you. https://boardgames.stackexchange.com/a/58494 `[OFFICIAL]`
  by absence.
- **Selling it back to the Bank for $50 is a house rule**, not official (same answer) `[HOUSE-RULE]`.
- On bankruptcy it transfers with "all that you have of value" — inference, see §1.2.
- It returns to the **bottom of the deck it came from** when used — so a two-deck implementation must track the
  card's provenance.

### 2.9 Trading mortgaged properties — fee mechanics

Covered in full in §1.3. Summary for the trade case `[OFFICIAL]`:

- The **buyer (new owner)**, never the seller, owes the Bank.
- Buyer chooses at the moment of transfer:
  - **Lift now:** pay `M + 10%` once. Property becomes unmortgaged immediately.
  - **Hold mortgaged:** pay `10%` now. Later, to lift, pay `M + 10%` again.
- The seller keeps the mortgage principal they already borrowed; they owe nothing on the sale.
- The property collects **no rent** while mortgaged (S1, MORTGAGES), but **does still count toward the color
  group for double rent on the group's unmortgaged members** (§5.4).
- A mortgaged property is still "unimproved" for the purposes of the SELLING PROPERTY rule, so it is tradeable —
  provided no building stands anywhere in its color group.

### 2.10 One-sided / zero-value trades as a collusion vector

**Implementation concern, not a rule.** The rulebook price clause ("for any amount the owner can get") is
deliberately unbounded and is the single largest exploit surface in a networked implementation:

- **Kingmaking / spite transfer.** A player about to be bankrupted trades their entire estate to a third party
  for $1, so the creditor collects nothing. Legal under S1. Explicitly patched by richup v1.17
  (§2.3) `[RICHUP-DEFAULT]`.
- **Free-cash laundering.** $0 property sale + buyback at $500 = a legal $500 gift (§2.3).
- **Synthetic mortgages between players.** A full mortgage can be reproduced player-to-player, with the interest
  going to the "lender" rather than the Bank, entirely inside the trade rules:
  https://boardgames.stackexchange.com/a/62968 `[OFFICIAL]`-legal, `[HOUSE-RULE]`-enforced by honor.
- **Rent immunity.** Collect the rent, then hand the money straight back (or grant it via a $0 trade):
  https://boardgames.stackexchange.com/a/7899. Arguably violates the spirit of MISCELLANEOUS:
  https://boardgames.stackexchange.com/a/7889.
- **De-facto merger.** Player B trades everything to Player A for $1 and plays as A's ally:
  https://boardgames.stackexchange.com/a/25559 — legal, except that houses must be demolished and rebought first.
- **Third-party rescue of a doomed player.** https://boardgames.stackexchange.com/questions/6472 —
  the accepted answer notes there is no rule against it, and that the usual ruling is that a threatened player
  may trade *only* if the trade actually averts the bankruptcy.

See Decisions #19 and #20.

---

## 3. BUILDING EDGE CASES

### 3.1 The building supply and the shortage rule

`[OFFICIAL]` The supply is **32 houses and 12 hotels** (S1, EQUIPMENT: *"The equipment consists of a board, 2 dice,
tokens, 32 houses and 12 hotels."*). It is finite and this is load-bearing.

> "BUILDING SHORTAGES… When the Bank has no houses to sell, players wishing to build **must wait for some player
> to return or sell his/her houses to the Bank** before building. **If there are a limited number of houses and
> hotels available and two or more players wish to buy more than the Bank has, the houses or hotels must be sold
> at auction to the highest bidder.**" — S1 `[OFFICIAL]`

Exact mechanics the rulebook gives: the auction triggers only when **demand exceeds supply** (two-plus players
want more than the Bank holds); the unit auctioned is **houses/hotels**, sold **to the highest bidder**. Nothing
else is specified — not the starting price, not the increment, not the ordering, not whether they are auctioned
singly or in lots.

**Tournament practice fills the gap** (Monopoly tournament rule, quoted at
https://boardgames.stackexchange.com/a/64273) `[HOUSE-RULE]` *(official tournament practice, not in rulebook)*:
> "The Banker runs auctions. Players must indicate the **specific property to be improved** if the house/hotel is
> won **before bidding**. Bids start at the **value of the houses/hotels for the lowest-priced property where it
> might be placed**. The highest bidder, after giving his/her money to the Banker, places the house/hotel on the
> identified property. If houses/hotels remain and more than one person wish to purchase the remaining
> houses/hotels, then another auction is held for the right to purchase these, **one by one**."

Under this, a player wanting a house for dark blue (list $200) can win one for a $50 opening bid — the brown/
light-blue house price. A competing SE answer argues the minimum should be the *bidder's own* house price, else
"wishing to buy" is meaningless: https://boardgames.stackexchange.com/a/64272 `[HOUSE-RULE]`. See Decision #16.

### 3.2 Breaking hotels back into houses when houses are short — the hotel trap

`[OFFICIAL]` from SELLING PROPERTY:
> "All hotels on one color-group may be sold at once, or they may be sold **one house at a time (one hotel
> equals five houses)**, evenly, in reverse of the manner in which they were erected."

**If the Bank has no houses, you cannot break a hotel down into houses. Your only move is to sell the whole
hotel outright, and the rule that hotels come down evenly means you must strip the entire color group.**

> "Yes, you can only downgrade a hotel to a number of houses **if that number of houses is actually available in
> the bank**. If there are no houses, you must sell the entire hotel outright."
> — https://boardgames.stackexchange.com/a/8051 (accepted) `[HOUSE-RULE]` interpretation

> "If it is NOT possible to break up a hotel into four houses, you must sell all hotels at once, at half-face
> value for the entire purchase of each hotel and four houses, thus satisfying 'all hotels on one color-group may
> be sold at once.'" — https://boardgames.stackexchange.com/a/926 (accepted, 44 votes) `[HOUSE-RULE]`

**The strategic consequence, which your implementation must not accidentally erase:** buying the *last* houses
rather than upgrading to hotels starves everyone else, because every hotel built **returns four houses to the
pool**. With zero houses in the Bank, hotel owners are liquidity-locked — they can't partially downgrade to raise
cash, only demolish a whole color group. This "hotel trick" / house-starving strategy is a real, well-documented
part of tournament Monopoly: https://boardgames.stackexchange.com/questions/13474. See Decision #17.

**Priority conflict:** if Alice wants to *buy* 6 houses and Bob wants to *break hotels* to get 18, who goes
first? The Monopoly Companion tournament rule (post-1983 U.S. Championships), quoted at
https://boardgames.stackexchange.com/a/9510 `[HOUSE-RULE]` *(tournament practice, not in rulebook)*:
> "While a Building Shortage exists, players desiring to **buy the houses remaining in the bank have priority
> over those wishing to break down hotels**."

**You cannot buy a hotel directly when houses are gone.** A hotel requires four houses standing on the property
first; if you cannot obtain the houses, you cannot reach the hotel.
https://boardgames.stackexchange.com/a/38376 (accepted) `[OFFICIAL]`.

### 3.3 Building on a color group with one property mortgaged

**Not stated explicitly — but the inference is strong and one-directional.** `[OFFICIAL]`-by-inference:

> "When **all the properties of a color-group are no longer mortgaged**, the owner may begin to buy back houses
> at full price." — S1, MORTGAGES

Since the rulebook conditions *resuming* building on the whole group being unmortgaged, building while any member
is mortgaged is prohibited. Accepted SE answer, with the same reasoning and an explicit note that the rulebook
does not say it in the HOUSES section: https://boardgames.stackexchange.com/a/52991 `[OFFICIAL]`-by-inference.

The converse direction **is** explicit: you cannot mortgage a property while any building stands anywhere in its
color group — https://boardgames.stackexchange.com/a/47128 quoting S1 MORTGAGES `[OFFICIAL]`.

So the full invariant, which is cleanest to enforce as a single predicate:

> **A color group is in exactly one of two states: DEVELOPABLE (every member owned by one player, none mortgaged
> — buildings may be bought/sold, no member may be mortgaged or traded) or ENCUMBERED (at least one member
> mortgaged, or not a full set — zero buildings may exist, members may be mortgaged and traded freely).**

### 3.4 Building / mortgaging / trading while in jail, and between turns

- **In jail:** all of it is legal. §2.6, S1 JAIL, verbatim. `[OFFICIAL]`
- **Between other players' turns:** "buy and erect **at any time**" (S1, HOUSES) and "sold back to the Bank **at
  any time**" (S1, SELLING PROPERTY) and "mortgaged through the Bank **at any time**" (S1, MORTGAGES) are all
  literal. Multiple players building simultaneously is therefore legal by the letter:
  https://boardgames.stackexchange.com/a/39273 `[OFFICIAL]`. Universally house-ruled to exclude the
  post-roll/pre-payment window (§2.7) `[HOUSE-RULE]`.
- **Selling houses to pay a debt already incurred does not reduce the debt.** Street Repairs / General Repairs
  assess the buildings you held **when the card was drawn**:
  https://boardgames.stackexchange.com/a/54584 `[HOUSE-RULE]` (rulebook silent; FAQ-confirmed). This is the
  general **debt-snapshot principle**: an obligation is computed at the instant it is incurred, and subsequent
  liquidation cannot shrink it.
- **Richup's even-build rule** is a `[RICHUP-TOGGLE]` named `evenBuild`, **on by default**:
  *"A new game rule that only lets you build houses and hotels evenly on owned property sets. The new rule is on
  by default to enable more strategic gameplay."* — https://blog.richup.io/richup-v1-12/. Note this means richup
  shipped for years **without** even-build, which is `[OFFICIAL]` in Monopoly. Turning it off is `[HOUSE-RULE]`.

---

## 4. TURN & TIMING EDGE CASES

### 4.1 Rent must be claimed — the key digital-adaptation decision

> "The owner **may not collect the rent if he/she fails to ask for it before the second player following throws
> the dice**." — S1, PAYING RENT `[OFFICIAL]`

**Worked example** (https://boardgames.stackexchange.com/a/39272, https://boardgames.stackexchange.com/a/6460):
players A→B→C→D. A lands on F's property. B (first following) takes a full turn. The window closes **the instant
the dice leave C's hand** (second following). Confirmed by 2009 Monopoly World Championship rules
(https://boardgames.stackexchange.com/a/57522) `[HOUSE-RULE]` *(tournament, but restating the printed rule)*:
> "you can ask for rent until the second player to your left throws the dice … As soon as the dice leave Player
> C's hand, you have missed your chance."

**There is a genuine printing difference in the window length.** `[OFFICIAL]`, both:
- Older sets: *"If the owner fails to ask for rent before the **next throw of the dice**, no rent is collected."*
- S1/S2/S3 and all modern printings: **second player following**.
The change was made to stop two adjacent colluding players from rolling fast to skip rent
(https://boardgames.stackexchange.com/a/57522).

**Digital adaptation.** Every online implementation auto-collects rent the moment you land. This is
`[RICHUP-DEFAULT]` and near-universal — richup's own tutorial string is *"Once you own a property, other players
will pay rent when they land on it"* (S4). **This is a deliberate rules deviation and it deletes a real
strategic layer**: under `[OFFICIAL]` rules, forgetting to ask is a punished mistake, and *choosing* not to ask
is a legal move that can save a creditor from being bankrupted by their own rent (§1.3,
https://boardgames.stackexchange.com/a/53757). Auto-collect makes both impossible. See Decision #1.

### 4.2 Landing on your own property

`[OFFICIAL]` by absence — the rules define rent only as "When you land on property owned by **another** player."
Nothing happens. No self-rent, no action.

### 4.3 Landing on a mortgaged property

> "**If the property is mortgaged, no rent can be collected.** When a property is mortgaged, its Title Deed card
> is placed face down in front of the owner." — S1, PAYING RENT `[OFFICIAL]`

Two exceptions and one clarification:

- **Utilities:** the Chance card *"Advance token to nearest Utility … throw dice and pay owner a total ten times
  the amount thrown"* is **not rent** and is payable even on a mortgaged utility, because the card names an
  absolute amount rather than referencing rent. https://boardgames.stackexchange.com/a/23949 `[OFFICIAL]` reading.
- **Railroads:** the Chance card *"Advance to the nearest Railroad and pay owner **twice the rental to which
  he/she is otherwise entitled**"* **does** reference rent — so on a mortgaged railroad the entitled rent is $0
  and 2 × $0 = $0. Same answer. `[OFFICIAL]` reading.
- **Ownership of the mortgaged property still counts for the group.** §5.4.

### 4.4 Landing on an unowned property you cannot afford — the auction still happens

> "If you do not wish to buy the property, the Banker sells it at auction to the highest bidder … **Any player,
> including the one who declined the option to buy it at the printed price, may bid. Bidding may start at any
> price.**" — S1, BUYING PROPERTY `[OFFICIAL]`

- The auction is **mandatory**, not optional. Declining to buy *is* the trigger. `[OFFICIAL]`
- **No minimum bid.** Hasbro: "There is no minimal bid so the starting price will always be $1"
  (https://boardgames.stackexchange.com/a/50491). `[OFFICIAL]`
- **You may bid more than you hold, and the bid is binding** — you may bankrupt yourself winning an auction:
  https://boardgames.stackexchange.com/a/53999 (50 votes) and Hasbro's ruling above. `[OFFICIAL]`
- **You may not mortgage the property you just won in order to pay for it** — Hasbro ruling, and
  https://boardgames.stackexchange.com/a/39693. `[OFFICIAL]`
- **An auction winner who cannot pay is bankrupt to the Bank**, and the property they just won becomes part of
  the bankruptcy auction: https://boardgames.stackexchange.com/a/39457 (accepted, 29 votes) `[HOUSE-RULE]`
  interpretation of the plain definition. This is a nasty recursion — see Decision #14.
- **You may buy the property you were sent to by a Chance/Community Chest card**, exactly as if you had rolled
  onto it: https://boardgames.stackexchange.com/a/33468 `[OFFICIAL]`.
- **Richup:** `auction` is a `[RICHUP-TOGGLE]`; the client's default-settings object has `auction: false`
  (S4) — i.e. richup's default deviates from `[OFFICIAL]` by simply leaving declined properties unowned. Lobby
  UI seeding `UNVERIFIED`.
- **What if nobody bids at all?** Rulebook silent. The property remains with the Bank and stays unowned:
  https://boardgames.stackexchange.com/questions/49502 `[HOUSE-RULE]`.

### 4.5 Being sent to jail while owing rent

**No rulebook sentence covers this. It must be reasoned, and the reasoning is clean.** `[OFFICIAL]`-by-inference:

- Doubles: *"you move your token as usual … and are **subject to any privileges or penalties pertaining to the
  space on which you land**. Retaining the dice, throw again"* (S1, THE PLAY). So an intermediate doubles roll
  **fully resolves** — rent is incurred and settled — before the next roll.
- The third double: *"If you throw doubles three times in succession, **move your token immediately to the space
  marked 'In Jail'**"* (S1) — the token never lands anywhere, so no rent is ever incurred on that roll.
  https://boardgames.stackexchange.com/a/45676 (accepted, 85 votes) `[OFFICIAL]`: *"You go to jail directly on
  rolling the third double, so there's no opportunity to land on 'Go to Jail'."*
- Landing on "Go to Jail" or drawing a Go-to-Jail card: those spaces/cards carry no monetary obligation.
- *"When you are sent to Jail you cannot collect your $200 salary in that move"* (S1, JAIL) — the one explicit
  interaction, and it is a *denial* of a collection, not a deferral of a debt.

**Implementer framing:** debt resolution and token placement are independent state transitions. A pending debt is
never suspended, deferred, or cancelled by going to jail; resolve the debt (or the bankruptcy) first, then apply
the move. Jail restricts movement only (§2.6). The general debt-snapshot principle (§3.4,
https://boardgames.stackexchange.com/a/54584) covers the rest.

### 4.6 A card sends you to a property owned by a bankrupt player

**This state is unreachable, and that unreachability is the answer.** `[OFFICIAL]`-by-construction:

- Bankrupt **to a player** → title transfers to the creditor **instantly**, as part of the settlement (§1.2).
- Bankrupt **to the Bank** → the Bank **"immediately sells by auction"** every property (§1.4). Buildings go
  back to the pool in the same instant.
- *"A bankrupt player must immediately retire from the game."* (S1)

**The invariant:** *no property is ever owned by a retired player; bankruptcy resolution is atomic and completes
before play resumes.*

**The implementation consequence is not free.** A bankrupt-to-Bank settlement contains an unbounded sequence of
interactive auctions (potentially 28 of them), each requiring input from every remaining player. Your bankruptcy
resolution must therefore be a **blocking sub-state-machine that the turn loop cannot re-enter**, and every code
path that reads `property.owner` must be unable to observe the intermediate state. Additional hazard: a player
can be **bankrupted by the very auction they are participating in** (§4.4), so bankruptcy resolution is
re-entrant against itself. See Decision #26.

### 4.7 Two-player-game quirks

`[OFFICIAL]` The rules support 2–8 players (S2 Contents line, *"2 to 8 Players"* — S1 does not state a player
range) with no special two-player rules whatsoever. The
emergent consequences:

1. **Bankruptcy ends the game.** With two players, the first bankruptcy is the win condition. There is no
   "bankrupt to the Bank then keep playing" outcome that matters.
2. **Auctions collapse into a bilateral negotiation.** With one opposing bidder and no minimum bid, the
   "auction" is a chicken game. The overbid-to-drain tactic (https://boardgames.stackexchange.com/a/53999)
   becomes far stronger, and the tit-for-tat retaliation loop is the whole meta.
3. **Building shortages effectively never trigger the auction rule.** The shortage auction needs "two or more
   players wish to buy more than the Bank has"; with two players it's rarer and mostly reduces to a race.
4. **No third-party rescue exists.** The classic kingmaker plays (§2.10, https://boardgames.stackexchange.com/a/20461
   "persuade at least ONE of them to bail you out") are unavailable — there is nobody to trade with except the
   person trying to bankrupt you. A player facing an unpayable rent has **only** the Bank (mortgage, sell
   buildings) and the creditor themselves.
5. **A Get Out of Jail Free card has near-zero cash value.** *"In a two player game, the creditor doesn't 'have'
   to accept such a card as legal tender."* — https://boardgames.stackexchange.com/a/22841 `[HOUSE-RULE]`.
6. **Games can run extremely long or never terminate.** A widely-cited study found roughly a 12% chance of a
   non-terminating 2-player game — but it modeled players who never bid at auctions and never trade, so the
   figure does not describe rules-correct play: https://boardgames.stackexchange.com/a/51332 `[HOUSE-RULE]`
   analysis. Still, a turn cap or a net-worth tiebreak is worth having.

---

## 5. ASSORTED CLARIFICATIONS THAT BITE IMPLEMENTERS

### 5.1 GO salary and ordering
*"Each time a player's token lands on or passes over GO … the Banker pays him/her a $200 salary."* `[OFFICIAL]`
You receive $200 **as you pass**, before resolving the space you land on — so you may use it to pay the Income
Tax you land on: https://boardgames.stackexchange.com/a/43723 `[OFFICIAL]` reading. Advance-to-GO after passing
GO on the same move pays **twice** ($400), and the rulebook says so explicitly (S1, "GO").

### 5.2 Income Tax
*"You may estimate your tax at $200 and pay the Bank, or you may pay 10% of your total worth… Your total worth
is all your cash on hand, printed prices of mortgaged and unmortgaged properties and cost price of all buildings
you own. **You must decide which option you will take before you add up your total worth.**"* — S1 `[OFFICIAL]`.
(Note: mortgaged properties count at **printed price**, not mortgage value, for tax — this differs from the Short
Game's end-of-game valuation, which uses half. Two different valuation formulas in one rulebook.)

### 5.3 10% rounding
**No official rule.** The utilities mortgage at $75, so 10% = $7.50, and the game has $1 as its smallest
denomination. https://boardgames.stackexchange.com/a/38460 (accepted): *"There is no official rule to address
this question."* `[HOUSE-RULE]`. The strongest available precedent is the electronic-banking edition, which says
*"plus 10% interest (**rounded up** to the nearest 10,000)"* on a 10,000× money scale — i.e. **round up to the
nearest $1**: https://boardgames.stackexchange.com/a/12753 `[HOUSE-RULE]`. The same problem applies to the
Income Tax 10% option.

### 5.4 Double rent with a mortgaged group member — the one real printing conflict
> "This rule applies to **unmortgaged properties even if another property in that color-group is mortgaged**."
> — S1, PAYING RENT `[OFFICIAL]`

So under S1/S2/S3, yes: double rent still applies. https://boardgames.stackexchange.com/a/53744 (accepted).
**But Waddingtons' 1996 UK rules say the opposite** — *"an owner who owns a whole colour-group may not collect
double rent if any one Site there is mortgaged"* — https://boardgames.stackexchange.com/a/61277 `[OFFICIAL]`
(different printing). Pick one and say which.

**Utilities are the same shape:** the card says *"if **BOTH** Utilities are owned, rent is 10x"* — ownership, not
un-mortgaged-ness. Own both, mortgage one, and the other still charges 10×:
https://boardgames.stackexchange.com/a/8483 (accepted) `[OFFICIAL]`.

### 5.5 Auction procedure generally
Monopoly auctions have **no** printed structure: no opening bid, no increment, no bid ordering, no clock, no
required participation. https://boardgames.stackexchange.com/questions/38805 and
https://boardgames.stackexchange.com/questions/1978 collect the house rules people invent (¼ price opening,
increment = base rent, etc.) `[HOUSE-RULE]`. **A digital implementation is forced to invent all of it.** Hasbro's
own support ruling (§1.4) supplies: starting price $1, no minimum, binding bids, no mortgaging to fund, everyone
including jailed players may bid.

---

## 6. RICHUP.IO — WHAT IS ACTUALLY CONFIGURABLE

### 6.1 The room-settings schema (primary source)

Extracted from the live client bundle `https://richup.io/index.BAOd0zsy.js` on 2026-08-20 (S4). The
`update-game-room` payload validator accepts exactly:

```
isPrivate                    boolean
maxPlayers                   2 | 3 | 4 | 5 | 6      (a second array is concatenated for teams mode;
                                                     its values were not resolved — UNVERIFIED)
canBotsJoin                  boolean
onlyUsers                    boolean                (registered accounts only)
shufflePlayerOrder           boolean
startingCash                 500 | 1000 | 1500 | 2000 | 2500 | 3000
auction                      boolean
evenBuild                    boolean
payDoubleRentWhenOwnFullSet  boolean
noRentPaymentsWhileInPrison  boolean
mortgage                     boolean
vacationCash                 boolean
teams                        { enabled: false } | { enabled: true, balanceStartCash: boolean }
mapId                        string
```

And the client's **default settings object**:

```
{ maxPlayers: 4, canBotsJoin: true, isPrivate: false, onlyUsers: false,
  payDoubleRentWhenOwnFullSet: false, vacationCash: false, auction: false,
  noRentPaymentsWhileInPrison: false, mortgage: false, startingCash: 1500,
  evenBuild: true, shufflePlayerOrder: true, teams: { enabled: false } }
```

All the above are `[RICHUP-TOGGLE]`. **Caveat:** these values come from a client-side default object in the
bundle, not from observed lobby UI state. The lobby may seed different values, and public matchmaking almost
certainly uses a different preset. Treat the defaults as `UNVERIFIED`; treat the **schema** (the list of knob
names) as verified primary source.

**Two toggles invert Monopoly and are worth flagging loudly:**

| Richup toggle | Monopoly status | Note |
| --- | --- | --- |
| `payDoubleRentWhenOwnFullSet` | `[OFFICIAL]`, mandatory (S1, PAYING RENT) | Richup makes core Monopoly rent doubling **optional**. |
| `vacationCash` | `[HOUSE-RULE]` — the classic Free Parking pot. S1 is emphatic: *"A player landing on this place does **not** receive any money, property or reward of any kind."* | Richup promotes the world's most popular house rule to a first-class toggle. |
| `noRentPaymentsWhileInPrison` | Inverts S1 JAIL (*"…and collect rents"*) | Client string: *"Don't collect rent while in prison"*. Exists to defuse the sit-in-jail strategy (§2.6). |
| `mortgage` | `[OFFICIAL]`, always available | Richup lets you **disable mortgaging entirely**, which materially changes the whole liquidation ladder in §1.1. |
| `evenBuild` | `[OFFICIAL]`, mandatory | Added in v1.12, on by default. |
| `auction` | `[OFFICIAL]`, mandatory | Optional in richup. |

### 6.2 Bankruptcy in richup

Verified from the bundle (S4): richup has a **player-initiated `do-bankrupt` action** (socket event
`"do-bankrupt"`, client method `submitBankrupt()`), broadcasting `"player-bankrupted"`. Player liveness is a
single field — `bankruptedAt === null` means active. So **richup lets you resign/concede on demand**, which the
rulebook has no concept of. `[RICHUP-DEFAULT]`.

The server also instruments `creditorRecoveries`, `trades`, and `auctions` in game stats (S4) — consistent with
a creditor-settlement path and with the anti-collusion work in v1.17.

**Everything else about richup's bankruptcy resolution — whether buildings are half-price refunded, whether the
10% mortgage fee is charged to the creditor, whether bank-bankruptcy triggers auctions — was not observable from
the bundle and is `UNVERIFIED`.** Do not assume it matches Monopoly.

### 6.3 The Turn Clock (v1.17) — the only sourced answer to timeout/disconnect

The rulebook has nothing on absent players; this is a pure digital-adaptation problem, and richup published its
answer. https://blog.richup.io/richup-v1-17-the-turn-clock/ `[RICHUP-DEFAULT]`:

- Every turn has a clock: free thinking time first, then a **personal reserve** that refills each turn you finish
  yourself.
- *"**Land in debt you can't cover and your window widens on its own**"* — the clock is deliberately more generous
  during insolvency, because liquidation takes real deliberation.
- *"Anyone at the table can hand you an extra minute with one click"* (`grant-clock-time` / `request-clock-time`
  in S4).
- On reserve exhaustion: *"**It rolls and it ends your turn. It will never bid in an auction or mortgage your
  properties.**"* — the auto-player takes only the forced, non-strategic actions.
- *"**Two turns like that and you're out, and your properties go back to the bank.**"*
- *"A player can only be removed once their time has actually run out. **Winning is no longer a reason to get
  kicked.**"* (i.e. vote-kick alone can no longer eliminate a leader).

### 6.4 Teams mode (v1.16) `[RICHUP-TOGGLE]` `teams.enabled`
https://blog.richup.io/richup-v1-16-introducing-teams-mode/
- Off by default; locked once the game starts.
- **No rent between teammates.**
- **Properties combine across the team** for monopoly/set purposes — so a color group split between two
  teammates still counts as a monopoly and can be built on.
- **"If a teammate bankrupts, everything they own passes to a surviving teammate"** — a third bankruptcy target
  beyond player and Bank.
- **Last team standing wins together.**
- `balanceStartCash` sub-setting for uneven team sizes.

---

## 7. (Moved) Decisions for the implementer

This section listed 30 questions the rules leave open, each with a recommended default. Our answers,
and the recommendations for the ones deferred to v2, now live in `docs/ENGINE.md` under "Decisions",
which keeps the same numbering. The analysis behind each question is in §1–§6 above.

---

## 8. QUICK REFERENCE — WHAT THE RULEBOOK ACTUALLY SAYS, IN ONE TABLE

| Question | Answer | Tag |
| --- | --- | --- |
| Can the Bank go broke? | No — write more money on paper | `[OFFICIAL]` |
| Can players lend to each other? | No, explicitly forbidden | `[OFFICIAL]` |
| Can players gift cash? | Not addressed; $0-trade route is explicitly legal | `[OFFICIAL]` by absence |
| Can you sell a property to the Bank? | No such rule exists; mortgage instead | `[OFFICIAL]` by absence |
| Can you sell buildings to the Bank? | Yes, any time, half price paid | `[OFFICIAL]` |
| Can you sell a property with buildings on its group? | No — demolish the whole group first | `[OFFICIAL]` |
| Can you trade with a jailed player? | Yes | `[OFFICIAL]` |
| Can a jailed player build, mortgage, bid, collect rent? | Yes to all | `[OFFICIAL]` |
| Can you trade during another player's turn? | Rules don't say; universally house-ruled | `[HOUSE-RULE]` |
| Is a GOOJF card tradeable? | Yes, any time, any price | `[OFFICIAL]` |
| Must you use a GOOJF card if you hold one? | No | `[OFFICIAL]` by absence |
| Who pays the mortgage fee on a traded mortgaged property? | The buyer | `[OFFICIAL]` |
| Who pays it on a bankruptcy transfer? | The creditor, mandatory, at once | `[OFFICIAL]` |
| Are buildings sold to the Bank even when bankrupting to a player? | Yes, always | `[OFFICIAL]` |
| Bankrupt to the Bank — are properties auctioned? | Yes, immediately, one at a time | `[OFFICIAL]` |
| Bankrupt to the Bank — are buildings auctioned? | No, they return to the supply | `[OFFICIAL]` |
| Is the property auction after a decline mandatory? | Yes | `[OFFICIAL]` |
| Is there a minimum bid? | No — bidding may start at any price; Hasbro says $1 | `[OFFICIAL]` |
| Can you bid more than you have? | Yes, and it's binding | `[OFFICIAL]` |
| Can you mortgage the won property to pay for it? | No | `[OFFICIAL]` (Hasbro ruling) |
| Can you build when a group member is mortgaged? | No (by inference) | `[OFFICIAL]`-by-inference |
| Double rent when a group member is mortgaged? | Yes (Parker/Hasbro); No (Waddingtons 1996) | `[OFFICIAL]` — conflict |
| Can you break a hotel with no houses in the Bank? | No — sell the whole hotel, evenly, group-wide | `[HOUSE-RULE]` interp. |
| Can you buy a hotel directly with no houses available? | No | `[OFFICIAL]` |
| Does rent have to be claimed? | Yes — before the second following player rolls | `[OFFICIAL]` |
| Free Parking pays out? | No — "no money, property or reward of any kind" | `[OFFICIAL]` |
| How is the winner determined? | Last player left in the game | `[OFFICIAL]` |
| Official short/timed variants? | Yes — Short Game and Time Limit Game, both in S1 | `[OFFICIAL]` |
