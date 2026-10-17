# Common House Rules and Variants

Research lane: **house rules and variants** — the unofficial rules most players actually use, which a
richup.io-style clone needs to ship as configurable toggles.

Compiled 2026-08-20. Everything below is sourced inline; see the Sources section at the end.

---

## How to read the tags

Every rule in this document carries exactly one tag. This is the whole point of the file — the most
common failure mode in Monopoly implementations is shipping a house rule as if it were the real rule,
because everyone who tested it grew up playing that way.

| Tag | Means |
|---|---|
| `[OFFICIAL]` | Printed in the Parker Brothers / Hasbro standard rulebook. Two sub-cases are called out explicitly where relevant: the **standard game**, and the **official printed variants** (SHORT GAME, TIME LIMIT GAME) which are official text but *not* the default game. |
| `[HOUSE-RULE]` | Not in the standard rules. Includes rules Hasbro *endorsed* in 2014 and printed in the rulebook from 2015 **as optional variants** — endorsement is not officialisation, and those five are tagged `[HOUSE-RULE]` throughout. |
| `[RICHUP-TOGGLE]` | Believed to be exposed as a setting in richup.io. **A separate research lane owns richup in detail.** Every use of this tag here is marked with a confidence note, and most are `UNVERIFIED` — do not treat this file as the authority on what richup actually offers. |

`UNVERIFIED` marks any claim I could not pin to a primary or reputable secondary source.

**Design-decision markers.** Where the sources simply do not answer a question an implementer must
answer (does an "Advance to GO" card count as *landing* on GO? does the Free Parking pot reset to zero
or back to its seed?), the text says **DESIGN DECISION** and proposes an answer. Those are my
recommendations, not sourced facts.

---

## 0. The official baseline (what the house rules deviate *from*)

Source for this whole section: the Parker Brothers / Hasbro standard rulebook, part no. 40009-I-Rev 2,
copyright dates through 1997, retrieved as PDF from
<https://cdn.1j1ju.com/medias/d3/22/83-monopoly-rulebook.pdf> and text-extracted locally. Quotations
below are verbatim from that document. Cross-checked against
<https://instructions.hasbro.com/en-gb/instruction/monopoly-game> and
<https://en.wikibooks.org/wiki/Monopoly/Official_Rules>.

Pin these clauses down first; every `[HOUSE-RULE]` below is defined as a deviation from one of them.

- **Equipment `[OFFICIAL]`** — "The equipment consists of a board, 2 dice, tokens, 32 houses and 12
  hotels." The building supply is finite *by design*.
- **Starting cash `[OFFICIAL]`** — "$1500 divided as follows: 2 each of $500's, $100's and $50's; 6
  $20's; 5 each of $10's, $5's and $1's."
- **GO `[OFFICIAL]`** — "Each time a player's token lands on or passes over GO … the Banker pays
  him/her a $200 salary." Landing exactly on GO is worth $200, same as passing. Explicit double-dip
  case: pass GO, land on Community Chest or Chance, draw *Advance to GO* → "$200 for passing GO the
  first time and another $200 for reaching it the second time."
- **Auctions are mandatory `[OFFICIAL]`** — "If you do not wish to buy the property, the Banker sells
  it at auction to the highest bidder. … Any player, including the one who declined the option to buy
  it at the printed price, may bid. Bidding may start at any price."
- **Free Parking pays nothing `[OFFICIAL]`** — "A player landing on this place does not receive any
  money, property or reward of any kind. This is just a 'free resting place.'"
- **Rent while in jail `[OFFICIAL]`** — "Even though you are in Jail, you may buy and sell property,
  buy and sell houses and hotels **and collect rents**."
- **Rent must be asked for `[OFFICIAL]`** — "The owner may not collect the rent if he/she fails to ask
  for it before the second player following throws the dice." (A digital clone auto-collects; this
  clause is dead in software, but it is worth knowing it exists before someone "restores" it.)
- **Full colour set required to build `[OFFICIAL]`** — "When you own all the properties in a
  colour-group you may buy houses from the Bank and erect them on those properties."
- **Even build / even sell `[OFFICIAL]`** — "you cannot erect more than one house on any one property
  of any colour-group until you have built one house on every property of that group. … As you build
  evenly, you must also break down evenly."
- **Building shortage is real, and scarce houses are auctioned `[OFFICIAL]`** — "When the Bank has no
  houses to sell, players wishing to build must wait for some player to return or sell his/her houses
  to the Bank before building. If there are a limited number of houses and hotels available and two or
  more players wish to buy more than the Bank has, the houses or hotels must be sold at auction to the
  highest bidder."
- **Property cannot be sold back to the Bank `[OFFICIAL]`** — the rulebook permits selling
  "Unimproved properties, railroads and utilities (but not buildings) … **to any player** as a private
  transaction for any amount the owner can get". Buildings, and only buildings, go back to the Bank,
  "at any time for one-half the price paid for them". The only way to turn a deed into Bank cash is
  the mortgage.
- **Mortgages `[OFFICIAL]`** — mortgage value printed on the deed; to lift, pay "the amount of the
  mortgage plus 10% interest"; no rent on mortgaged properties; must sell all buildings in the
  colour-group first.
- **Jail `[OFFICIAL]`** — enter via the Go to Jail space, a card, or three consecutive doubles. Exit
  by (1) rolling doubles on any of your next three turns, (2) a Get Out of Jail Free card, (3) buying
  such a card from another player, or (4) "paying a fine of $50 before you roll the dice on either of
  your next two turns. If you do not throw doubles by your third turn, you must pay the $50 fine."
  The fine is fixed at $50.
- **Income Tax `[OFFICIAL]`** — "You may estimate your tax at $200 and pay the Bank, or you may pay
  10% of your total worth". The choice must be made *before* totalling your worth.
- **No player-to-player loans `[OFFICIAL]`** — under MISCELLANEOUS: "Money can be loaned to a player
  only by the Bank and then only by mortgaging property. **No player may borrow from or lend money to
  another player.**"
- **Win condition `[OFFICIAL]`** — "A bankrupt player must immediately retire from the game. The last
  player left in the game wins." Last-player-standing, no scoring.

Two official *variants* also exist in that same rulebook and matter a lot for a digital clone —
they are covered in §1.14 and §1.15 and are tagged `[OFFICIAL]`, not `[HOUSE-RULE]`.

---

## 1. The house rules catalogue

Each entry gives: mechanical definition an implementer can code · how common it is and where it comes
from · effect on game length and balance · recommended default for a richup-style clone.

### 1.1 Free Parking jackpot `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (UNVERIFIED for richup)

> Hasbro-endorsed. Won the 2014 public vote as **"Free Parking, Fast Cash"** and has been printed in
> the classic Monopoly game guide since 2015 **as an optional variant**. Still a house rule.

**Deviates from:** "A player landing on this place does not receive any money, property or reward of
any kind." (§0)

**Mechanical definition.** Maintain a single game-scoped integer `freeParkingPot`, initialised to
`seed` (see variants). Every payment a player makes *to the Bank* that qualifies is added to the pot
instead of vanishing. When a player's token comes to rest on the Free Parking space, transfer the full
pot to that player and reset the pot to `resetValue`.

Qualifying payments — this is the axis the variants differ on:

| Variant | What feeds the pot | Notes |
|---|---|---|
| **Everything** (most common) | Income Tax, Luxury Tax, all Chance/Community Chest cards that say "pay", jail fine, Street Repairs / General Repairs assessments | Hasbro's own wording is "all taxes and fees" |
| **Taxes only** | Income Tax ($200 or 10%) + Luxury Tax ($75/$100) | Much smaller pot, ~$275/lap max per player |
| **Fines only** | Card penalties + $50 jail fine, no tax squares | Rare; smallest pot |
| **Fixed $500 seed** | Pot starts at $500 and is re-seeded to $500 after each collection, in addition to accumulation | Guarantees a non-trivial payout; documented as a common variant, e.g. the Wikibooks variant list describes the pool as built "from bank contributions, fines/taxes, or mixed bills" (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>) |

Hasbro's exact 2014 wording: *"All taxes and fees will be collected in the middle of the game board,
if you land on Free Parking, it's your lucky day: collect all the money from the middle of the board."*
(<https://www.cbsnews.com/news/hasbro-asks-facebook-fans-for-their-monopoly-rules/>,
<https://toybook.com/for-monopoly-lovers-hasbro-brings-down-the-house-rules/>)

**DESIGN DECISIONS the sources don't settle** — pick one and document it in the UI tooltip:
- Does *rent paid to another player* enter the pot? **No** — rent is a player-to-player transfer, not
  a fee to the Bank. Including it would be a much more radical economy change.
- Does the pot reset to `0` or back to `seed`? Recommend reset to `seed` when a seed is configured,
  else `0`.
- Do purchase prices, house prices, or mortgage interest count? **No** — these are asset transactions,
  not fees.
- Can a player collect the pot when they land on Free Parking *from jail* on the same turn? The
  Wikibooks variant list notes some tables bar this (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>).
  Recommend **allow** — the exclusion is fiddly and unpopular.
- Does the pot go to the last player standing / get redistributed at game end? Recommend: it is simply
  forfeited.

**Commonality.** The single most widespread Monopoly house rule in the English-speaking world. It won
Hasbro's 2014 global Facebook vote outright and headlined the resulting product
(<https://investor.hasbro.com/news-releases/news-release-details/hasbro-unveils-worlds-favorite-house-rules-be-included-future>).

**Effect on length and balance.** Strongly **lengthening**. It is a pure money faucet: cash that the
official design permanently removes from circulation is instead recycled back to players. Monopoly's
official economy is deflationary on purpose — outside the $200 GO salary there is no external income —
and bankruptcy is what ends games. As one widely-quoted line puts it, "the object of Monopoly is to
bankrupt everyone but yourself. So any house rule that works against that premise is going to
artificially make the game longer"
(<https://www.monopolyland.com/what-does-free-parking-mean-in-monopoly/>). Balance-wise it is a large
random windfall uncorrelated with skill, so it raises variance and dampens the effect of good play.

**Recommended default: OFF.** Ship it prominently as a toggle (players will look for it), but default
a clone to the official behaviour so the median game is short.

---

### 1.2 Double GO money — land exactly on GO `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (UNVERIFIED for richup)

> Hasbro-endorsed. Won the 2014 vote as **"Dash for the Cash"**; printed in the game guide since 2015
> as an optional variant.

**Deviates from:** "$200 is paid only once each time around the board" regardless of landing vs
passing. (§0)

**Mechanical definition.** On a player's token coming to rest exactly on square index 0 (GO), pay
`goSalary * 2` (i.e. $400) instead of `goSalary`. Passing over GO without stopping still pays $200.

Hasbro wording: *"Landed on Go! Amazing, you get to double your salary — 400 Monopoly dollars instead
of 200 Monopoly dollars."*
(<https://toybook.com/for-monopoly-lovers-hasbro-brings-down-the-house-rules/>)

**DESIGN DECISIONS:**
- Does an *Advance to GO* card trigger the double? The card makes you *reach* GO, and the official
  rulebook already treats that as "reaching it … by instructions on the card" and pays $200. Recommend
  **yes, it pays double** — players expect consistency, and it is the more common table reading.
  UNVERIFIED either way; no source resolves it.
- Does "Go back 3 spaces" or a Chance move that terminates on GO trigger it? Same rule: any turn that
  *ends* on GO.
- If a player is sent to Jail on the same turn, no GO money at all — that is already `[OFFICIAL]`.

**Commonality.** Very common; a top-five global vote winner.

**Effect on length and balance.** Mildly **lengthening**. The extra $200 fires on roughly 3.1% of
turns (GO's steady-state landing probability is about 3.14%, see §3), so it adds roughly $6 of expected
income per turn per player — small compared with the Free Parking pot. Balance impact is close to
neutral because every player passes GO at a similar rate. Its real cost is that it slightly delays the
first bankruptcies.

**Recommended default: OFF**, but this is the least harmful of the popular faucets — a clone that wants
one "fun" default on could pick this one.

---

### 1.3 No auctions `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (likely; see note)

**The single most impactful deviation in the game.** Give this toggle the most careful UI treatment.

**Deviates from:** "If you do not wish to buy the property, the Banker sells it at auction to the
highest bidder." (§0)

**Mechanical definition.** When the player who landed on an unowned property declines to buy it at
the printed price, the property simply remains unowned in the Bank and play passes to the next player.
No auction is offered.

Two sub-variants worth exposing separately:
- **No auction at all** (the house rule as normally played).
- **Auction only if nobody can afford it** — rare; not recommended, adds a confusing conditional.

**Commonality.** Extremely common — probably the *most* commonly played house rule, and unusually, it
is mostly played by accident. Most players do not know the auction clause exists; it is routinely
listed as the rule everybody misses
(<https://fbesq.com/did-you-know/monopoly-rule-most-people-miss/>,
<https://www.belloflostsouls.net/2024/04/monopoly-is-pretty-short-to-play-if-you-actually-play-by-the-rules.html>).
A third-party description of richup.io states that auctions are adjustable in its game settings, which
is why I tag it `[RICHUP-TOGGLE]` — but the richup lane owns confirming this
(<https://www.solitaireparadise.com/games_list/monopoly.html>).

**Why it makes games drag — the mechanism, precisely.** Three compounding effects:

1. **Properties enter play far more slowly.** With auctions, a property is owned the first time any
   token stops on it. Without auctions, a property is owned only when a player who *both* lands on it
   *and* wants it and can afford it arrives. Early in the game, when everyone is cash-rich, this is
   nearly the same; from the mid-game on, when players are conserving cash, deeds sit unowned for
   many laps.
2. **Monopolies form later, so the rent engine never starts.** Monopoly's endgame is driven entirely
   by houses, and houses require a complete colour set. Every lap where a deed sits in the Bank is a
   lap where nobody can build. The result is the classic experience of "suffering long action-free
   periods in which you endlessly circle the board in search of the streets you need to complete a
   set" (<https://www.belloflostsouls.net/2024/04/monopoly-is-pretty-short-to-play-if-you-actually-play-by-the-rules.html>).
3. **It removes the game's main cash sink and its main skill expression.** Auctions drain player cash
   into the Bank at prices set by competition, and they are the primary place where reading opponents
   pays off — bidding up a property you do not want, or paying over odds to deny a set. Without them,
   the price of every property is a fixed constant and the only decision is binary.

Played by the written rules including auctions, a typical game runs **under ninety minutes**; house
rules are what turned it into the multi-hour slog of popular reputation
(<https://www.goodreads.com/quotes/6829029-instead-people-created-their-own-house-rules-rules-that-often-made>,
<https://slate.com/life/2026/07/monopoly-go-rules-board-games.html>).

**Balance.** Turning auctions off flattens skill differentials and rewards raw dice luck, since the
only way to acquire a deed becomes landing on it.

**Recommended default: auctions ON (i.e. this house rule OFF).** For a digital clone this is close to
non-negotiable: auctions are trivially cheap to run in software (a timed bidding widget, no
book-keeping), they are the biggest single lever on game length, and they are the correct rule. Do
expose the toggle, with a warning in the tooltip that turning auctions off makes games substantially
longer.

**Implementation note.** Design the auction as a bounded, timed interaction from the start —
e.g. 8–12s countdown, resets on each new high bid, minimum increment $1 or a configurable step, and an
explicit "pass" that removes a player from that auction. An unbounded auction UI is where clones stall.
Also handle: all players pass (property stays with the Bank), the winner cannot pay (re-run or void),
and bidding above one's cash (disallow; cap the bid input at liquid cash, or allow mortgaging mid-auction).

---

### 1.4 No rent collected while the owner is in jail `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (UNVERIFIED for richup)

> Hasbro-endorsed. Won the 2014 vote as the **"Frozen Assets Rule"**.

**Deviates from:** "Even though you are in Jail, you may buy and sell property, buy and sell houses and
hotels and collect rents." (§0)

**Mechanical definition.** When resolving a rent payment, if `property.owner.inJail === true`, the rent
is waived entirely — the landing player pays nothing and the owner receives nothing. The money is not
created or destroyed; the transfer simply does not happen.

Hasbro wording: *"When in jail, a player cannot collect any rent money from other players."*
(<https://toybook.com/for-monopoly-lovers-hasbro-brings-down-the-house-rules/>)

**Sub-variants:**
- **Half rent while jailed** — the owner collects 50%. Documented in the Wikibooks variant list as an
  alternative (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>).
- Does it apply to the *"just visiting"* state? **No** — only to genuinely jailed players. Make sure
  the data model distinguishes these two, since they share a board square.

**DESIGN DECISION:** does a jailed owner still collect on *mortgage-adjacent* income, utilities and
railroads? Recommend the rule applies uniformly to all rent including railroads and utilities.

**Commonality.** Common, and a 2014 vote winner.

**Effect on length and balance.** **Shortening** — one of the few house rules that is. It destroys
money outright (the payer keeps it, but the owner's expected income falls), and it strongly changes
jail strategy: under official rules the late game makes jail a *safe haven* (you cannot land on
opponents' hotels while jailed, but you still collect), so good players deliberately stay in jail. This
rule removes that, pushing players back onto the board and into other people's rents.

**Balance.** Interacts badly with a player who is randomly jailed while holding the board's biggest
hotel set — swingy and feels unfair. It also creates a perverse incentive for opponents to *want* a
big owner jailed.

**Recommended default: OFF.** It is a real strategic change and it is popular, but the official
jail-as-haven dynamic is a genuinely interesting part of the late game and worth preserving by default.

---

### 1.5 Snake eyes bonus `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (UNVERIFIED for richup)

> Hasbro-endorsed. Won the 2014 vote as **"Lucky Roller"**.

**Deviates from:** nothing — the official rules attach no reward to any particular double.

**Mechanical definition.** On a roll where both dice show 1, pay the roller $500 from the Bank. The
roll then resolves completely normally: the player still moves 2 spaces, still resolves that square,
and — because it is a double — still rolls again. Three doubles in a row still sends them to jail.

Hasbro wording: *"Rolled Snake Eyes (double ones)? Collect 500 Monopoly dollars."*
(<https://www.cbsnews.com/news/hasbro-asks-facebook-fans-for-their-monopoly-rules/>)

**DESIGN DECISIONS:**
- Does it pay when the snake-eyes roll is the *third* consecutive double that sends the player to
  jail? Recommend **no** — going to jail overrides. UNVERIFIED.
- Does it pay when rolling snake eyes to get *out of jail*? Recommend **yes** (it is doubles, they get
  out, and they collect). UNVERIFIED.
- Amount should be a configurable number, not hard-coded $500.

**Commonality.** Common, and a 2014 vote winner.

**Effect on length and balance.** **Lengthening**, and more than it looks. Snake eyes occur on 1/36 of
rolls (2.78%), and the average player makes slightly more than one roll per turn because of doubles, so
this is roughly $14+ of expected income per player per turn — comparable to a meaningful fraction of
the $200 GO salary spread over a lap. It is pure luck income, so it raises variance and rescues players
from the bankruptcy spiral that ends games.

**Recommended default: OFF.**

---

### 1.6a "See the Sights" — must complete one full lap before buying property `[HOUSE-RULE]`

> Hasbro-endorsed. Won the 2014 vote as **"See the Sights"**. Note this is a *purchase restriction*,
> and it is frequently confused with §1.6b, which is a different rule with the opposite effect.

**Deviates from:** "Whenever you land on an unowned property you may buy that property from the Bank at
its printed price." (§0)

**Mechanical definition.** Track `player.lapsCompleted`, incremented each time the player passes or
lands on GO after the initial placement. While `lapsCompleted < 1`, the player may not buy property.

**DESIGN DECISIONS, and they matter:**
- What happens when a not-yet-eligible player lands on an unowned property? Under the official auction
  clause the property must then be auctioned. But can *other* players, also on their first lap, bid?
  Recommend: **during the first lap, unowned properties landed on are not auctioned either** — this
  matches how tables actually play it, and an auction that only some players may enter is confusing.
  UNVERIFIED; no source addresses it.
- Does landing exactly on GO count as completing the lap immediately, before that square resolves?
  Recommend yes.

**Commonality.** Common enough to win the 2014 vote, though noticeably less universal than Free Parking.

**Effect on length and balance.** Clearly **lengthening**, and the Monopoly Land rule survey flags it
as one that "significantly slows" the game
(<https://www.monopolyland.com/monopoly-house-rules/>). It delays the entire property-acquisition phase
by a full lap for everyone and, combined with no-auctions, can push the start of real play back
several laps. Balance-wise it is roughly fair (everyone is restricted equally) but it slightly
advantages the player who moves last in turn order on the lap boundary.

**Recommended default: OFF.**

---

### 1.6b Immunity / grace period on the first lap, or a free first property `[HOUSE-RULE]`

Distinct from §1.6a and often muddled with it. Two separate folk rules:

**(i) Rent immunity for the first lap.** No rent is charged to or by any player until they have passed
GO once. Mechanically: skip rent resolution when `payer.lapsCompleted < graceLaps` (default 1).
UNVERIFIED as a widespread rule — it appears in casual play and in various digital clones rather than
in any documented ruleset, and I found no authoritative source for it. **Effect:** mildly
*shortening* in the sense that it does not add money, but it delays the pressure phase; overall
close to neutral. **Default: OFF.**

**(ii) Free first property.** Each player begins owning one or more randomly dealt deeds. This is not
really a folk rule — it is `[OFFICIAL]` in both printed short-game variants (see §1.14/§1.15), where
the Banker deals three deeds free (SHORT GAME) or two deeds paid-for (TIME LIMIT GAME). If a clone
wants "everyone starts with property", implement it as those official variants rather than inventing
one. **Default: OFF**, exposed as `dealStartingProperties: 0 | 2 | 3` with a paid/free sub-option.

---

### 1.7 Unlimited houses / no building shortage `[HOUSE-RULE]` `[RICHUP-TOGGLE]` (UNVERIFIED for richup)

**Deviates from:** "32 houses and 12 hotels" plus "When the Bank has no houses to sell, players wishing
to build must wait", plus the scarce-house auction clause. (§0)

**Mechanical definition.** Remove the `housesRemaining` / `hotelsRemaining` counters entirely (or set
them to infinity). Building is limited only by cash and by the even-build rule.

Two intermediate options worth exposing:
- **Unlimited houses but track hotels** — rarely played, not recommended.
- **Finite supply but no auction on scarcity** — first-come, first-served instead of auctioning scarce
  houses. This is the more common accidental deviation; most tables have never heard of the
  house auction. The Wikibooks variant list also records tables that let players "buy hotels directly
  despite house shortage" (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>).

**Commonality.** Very common, mostly by ignorance rather than choice. Digital clones frequently ship
unlimited by default because tracking a finite pool is extra state.

**Effect on length and balance.** **Lengthening**, and it removes a whole strategic layer. The
32-house limit enables the **housing shortage squeeze**: a strong player deliberately builds to four
houses on several sets rather than upgrading to hotels, starving the Bank of houses so opponents
physically cannot develop. That is one of the sharpest expert plays in the game, and unlimited houses
deletes it. It also means every wealthy player can convert cash into rent capacity without limit,
which paradoxically *slows* the endgame because there is no bottleneck forcing a decisive confrontation.

**Recommended default: finite supply ON (32 houses / 12 hotels), with the scarce-house auction ON.**
The clone should show remaining house/hotel counts in the UI — it is a strategically load-bearing
number and paper players can see the box.

---

### 1.8 Building without a full colour set / building unevenly `[HOUSE-RULE]`

**Deviates from:** the full-colour-set requirement and the even-build clause. (§0)

**Two separate toggles — do not merge them.**

**(a) Build without owning the full set.** Mechanically: drop the
`ownsAllOfColorGroup(player, group)` precondition on house purchase. Documented in the Wikibooks
variant list as a common variant (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>) and in the
Monopoly Land survey, which notes it "fundamentally changes strategy"
(<https://www.monopolyland.com/monopoly-house-rules/>).

**(b) Build unevenly.** Mechanically: drop the constraint
`houses[p] <= min(houses[q] for q in group) + 1` on purchase and its mirror on sale. Lets a player
stack four houses on the single highest-traffic property of a set (e.g. New York Avenue in orange,
Illinois Avenue in red) and none elsewhere.

**Commonality.** (a) is a moderately common house rule. (b) is more often an implementation bug than a
deliberate rule; tables that play it usually do so without realising there is an even-build clause.

**Effect on length and balance.**
- (a) is strongly **lengthening** and heavily damages the design. The entire trading economy exists
  because completing a set is the only route to houses; if you can build on a lone deed, nobody needs
  to trade, and the negotiation layer — the best part of the game — evaporates. It also removes the
  point of blocking a set.
- (b) is roughly length-neutral but **increases skill differential sharply**, because it lets an
  informed player concentrate capital on the statistically best square in a group. Combined with the
  landing-probability data in §3, an expert would put four houses on New York Avenue alone and never
  build on St. James Place. That is a big edge over a casual opponent.

**Recommended default: both OFF** (i.e. enforce full-set requirement and even build). If you expose
(b) at all, label it clearly as an expert/chaos option.

---

### 1.9 Loans between players `[HOUSE-RULE]`

**Deviates from:** "No player may borrow from or lend money to another player." (§0, MISCELLANEOUS) —
this is one of the clearest explicit prohibitions in the rulebook, and most players have no idea it
exists.

**Mechanical definition.** Needs more specification than most house rules, because "a loan" is not one
thing. Minimum viable version for a clone:

- A loan is a **trade term**, not a separate system: extend the trade UI so an offer may include
  `cash now` from A to B plus a `promise` object `{ amount, dueInLaps | dueInTurns, collateral: [deedIds] }`.
- On the due trigger, the debtor's cash is automatically debited. If they cannot pay, the collateral
  deeds transfer automatically.
- Without automatic enforcement, "loans" in an online game are just gifts plus social pressure, which
  is an abuse and collusion vector (two accounts, one funds the other).

Simpler and much safer variants that get most of the value:
- **Allow $0-for-property gifts in trades** (one-sided trades). This is already legal under the
  official rules — "for any amount the owner can get" permits $1 — and covers most of what people
  actually want.
- **Bank loans instead of player loans.** The Wikibooks variant list documents a bank-loan house rule:
  $500 available at any time, the recipient pays $100 back at each GO as interest, payoff is barred
  until they have passed GO once, and debts transfer to creditors on bankruptcy
  (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>). This is cleaner to implement and does not
  create collusion channels between accounts.
- **Co-ownership** — players jointly own a property and split rent. Recorded in the Monopoly Land
  survey, which flags that it "increases complexity"
  (<https://www.monopolyland.com/monopoly-house-rules/>). It was also among the rules Hasbro's 2014
  campaign publicised as things fans do
  (<https://www.nbcnews.com/news/amp/ncna61821>). Not recommended for v1 — the rent-splitting,
  building-rights and bankruptcy edge cases are a large amount of work.

**Effect on length and balance.** **Lengthening**, and in online play actively harmful. Loans keep
nearly-bankrupt players alive, which is exactly the thing that ends games. In a multiplayer clone with
ranked play they are also the primary collusion mechanism.

**Recommended default: OFF.** Ship one-sided trades (which are official anyway) and consider the bank
loan as an optional toggle. Skip player-to-player debt entirely in v1.

---

### 1.10 Starting cash variations `[HOUSE-RULE]` (values other than $1500) `[RICHUP-TOGGLE]` (likely)

**Official baseline `[OFFICIAL]`:** $1500. Note also the `[OFFICIAL]` multi-board rule of $1500
*per board* when several boards are joined (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>).

**Mechanical definition.** A single configurable integer `startingCash`. Trivial to implement; the
interesting part is which presets to offer.

Common presets seen in play and in digital clones:

| Preset | Amount | Character |
|---|---|---|
| Official | $1500 | Baseline |
| Fast / aggressive | $1000 | Bankruptcies arrive faster; auctions get cheap quickly |
| Casual | $2000–$2500 | Everyone can buy everything they land on for the first two laps |
| Party | $5000+ | Property acquisition becomes automatic; the early game is skipped |

**Effect on length and balance.** Monotonic and predictable: **more starting cash = longer game**,
because bankruptcy is the terminal condition and starting cash is the buffer against it. Higher
starting cash also *reduces* skill expression in the early game — with $1500 you cannot buy everything
you land on, and choosing what to skip (and what to bid on) is a real decision; with $5000 the decision
disappears.

Lower starting cash is one of the cleanest **shortening** levers available and is a better way to make
a fast mode than most alternatives, because it does not change any rule — only a number.

**Recommended default: $1500**, with presets at $1000 / $1500 / $2000 / $3000 and a free-entry field.

---

### 1.11 Trading with the Bank / selling property back to the Bank `[HOUSE-RULE]`

**Deviates from:** the official rules, under which the Bank *never* buys a deed back. Only buildings go
back to the Bank ("at any time for one-half the price paid for them"), and the mortgage is the only way
to convert a deed into Bank cash. (§0)

**Mechanical definition** (of the house rule). Add a "Sell to Bank" action on any unmortgaged,
unimproved deed, paying `salePrice` and returning the deed to the unowned pool.
`salePrice` variants seen in play:
- **Half the printed price** — most common, mirrors the buildings rule.
- **Full printed price** — badly broken; makes property a risk-free store of value.
- **Mortgage value** — nearly identical in effect to just mortgaging, and therefore pointless.

**Commonality.** Common as an *accidental* rule (players assume symmetry with buildings) rather than a
deliberate one. Genuinely rare as a stated house rule.

**Effect on length and balance.** **Lengthening** and economically corrosive. It turns every deed into
a liquid asset, which means a player facing a large rent bill can always raise cash without the painful
choice the mortgage system is designed to force. It also undermines the auction and trading economies:
if the Bank always pays half, no player will ever accept less than half in a trade, which collapses the
negotiation range. And it returns deeds to the unowned pool late in the game, extending the
acquisition phase indefinitely.

**Recommended default: OFF.** The official mortgage system already does this job.

Related and much safer: **selling buildings back to the Bank at half price** is `[OFFICIAL]` and must
be implemented, including the "break down evenly" constraint and the "one hotel equals five houses"
conversion.

---

### 1.12 Get out of jail by paying a variable fee `[HOUSE-RULE]`

**Official baseline `[OFFICIAL]`:** a flat $50 fine, payable before rolling on either of the next two
turns, compulsory on the third turn if doubles have not been rolled.

**Mechanical definition** (of the house rule). Replace the constant with a function. Variants seen:
- **Escalating fee** — $50 for the first jail visit, $100 for the second, $150 for the third, etc.
  (per-player counter).
- **Percentage of net worth** — e.g. 10% of total assets, mirroring the Income Tax option. Punishes
  leaders, which is a deliberate rubber-band mechanic.
- **Fee scales with game progress** — e.g. $50 × number of completed laps.
- **Configurable flat amount** — simply expose `jailFine` as a number. The simplest and the one to
  ship.

Related, and worth separating into its own toggle:
- **"Roll then pay" in the same turn `[OFFICIAL]`** — under the SHORT GAME rules you "may try
  to roll doubles and, failing to do so, pay the $50 on the same turn", i.e. you must exit on your
  next turn. This is official text but belongs to the SHORT GAME, not the standard game. It is a
  genuine **shortening** lever and a good candidate for a "fast mode" bundle.
- **Maximum turns in jail** — official is 3. Some tables play 2 or unlimited. Unlimited is a
  significant *lengthening* change because it makes jail a permanent safe haven in the late game.
- **Collect $200 when passing GO on the way out?** — always yes; no rule says otherwise.

**Commonality.** Variable fees are UNVERIFIED as a widespread folk rule; I found no authoritative
source. They appear mostly in digital variants and custom rulesets. The *configurable flat fee* is
common in clones.

**Effect on length and balance.** Small either way. Escalating fees are mildly shortening; net-worth
percentage fees are a rubber-band that lengthens games by suppressing the leader.

**Recommended default:** flat `$50`, `maxJailTurns = 3`, roll-then-pay-same-turn **OFF** (bundle it
into fast mode).

---

### 1.13 Triple rent on Boardwalk / landmark bonuses `[HOUSE-RULE]` — UNVERIFIED

**Deviates from:** the rent table printed on each Title Deed, and the `[OFFICIAL]` double-rent-on-
unimproved-full-set rule ("the owner may then charge double rent for unimproved properties in that
colour-group").

**Mechanical definition.** A per-square rent multiplier map, e.g.
`rentMultipliers = { 39: 3.0 }` (Boardwalk / Mayfair), applied after all other rent computation.
Generalise it — the same mechanism covers "double rent on the last square", "×2 on all dark blues",
or a themed board's landmark squares.

**Commonality.** UNVERIFIED. I could not find a documented, widely-played "triple rent on Boardwalk"
house rule. What the searches surface instead are (a) the official double-rent-on-full-unimproved-set
rule, which people sometimes misremember as a Boardwalk special, and (b) *product* variants where
extra building tiers raise Boardwalk's rent — e.g. skyscrapers taking Boardwalk to $3000 against the
standard $2000 hotel rent (<https://monopoly.fandom.com/wiki/Boardwalk>, accessed via search
summary; the wiki itself returned HTTP 402 on direct fetch). Treat the folk rule as anecdotal.

**Effect on length and balance.** **Shortening** (a bigger rent spike ends games faster) but very
swingy — it concentrates the game's outcome on a single low-frequency square. (Boardwalk does not
appear in the probability table in §3.4; dark blue is a two-property set that is passed far more often
than it is landed on, so its rent is already high-variance.) It converts Monopoly further into a lottery.

**Recommended default: OFF.** Implement the multiplier map anyway — it is cheap, and it is the right
substrate for custom boards, themed editions and community rulesets later.

---

### 1.14 SHORT GAME `[OFFICIAL]` — official printed variant, not the standard game

This is **not** a house rule. It is printed in the standard Hasbro rulebook under "RULES for a SHORT
GAME (60 to 90 minutes)" and consists of five changed rules, quoted from the rulebook:

1. "the Banker shuffles then deals **three** Title Deed cards to each player. These are free — no
   payment to the Bank is required."
2. "You need only **three** houses (instead of four) on each lot of a complete colour-group before you
   may buy a hotel. Hotel rent remains the same. The turn-in value is still one-half the purchase
   price, which in this game is one house less than in the regular game."
3. "If you land in Jail you **must** exit on your next turn by 1) using a Get Out of Jail Free card if
   you have (or can buy) one; or 2) rolling doubles; or 3) paying $50. Unlike the standard rules, you
   may try to roll doubles and, failing to do so, pay the $50 on the same turn."
4. "The penalty for landing on Income Tax is a flat $200." (No 10% option.)
5. "END OF GAME: The game ends when **one** player goes bankrupt. The remaining players value their
   property: (1) cash on hand; (2) lots, utilities and railroads owned, at the price printed on the
   board; (3) any mortgaged property owned, at one-half the price printed on the board; (4) houses,
   valued at purchase price; (5) hotels, valued at purchase price including the value of the three
   houses turned in. **The richest player wins!**"

**Why this matters for a clone.** Every one of these five is a clean, independently-toggleable
shortening lever with official pedigree, and #5 gives you a fully specified net-worth valuation
function that you need anyway for the time-limited mode (§1.15) and for the scoreboard. Implement the
valuation function once and reuse it everywhere.

**Recommended: expose as a one-click "Short game" preset** that flips the five toggles together, and
also expose each toggle individually.

---

### 1.15 TIME LIMIT GAME `[OFFICIAL]` — official printed variant; the key mode for a digital clone

Also printed in the standard rulebook, verbatim:

> "ANOTHER GOOD SHORT GAME — TIME LIMIT GAME. Before starting, agree upon a definite hour of
> termination, when the richest player will be declared the winner. Before starting, the Banker
> shuffles and cuts the Title Deed cards and deals two to each player. Players immediately pay the Bank
> the price of the properties dealt to them."

**This is `[OFFICIAL]`, not a house rule.** It is easy to assume "timed game, highest net worth wins"
is a digital-clone invention; it is in the 1997 Parker Brothers rulebook.

**Mechanical definition.**
- Config: `timeLimitMinutes` (or `turnLimit`, which is fairer online — see below), and
  `dealStartingProperties = 2, paid = true`.
- At the limit, compute each surviving player's net worth using the SHORT GAME valuation (§1.14 #5):
  cash + printed price of unmortgaged lots/utilities/railroads + half printed price of mortgaged
  property + purchase price of houses + purchase price of hotels (including the houses turned in).
  Rank descending.
- Bankrupt players rank below all survivors, ordered by elimination time.

**DESIGN DECISIONS:**
- **Turn limit beats wall-clock limit for online play.** A wall-clock limit gives an advantage to
  whoever happens to be mid-turn, punishes players on slow connections, and interacts badly with
  disconnects and reconnect grace periods. A limit expressed in **complete rounds** (every player has
  had the same number of turns) is symmetric and easy to display. Offer both; default to rounds.
- Should the timer end mid-round? No — always complete the current round so turn order confers no
  advantage.
- Show a live net-worth leaderboard during timed games. This is the single biggest UX win of the mode
  and it is what makes a Monopoly clone watchable.

**Effect on length and balance.** By construction, **bounded length** — the main reason to ship it.
Balance shifts noticeably: with a known horizon, mortgaging aggressively near the end is punished (a
mortgaged deed is worth half), hoarding cash becomes viable, and the housing squeeze loses value
because there is no time to convert it into bankruptcies. Expect materially different optimal play,
which is worth telling bot-AI implementers explicitly.

**Recommended default: OFF for casual games, but ship it prominently.** For a web clone competing on
"a game you can finish in a lunch break", a bounded mode is close to a product requirement. Note the
official version also deals two paid-for properties at the start; that is a separate sub-toggle and
worth defaulting ON inside the preset since it accelerates the opening.

---

### 1.16 Other rules found, briefly

All `[HOUSE-RULE]` unless marked.

- **Three in a Row** — if three consecutive players each land on a different unowned property, each
  collects $500. Recorded in the Monopoly Land survey
  (<https://www.monopolyland.com/monopoly-house-rules/>). Money faucet; lengthening. **Default OFF.**
- **Break the Bank** — half the Bank's money is scattered across the board at setup for players to
  grab. Same source, which explicitly does not recommend it (it damages the physical components — a
  constraint that does not apply to a clone, but the balance objection does). Massively lengthening.
  **Default OFF.**
- **Mom's jail pass** — a designated player always leaves jail free. Was one of the ten rules in
  Hasbro's 2014 debate; the Monopoly Land survey notes its sexist framing
  (<https://www.monopolyland.com/monopoly-house-rules/>,
  <https://investor.hasbro.com/news-releases/news-release-details/facebook-fans-determine-worlds-favorite-house-rules-be-included>).
  Do not ship.
- **Railroad travel** — a player landing on a railroad may move to any other railroad owned by the
  same owner, and must still pay rent there. Documented in the Wikibooks variant list as "travelling
  railroads" (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>). Adds movement chaos; roughly
  length-neutral. **Default OFF**, but a fun option.
- **Chance optional, Community Chest mandatory** — landing on Chance becomes an optional draw.
  Wikibooks. Reduces variance slightly. **Default OFF.**
- **Six railroads / utility rebalance** — a board-layout variant with utilities repriced to $200,
  mortgage $100, rent $300–$400. Wikibooks. Out of scope for a standard-board clone.
- **Free Parking pot includes Get Out of Jail Free cards or unsold deeds** — Wikibooks records tables
  that put non-cash items in the pot. Fiddly; **default OFF.**
- **Passing players contribute to the pot** — a Free Parking sub-variant where merely passing the
  square costs money. Wikibooks. **Default OFF.**
- **Auction losers owe rent to the winner** — an unusual variant recorded in the Wikibooks list.
  UNVERIFIED as common. **Do not ship.**
- **Flat Income Tax of $200 (no 10% option)** — `[OFFICIAL]` inside the SHORT GAME; a house rule if
  applied to the standard game. Simplifies UI meaningfully (no "compute my net worth" prompt) and is
  a mild shortening lever for weak players, who would otherwise mis-choose. **Consider default ON**
  for a clone purely on UX grounds, clearly labelled.
- **No rent unless the owner claims it** — `[OFFICIAL]` ("before the second player following throws
  the dice") but meaningless in software, where collection is automatic. Do not implement. Some
  clones expose a "manual rent claim" gimmick toggle; it is an anti-feature online.
- **Double rent on unimproved full colour set** — `[OFFICIAL]`, frequently mistaken for a house rule.
  Must be implemented, and it must apply "to unmortgaged properties even if another property in that
  colour-group is mortgaged." Some clones get this wrong.

---

## 2. Hasbro's own "House Rules" products and rulebook additions

### 2.1 The 2014 "Great Monopoly House Rules Debate" and the House Rules Edition

**What happened.** In March 2014 Hasbro ran a campaign on the Monopoly Facebook page — then about
11.4 million followers — putting **ten** commonly-played house rules to a public vote. Voting ran
25 March to 3 April 2014 (CBS gives the window as 26 March to 3 April; the Hasbro release says the
debate ran from 25 March). The top five were announced on 4 April 2014.

Sources:
<https://investor.hasbro.com/news-releases/news-release-details/facebook-fans-determine-worlds-favorite-house-rules-be-included>,
<https://investor.hasbro.com/news-releases/news-release-details/hasbro-unveils-worlds-favorite-house-rules-be-included-future>,
<https://www.cbsnews.com/news/hasbro-asks-facebook-fans-for-their-monopoly-rules/>,
<https://www.nbcnews.com/news/amp/ncna61821>,
<https://www.washingtontimes.com/news/2014/apr/4/hasbro-picks-5-house-rules-for-new-monopoly-set/>,
<https://toybook.com/for-monopoly-lovers-hasbro-brings-down-the-house-rules/>,
<https://www.licenseglobal.com/toys-games/hasbro-unveils-monopoly-house-rules>,
<https://slate.com/business/2014/03/monopoly-house-rules-hasbro-is-crowdsourcing-changes-to-the-official-rulebook.html>.

**A note on sourcing.** Hasbro's own investor/newsroom pages for this release repeatedly timed out on
direct fetch during this research; the wording below is taken from secondary coverage that quotes the
release (Toy Book, CBS News, License Global, Washington Times) and is consistent across all of them.
Flagged as secondary-sourced.

**The five winning rules, with Hasbro's card names and wording:**

| # | Card name | Hasbro's wording | Covered here |
|---|---|---|---|
| 1 | **Free Parking, Fast Cash** | "All taxes and fees will be collected in the middle of the game board, if you land on Free Parking, it's your lucky day: collect all the money from the middle of the board." | §1.1 |
| 2 | **Dash for the Cash** | "Landed on Go! Amazing, you get to double your salary — 400 Monopoly Dollars instead of 200 Monopoly Dollars." | §1.2 |
| 3 | **Frozen Assets Rule** | "When in jail, a player cannot collect any rent money from other players." | §1.4 |
| 4 | **See the Sights** | "Players must travel around the board one complete time before they can begin buying properties." | §1.6a |
| 5 | **Lucky Roller** | "Rolled Snake Eyes (double ones)? Collect 500 Monopoly Dollars." | §1.5 |

**The five that lost.** Not published as a list by Hasbro, and I could not recover it. Two are known
from coverage of the campaign: the "mom can always get out of jail free" rule
(<https://investor.hasbro.com/news-releases/news-release-details/facebook-fans-determine-worlds-favorite-house-rules-be-included>)
and co-ownership of properties by negotiation (<https://www.nbcnews.com/news/amp/ncna61821>). The
Monopoly Land survey lists "Three in a Row", "Break the Bank", "Co-Ownership" and "Mom's Jail Pass"
alongside the five winners, which suggests but does not prove that these were among the ten
(<https://www.monopolyland.com/monopoly-house-rules/>). **UNVERIFIED.**

**The product.** *MONOPOLY: House Rules Edition*, on shelves in select markets in autumn 2014. It
shipped with special **gold-coloured houses** and cards printing the five winning rules. Per the
Monopoly Land survey the edition was discontinued around 2017 (**UNVERIFIED** — single source).

**The rulebook change, and why it does not make these rules official.** Hasbro stated the five chosen
rules "were also included in the classic MONOPOLY game guide beginning in 2015". They appear there as
an **optional house-rules section**, not as changes to the rules of play. The standard game is
unchanged: Free Parking still pays nothing, GO still pays $200 whether you land or pass, and jailed
players still collect rent. Anything that presents these five as the official rules is wrong, and this
is the confusion the file exists to prevent — hence `[HOUSE-RULE]` on all five.

### 2.2 Monopoly: Free Parking Jackpot expansion pack `[HOUSE-RULE]` formalised as a product

Hasbro sells a *Free Parking Jackpot* expansion pack that turns the square into "a spin-it-to-win-it
jackpot", including 32 Free Parking Bonus Cards awarding "free properties, free houses, cash, and
more", drawn by players who land on the marked spaces and spin a spinner
(<https://instructions.hasbro.com/en-us/instruction/monopoly-free-parking-jackpot>; rules summary also
at <https://www.geekyhobbies.com/monopoly-free-parking-jackpot-rules/>). The Hasbro instructions page
itself only links a PDF and does not spell out the pot mechanics in HTML, so the exact seed and
qualifying-payment list are **UNVERIFIED** from the primary source.

Relevance to the clone: it confirms Hasbro treats the Free Parking pot as a *bolt-on* rather than a
rule change, which is exactly how the toggle should be presented.

### 2.3 Other Hasbro rulesets worth knowing

- **SHORT GAME and TIME LIMIT GAME** — both `[OFFICIAL]`, both printed in the standard rulebook. See
  §1.14 and §1.15. These are the most useful official material in this whole document for a clone.
- **Multiple-board play** — the rulebook and the Wikibooks variant list describe joining boards at the
  corners with $1500 starting cash *per board*
  (<https://en.wikibooks.org/wiki/Monopoly/House_Rules>). Out of scope, but the "cash scales with
  board count" idea is a reasonable model if the clone ever ships larger boards.
- **Themed and spin-off editions** (House Divided, Bailout Monopoly, Monopoly Plus, etc.) each carry
  their own rule changes. Not surveyed here; they are product variants rather than house rules.

---

## 3. Balance and game-length analysis

### 3.1 The one-sentence version

Monopoly's official economy is **deflationary by design**. The only inbound money is the $200 GO
salary and a handful of Chance/Community Chest payouts; taxes, fines and building purchases remove
money permanently. Bankruptcy is the terminal condition, so anything that puts money *back* into
player hands lengthens the game, and anything that removes money or accelerates property distribution
shortens it. Almost every popular house rule is a money faucet, which is why the game has its
reputation.

Played strictly by the written rules — auctions included — a typical game is generally reported as
finishing in **under ninety minutes**
(<https://www.belloflostsouls.net/2024/04/monopoly-is-pretty-short-to-play-if-you-actually-play-by-the-rules.html>,
<https://slate.com/life/2026/07/monopoly-go-rules-board-games.html>). Hasbro's own SHORT GAME variant
is labelled "60 to 90 minutes", which implies the standard game is expected to be somewhat longer than
that but not dramatically so.

### 3.2 Which toggles lengthen, which shorten

| Rule | Direction | Magnitude | Mechanism |
|---|---|---|---|
| No auctions (§1.3) | **Longer** | Very large | Deeds stay unowned for many laps; monopolies never form; removes the main cash sink |
| Free Parking jackpot (§1.1) | **Longer** | Large | Recycles all destroyed money; rescues players from bankruptcy |
| Unlimited houses (§1.7) | **Longer** | Large | Removes the housing squeeze, the main forcing mechanism in the late game |
| Build without full set (§1.8a) | **Longer** | Large | Destroys the trading economy; no need to complete sets |
| Higher starting cash (§1.10) | **Longer** | Scales linearly | Bigger buffer against the terminal condition |
| Player loans (§1.9) | **Longer** | Moderate | Keeps near-bankrupt players alive |
| Sell property back to Bank (§1.11) | **Longer** | Moderate | Every deed becomes liquid; no forced hard choices |
| See the Sights / first-lap purchase ban (§1.6a) | **Longer** | Moderate | Delays the entire acquisition phase by a lap |
| Snake eyes bonus (§1.5) | **Longer** | Moderate–large | ≈$14/turn/player of *newly minted* money — see note below |
| Double GO (§1.2) | **Longer** | Small | ≈$6/turn/player of free income |
| Unlimited jail turns | **Longer** | Small | Late-game safe haven becomes permanent |
| — | | | |
| Lower starting cash (§1.10) | **Shorter** | Large | Cleanest lever; changes a number, not a rule |
| Time / turn limit (§1.15) | **Shorter** | Bounded by construction | Hard stop with net-worth ranking |
| SHORT GAME preset (§1.14) | **Shorter** | Large | Deals 3 free deeds, hotels at 3 houses, ends on first bankruptcy |
| Hotels at 3 houses (§1.14 #2) | **Shorter** | Moderate | Rent spikes arrive a full building round earlier |
| Deal starting properties (§1.14/§1.15) | **Shorter** | Moderate | Monopolies and trades start on turn one |
| No rent while jailed (§1.4) | **Shorter** | Small–moderate | Removes income and kills the jail-haven strategy |
| Roll-then-pay in one jail turn (§1.14 #3) | **Shorter** | Small | Nobody sits in jail |
| Flat $200 Income Tax | **Shorter** | Very small | Removes the 10% escape hatch for cash-poor players early |

**A note on the two cash faucets, because the naive arithmetic is misleading.** Per turn per player the
Free Parking pot recycles roughly Income Tax (~2.3% of turns × $200) plus Luxury Tax (~2.1% × $75) plus
card fees — call it **$10–15/turn/player** — which is the *same order* as the snake eyes bonus
(1/36 of rolls × $500 ≈ $14/turn/player). So why is the pot ranked higher? Not the flow rate, but two
structural differences:

1. **Lumpiness.** The pot pays out in single large sums, often several hundred dollars at once, at
   exactly the moment a player is circling the board broke. It is a targeted bankruptcy-rescue
   mechanism. Snake eyes trickles $500 to whoever happens to roll it, rich or poor.
2. **Direction, though it cuts the other way.** Snake eyes *mints* money that never existed; the pot
   only *recycles* money already destined for the Bank. On pure money-supply grounds snake eyes is the
   more inflationary of the two, which is why it is ranked Moderate–large rather than Small here.

Net: they are closer in impact than folk wisdom suggests. If a clone wants exactly one faucet on by
default, double GO money (§1.2, ≈$6/turn/player, evenly distributed, no lumpiness) is the least
distorting of the three. All figures in this note are my own arithmetic from the §3.4 landing
probabilities, not from a published source — **UNVERIFIED**, and worth checking against the clone's own
simulation once the engine exists.

### 3.3 Expected game length — what the simulation literature says

- An absorbing-Markov-chain treatment gives an **expected 37.388 turns** to reach an absorbing (win)
  state, in the simplified model used
  (<https://digitalcommons.sacredheart.edu/cgi/viewcontent.cgi?article=2491&context=acadfest>).
  Treat this as a lower bound on a simplified model rather than a prediction of real play — the same
  literature notes real games run 1–4 hours, and at roughly a minute per turn that implies a couple of
  hundred turns.
- Several fuller academic treatments exist and are worth mining if the clone ever wants tuned
  presets: Bernard's Markov analysis
  (<https://www.carlabernard.ch/beni/downloads/bernard_monopoly.pdf>), a Cornell ORIE writeup
  (<https://people.orie.cornell.edu/shane/pubs/monopoly.pdf>), an Uppsala thesis on strategies via
  Markov chains and simulation
  (<https://uu.diva-portal.org/smash/get/diva2:1471765/FULLTEXT01.pdf>), and a Williams College paper
  (<https://web.williams.edu/Mathematics/sjmiller/public_html/hudson/Li_Markov%20Chains%20in%20the%20Game%20of%20Monopoly.pdf>).
  Note that essentially all of this literature models the **official** rules; I found no published
  simulation that quantifies the length delta from house rules. Claims about "makes the game 3× longer"
  circulating online are **UNVERIFIED**. If the clone wants real numbers, running the sim in-house
  against its own engine is the honest path — and it is cheap once the engine exists.

### 3.4 Landing-probability findings — directly relevant to bot AI

These are steady-state end-of-turn probabilities: the chance that a given turn *ends* on that square.
They are not uniform (1/40 = 2.5%) because of the Go To Jail square, the Chance/Community Chest move
cards, and the three-doubles rule, all of which pull tokens toward Jail.

**Top squares** (Durango Bill, "intend one turn in jail" model,
<http://durangobill.com/MnplyStats.html>):

| Rank | Square | Probability |
|---|---|---|
| — | **Jail / In Jail (total)** | **4.69%** |
| 1 | Illinois Ave (red) | 3.21% |
| 2 | New York Ave (orange) | 3.18% |
| 3 | GO | 3.14% |
| 4 | B&O Railroad | 3.02% |
| 5 | Pennsylvania Railroad | 2.98% |
| 6 | Reading Railroad | 2.92% |
| — | Tennessee Ave (orange) | 2.88% |
| — | St. James Place (orange) | 2.72% |

A second independent simulation puts the Jail steady-state at **5.87%** and confirms Illinois Avenue
as the highest-probability *property*, noting it sits **14 squares** from Jail — two sevens, the
modal dice outcome — and that "seven of the twelve most commonly landed spaces after Jail are within
one dice roll away"
(<https://towardsdatascience.com/oh-the-places-youll-go-in-monopoly-96abf70cdbd7/>). The two sources
differ on the Jail figure because they model the choice to leave jail differently; the *ranking* is
stable across both, and the ranking is what matters for a bot.

*Reliability caveat — read this before hard-coding any of the numbers above.* The per-square figures
came through a single automated extraction of durangobill.com, and that same extraction also produced
an aggregate "orange group 5.42%" which is impossible against its own per-square rows
(2.72 + 2.88 + 3.18 = 8.78%). One demonstrably wrong figure from an extraction means the neighbouring
figures deserve suspicion too, and the two sites that would let me cross-check cheaply are unreachable
from here (tkcs-collins.com fails TLS, monopoly.fandom.com returns HTTP 402). What *is* solid is the
**ranking** — Jail first, Illinois Ave the top property, orange and the railroads clustered near the
top — because it is independently corroborated by the Towards Data Science simulation, and the ranking
is what all the bot-AI advice below actually rests on. Treat the two-decimal values as indicative;
re-verify against the primary sources before baking them into a bot evaluation function.

**The Jail effect, stated for implementers.** Jail is the board's gravity well: it is the single
most-occupied square, tokens are teleported there constantly, and every square 5–9 ahead of Jail
therefore receives elevated traffic (5–9 being the dense middle of the two-dice distribution).
The **orange group (St. James Place, Tennessee Ave, New York Ave) sits 6, 8 and 9 squares past Jail** —
directly in that peak. That, and not the rent table, is why orange is the most valuable set in the game.

**Return on investment.** Truman Collins' analysis — the canonical reference on this — combines
landing frequency with property and building costs and concludes that **the orange monopoly is the
most efficient use of money**, and that the single best ROI investment on the board is **the third
house on New York Avenue**
(<http://www.tkcs-collins.com/truman/monopoly/monopoly.shtml>; the site's HTTPS certificate failed on
direct fetch during this research, so the figures here come from secondary summaries and are
**flagged as secondary-sourced** — verify against the page before hard-coding anything). Collins also
gives Illinois Avenue around **3.18%** as the most probable non-jail square, consistent with the
tables above.

Railroads are worth calling out separately: with four squares they collectively see more traffic than
any colour group, and the Chance deck contains multiple "advance to the nearest railroad" cards. They
are cheap and cash-flow-positive early, but they cannot be developed, so their value is front-loaded.

**Bot AI implications (short list):**
1. Rank acquisition targets by *expected rent per dollar*, not by printed rent. Orange first, then
   light blue (cheap, high frequency), then red.
2. Value trades using landing probability, not price parity. Giving up a dark blue for an orange is
   usually correct even though dark blue "looks" more expensive.
3. In the late game, prefer to *stay* in jail once opponents have developed sets — unless the "no rent
   while jailed" toggle (§1.4) is on, which inverts this. **The bot must read the toggle state.**
4. Build to exactly four houses on multiple sets before any hotel when the finite-supply toggle is on,
   to trigger the housing squeeze. If unlimited houses is on, this play is worthless — again, read the
   toggle.
5. In auctions, bid up to the property's expected-rent value, plus a denial premium if it completes an
   opponent's set. With no-auctions on, this entire module is dead code.
6. Under a time/turn limit (§1.15), switch the objective function from "bankrupt opponents" to
   "maximise net worth at the horizon" — that means less mortgaging near the end and more cash
   retention. Different toggle, different bot.

---

## 4. (Moved) Recommended toggle set

This section proposed a settings list and presets for the clone. The settings we actually ship are in
`docs/SHARED.md` and `docs/ENGINE.md`; richup's real settings are in `richup-rules-and-settings.md`
and `richup-observed-live.md` §2.

---

## 5. Sources

Primary / rules text:
- Parker Brothers / Hasbro standard Monopoly rulebook, part 40009-I-Rev 2 (PDF) — <https://cdn.1j1ju.com/medias/d3/22/83-monopoly-rulebook.pdf> (fetched and text-extracted; all `[OFFICIAL]` quotations above come from this)
- Hasbro official instructions, Monopoly Game — <https://instructions.hasbro.com/en-gb/instruction/monopoly-game>
- Hasbro official instructions, Monopoly Free Parking Jackpot — <https://instructions.hasbro.com/en-us/instruction/monopoly-free-parking-jackpot>
- Wikibooks, Monopoly/Official Rules — <https://en.wikibooks.org/wiki/Monopoly/Official_Rules>

Hasbro 2014 House Rules campaign:
- Hasbro press release, campaign launch — <https://investor.hasbro.com/news-releases/news-release-details/facebook-fans-determine-worlds-favorite-house-rules-be-included> (also mirrored at <https://newsroom.hasbro.com/news-releases/news-release-details/facebook-fans-determine-worlds-favorite-house-rules-be-included>) — *repeated fetch timeouts; content via search summaries*
- Hasbro press release, results — <https://investor.hasbro.com/news-releases/news-release-details/hasbro-unveils-worlds-favorite-house-rules-be-included-future> and the PDF at <https://investor.hasbro.com/static-files/a36d15f5-245a-477b-b6c7-22c5a81797b6> — *repeated fetch timeouts; content via search summaries*
- The Toy Book — <https://toybook.com/for-monopoly-lovers-hasbro-brings-down-the-house-rules/> (five winners, full wording)
- CBS News — <https://www.cbsnews.com/news/hasbro-asks-facebook-fans-for-their-monopoly-rules/> (ten rules put to a vote, 26 Mar–3 Apr 2014; wording for Free Parking Fast Cash and Lucky Roller)
- NBC News — <https://www.nbcnews.com/news/amp/ncna61821>
- Washington Times — <https://www.washingtontimes.com/news/2014/apr/4/hasbro-picks-5-house-rules-for-new-monopoly-set/> (*HTTP 403 on direct fetch; content via search summary*)
- License Global — <https://www.licenseglobal.com/toys-games/hasbro-unveils-monopoly-house-rules>
- Slate (campaign launch) — <https://slate.com/business/2014/03/monopoly-house-rules-hasbro-is-crowdsourcing-changes-to-the-official-rulebook.html>
- The Motley Fool — <https://www.fool.com/investing/general/2014/04/04/by-popular-demand-hasbro-adds-5-house-rules-to-mon.aspx>
- Casual Game Revolution — <https://casualgamerevolution.com/blog/2014/03/news-flash-vote-on-monopoly-house-rules-board-games-for-the-blind>

House-rule catalogues:
- Wikibooks, Monopoly/House Rules — <https://en.wikibooks.org/wiki/Monopoly/House_Rules> (the broadest single catalogue found)
- Monopoly Land, "The Best Monopoly House Rules" — <https://www.monopolyland.com/monopoly-house-rules/>
- Monopoly Land, "Monopoly Free Parking Rules Explained" — <https://www.monopolyland.com/what-does-free-parking-mean-in-monopoly/>
- Monopoly Land, "Monopoly Rent Rules Explained" — <https://www.monopolyland.com/monopoly-rent-rules/>
- Jacob Davenport, "Monopoly Home Rules" — <https://brightestbulb.net/games/monopoly/home_rules/>
- Geeky Hobbies, Free Parking Jackpot rules — <https://www.geekyhobbies.com/monopoly-free-parking-jackpot-rules/>
- Monopoly Wiki, House Rules — <https://monopoly.fandom.com/wiki/House_Rules> (*HTTP 402 on direct fetch; content via search summaries only*)
- Monopoly Wiki, Free Parking / Boardwalk — <https://monopoly.fandom.com/wiki/Free_Parking>, <https://monopoly.fandom.com/wiki/Boardwalk> (*same 402 limitation*)

Auctions and game length:
- Bell of Lost Souls, "Monopoly Plays Pretty Fast, If You Actually Play By the Rules" — <https://www.belloflostsouls.net/2024/04/monopoly-is-pretty-short-to-play-if-you-actually-play-by-the-rules.html>
- Fritz & Bianculli, "Monopoly Auction Rules Most Players Miss" — <https://fbesq.com/did-you-know/monopoly-rule-most-people-miss/>
- Slate, "Have We Been Playing Monopoly Wrong All Along?" — <https://slate.com/life/2026/07/monopoly-go-rules-board-games.html>
- Goodreads quote (house rules made the game long) — <https://www.goodreads.com/quotes/6829029-instead-people-created-their-own-house-rules-rules-that-often-made>

Probability, simulation and strategy:
- Truman Collins, "Probabilities in the Game of Monopoly" — <http://www.tkcs-collins.com/truman/monopoly/monopoly.shtml> (*SSL handshake failure on direct fetch; figures via secondary summaries — verify before relying on exact numbers*)
- Durango Bill, "Monopoly Board Location Probabilities" — <http://durangobill.com/MnplyStats.html>
- Towards Data Science, "Oh, the Places You'll Go in Monopoly" — <https://towardsdatascience.com/oh-the-places-youll-go-in-monopoly-96abf70cdbd7/>
- Sacred Heart University, "Using Markov Chains to Analyze Board Games" — <https://digitalcommons.sacredheart.edu/cgi/viewcontent.cgi?article=2491&context=acadfest>
- Benjamin Bernard, "Monopoly — An Analysis using Markov Chains" — <https://www.carlabernard.ch/beni/downloads/bernard_monopoly.pdf>
- Cornell ORIE, monopoly.pdf — <https://people.orie.cornell.edu/shane/pubs/monopoly.pdf>
- Williams College, "Markov Chains in the Game of Monopoly" — <https://web.williams.edu/Mathematics/sjmiller/public_html/hudson/Li_Markov%20Chains%20in%20the%20Game%20of%20Monopoly.pdf>
- Uppsala University, "Exploring strategies in Monopoly using Markov chains and simulation" — <https://uu.diva-portal.org/smash/get/diva2:1471765/FULLTEXT01.pdf>
- University of Illinois, "A Markovian Exploration of Monopoly" — <https://pi4math.web.illinois.edu/wp-content/uploads/2014/10/Gartland-Burson-Ferguson-Markovopoly.pdf>
- Rempton Games strategy guide — <https://remptongames.com/2020/11/16/the-ultimate-monopoly-strategy-guide/>

richup.io (secondary only — the richup research lane owns this):
- <https://richup.io/> and <https://richup.io/info> (*marketing copy only; no settings list exposed*)
- Solitaire Paradise description of richup.io — <https://www.solitaireparadise.com/games_list/monopoly.html> (states auctions are adjustable in game settings)
- SEELE AI games description — <https://www.seeles.ai/games/simulation/richup-io-online-real-estate-strategy-game>

### Fetch failures worth recording
`investor.hasbro.com` and `hasbro.gcs-web.com` timed out on every attempt (4 attempts, 2 hosts).
`monopoly.fandom.com` returns HTTP 402 to this fetcher. `washingtontimes.com` returns HTTP 403.
`tkcs-collins.com` fails TLS handshake. Anything sourced only through those hosts is marked
secondary-sourced above.
