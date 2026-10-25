# Research index

What we found out about richup.io and the official rules, gathered 2026-08-20 by parallel research
lanes plus a live browser capture of richup, and a screen-recording analysis on 2026-10-17. This
folder records **observations and sources only**. What we decided to build from them is in `docs/`
(start with `docs/PROJECT.md`).

**Read this page before any of the files.** It is a reconciliation table, not a table of contents. The
files were written independently and contradict each other in a few places, listed below with a
ruling. If you read `board-data.md` first you will take Hasbro's rent table for richup's, which is the
single easiest way to get the board wrong.

> **The four maps are not interchangeable reskins.** Mr. Worldwide is a **48-tile board**, Lucky Wheel
> has **no companies** and a `tax-refund` tile no other map has, and Death Valley has **six-property
> groups**. Board size, group size, company count and the tile-type set all vary by map. And richup's
> **card decks are not captured for any map**: they are per-map and entirely server-side, and Lucky
> Wheel resolves 40% of its landings through a deck nobody has seen.

---

## The one rule

> **`richup-maps-all.md` is the authority for all board data** (all four maps, every tile and rent),
> and its schema is canonical. `richup-observed-live.md` §9 repeats the Classic board in an earlier
> schema — the two were machine-diffed and every tile matches, so §9 is kept for narrative context only.
> **`richup-observed-live.md` is the authority for every other richup.io fact** — settings, terminology,
> tech stack, monetization.
> It is the only file whose data came from richup's own running client — a private room was created,
> the game joined, and the React props of all 40 board tiles read directly. Everything else about
> richup in this set came from bundle-grepping, userscripts, screenshots, or search, and defers to it.

For **official Hasbro rules**, the authority is `rules-official.md` (four rulebook PDFs, text extracted,
board tiles verified by rendering the PDF pages) with `rules-edge-cases.md` for anything adversarial.

---

## The files

| File | Lines | What it is | Trust it for |
|---|---|---|---|
| **`richup-maps-all.md`** | 513 | **All four board maps**, complete verified tile/rent data + JSON | **All board data.** Authority for every map. |
| **`richup-observed-live.md`** | 447 | Live capture of richup.io: settings panel verbatim, all 40 tiles with exact rents, tech stack | **All richup facts.** Highest-confidence file in the set. |
| `rules-official.md` | 447 | Hasbro's rules from four rulebook printings, every claim tagged and sourced | The canonical ruleset, and where the 2021 Game Guide changed it |
| `rules-edge-cases.md` | 805 | Bankruptcy, insolvency, trading, building shortages, timing, richup's configurable rules | Every adversarial case the rulebook leaves open |
| `cards.md` | 319 | 32 Chance/Community Chest cards verbatim + JSON with a documented effect schema | Card effects and deck mechanics |
| `board-data.md` | 441 | Standard 40-space board as table + validated JSON, money, supply | The **standard Hasbro** board only — see conflict #1 |
| `house-rules-common.md` | 1035 | House-rule catalogue, Hasbro's 2014 fan vote, game-length/balance analysis, landing probabilities | What each variant does to a game, and bot AI priors (§3.4) |
| `richup-rules-and-settings.md` | 264 | richup's settings schema read out of its shipped Zod validator | The **complete** settings key list, incl. keys the UI doesn't show |
| `richup-ux-and-flow.md` | 741 | richup's screens, turn flow, auction/trade UI, turn clock, disconnect handling | How richup looks and flows |
| `richup-motion-observed.md` | 110 | Dice throw, dice look, token glide and their timings, measured frame by frame from a screen recording (2026-10-17) | **All richup animation timing and feel.** Closes `richup-ux-and-flow.md`'s open question 9 |
| `richup-vs-monopoly-diff.md` | 276 | Deviation table, terminology map, IP/legal notes | The diff, and §4 on what not to copy |

---

## Conflicts, and how they resolve

### 1. Does richup use the standard board's prices and rents? **No.**
`board-data.md` originally concluded "prices appear to match the standard board (LIKELY)" from two
legible price tags in a screenshot. **That was wrong and has been corrected in place.** The live capture
shows richup re-tuned every colour group:

- **Prices:** richup makes prices strictly ascending inside each group where Hasbro repeats one —
  Italy 130/140/160, Germany 180/190/200, China 210/220/240, France 260/270/280, UK 290/300/320,
  USA 360/400. Only Brazil (60/60) keeps a repeated price; even Israel differs — 100/**110**/120 vs
  Hasbro's 100/100/120.
- **Rents:** re-tuned in both directions across every group. Only Boardwalk's ladder
  (New York, 50/200/600/1400/1700/2000) survives unchanged.
- **Tile order:** Surprise sits at index **8** (not 7) and Water Company at index **27** (not 28).
  `board-data.md` found these independently from the board render — the two agree.

→ **Use `richup-observed-live.md` §9.** `board-data.md` remains correct and useful for the *standard*
Hasbro board; just don't read its numbers as richup's.

### 2. Does richup have a turn timer? **Yes, and no.**
`richup-rules-and-settings.md` proves from richup's `.strict()` Zod schema that **no turn-timer room
setting exists**. `richup-vs-monopoly-diff.md` and `richup-ux-and-flow.md` document a **Turn Clock**
(chess-style, refilling, shipped v1.17 on 15 Aug 2026, with an ask-opponents-for-more-time mechanic).
Both are right: the clock is **hardcoded server-side behaviour, not a configurable option**. The live
settings panel confirms it — no timer control appears anywhere in it.

### 3. What are richup's setting defaults?
`richup-rules-and-settings.md` read them from the client's fallback default object and flagged them
UNVERIFIED. The live capture read them off the actual rendered controls. **They agree**, so treat these
as confirmed for a freshly created private room:

| Setting | Default |
|---|---|
| `x2 rent on full-set properties` | **OFF** |
| `Auction` | **OFF** |
| `Mortgage` | **OFF** |
| `Vacation cash` | OFF |
| `Don't collect rent while in prison` | OFF |
| `Even build` | **ON** |
| `Randomize player order` | **ON** |
| `Starting cash` | **$1500** (options 500–3000) |
| `Maximum players` | 4 |

> The headline: **three rules that are mandatory in official Monopoly ship OFF by default** — no monopoly
> rent doubling, no auctions, no mortgaging. A default richup game is deliberately a simpler, faster game.

### 4. Max players: 2–8 or 2–6? **Both — 7 and 8 are paid.**
Resolved across three sources. The live Classic-map dropdown offers **2 through 8**, so
`richup-observed-live.md` §2 records the full range. But `richup-ux-and-flow.md` found the cap is
**2–6 free, with 7–8 a paid store upgrade**, and `richup-vs-monopoly-diff.md` independently found a
per-map extension unlocking 7–8. The options render for everyone; entitlement is checked elsewhere.
Not confirmed by clicking (7/8 was never selected during the live capture).

### 5. richup's house-rule toggles
`house-rules-common.md` tags some variants `[RICHUP-TOGGLE]`, and it flags those tags itself as guesswork.
→ **Superseded** by `richup-rules-and-settings.md` §A and `richup-observed-live.md` §2. The rest of that
file (the catalogue, the balance analysis, the landing probabilities) stands on its own.

### 6. Tax amounts differ three ways
Hasbro classic: Income Tax **$200 or 10%**, Luxury Tax **$75**. Hasbro 2021 Game Guide: Income Tax flat
**$200** (the 10% option was dropped), Luxury Tax **$100**. richup: "Earnings Tax" **10% of net worth**,
"Premium Tax" flat **$75**.

---

## What nobody could verify — real gaps, not oversights

These are server-side in richup and were confirmed absent from both shipped bundles by direct grep:

1. **START salary** (the pass-GO amount) — no `passStart` / `startBonus` / `goMoney` identifier exists.
2. **Prison release fee** — no `prisonFee` / `payToLeave` identifier exists.
3. **Company (utility) rent multipliers** — utilities carry no rent array at all in client state, only
   `price: 150`. Hasbro's 4×/10× is the obvious guess but is *not* confirmed for richup.
4. **Surprise / Treasure card text and count** — entirely server-side. Three independent lanes confirmed
   this. What *is* known: the decks are named `treasure` and `surprise`, deck state is
   `{pardonCardHolderId, currentIndex}` (so **one Pardon card per deck**, fixed-order rotating index),
   and decks are per-map.
5. **Turn clock durations** in seconds.

---

## Tags used in every file

`[OFFICIAL]` = Hasbro, `[RICHUP-DEFAULT]` = richup out of the box, `[RICHUP-TOGGLE]` = a richup option,
`[HOUSE-RULE]` = popular but unofficial. Every rule statement carries one; keep them apart.
