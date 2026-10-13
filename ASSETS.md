# Tile art to source

Replacements for the emoji the board uses today (`src/client/tileArt.ts`). The same files
will also be used in the properties panel and on deed cards, so they appear at several sizes.

**15 icons** still to source; the flags are done. House and Hotel are optional.

## Flags: done

All 14 are in `src/client/assets/flags/`, from HatScripts' `circle-flags` (MIT). The source,
commit and licence are in that folder's `README.md` and `LICENSE.md`, and the attribution
is in `public/THIRD_PARTY_NOTICES.txt`, which the home page links to.

## Icons: 15

| File | For | Maps | Emoji today |
|---|---|---|---|
| `icons/airport.svg` | All six airports share it (TLV, MUC, CDG, JFK, YYZ, LHR) | all four | ✈️ |
| `icons/power-company.svg` | Utility | Classic, Mr. Worldwide, Death Valley | ⚡ |
| `icons/water-company.svg` | Utility | Classic, Mr. Worldwide, Death Valley | 💧 |
| `icons/gas-company.svg` | Utility | Mr. Worldwide | 🔥 |
| `icons/start.svg` | Corner | all four | 🏁 |
| `icons/prison.svg` | Corner | all four | 🔒 |
| `icons/vacation.svg` | Corner | all four | 🌴 |
| `icons/go-to-prison.svg` | Corner | all four | 🚔 |
| `icons/treasure.svg` | Card tile | all four | 🧰 |
| `icons/surprise.svg` | Card tile | all four | ❓ |
| `icons/earnings-tax.svg` | Tax tile (10%) | all four | 🧾 |
| `icons/premium-tax.svg` | Tax tile ($75) | all four | 💎 |
| `icons/tax-refund.svg` | Bonus tile (+$50) | Lucky Wheel | 💸 |
| `icons/house.svg` | *Optional.* Built on a city, shown 1–4 times, very small | all four | 🏠 |
| `icons/hotel.svg` | *Optional.* Built on a city | all four | 🏨 |

Lucky Wheel has no utilities.

**Classic only, for a first pass:** 12 icons (everything except Gas Company, Tax Refund,
House and Hotel).

## Format

- SVG preferred. If PNG, at least 256×256.
- Square, with a little padding for icons. Readable at about 20px; corner icons are drawn larger.
- File names as above, so wiring them up is mechanical.
