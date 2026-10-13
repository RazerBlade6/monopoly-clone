# Tile art to source

Replacements for the emoji the board uses today (`src/client/tileArt.ts`). The same files
will also be used in the properties panel and on deed cards, so they appear at several sizes.

Flags done; 14 of 15 icons in, `airport.svg` missing, ten icon licences to confirm.

## Flags: done

All 14 are in `src/client/assets/flags/`, from HatScripts' `circle-flags` (MIT). The source,
commit and licence are in that folder's `README.md` and `LICENSE.md`, and the attribution
is in `public/THIRD_PARTY_NOTICES.txt`, which the home page links to.

## Icons: 14 of 15 in, one missing

Fourteen are in `src/client/assets/icons/` and wired in. Still to do:

- **`airport.svg` is missing.** The board shows ✈️ for airports until it's added.
- **Ten licences are unconfirmed.** SVG Repo licenses each icon by its collection, and
  ten files carry nothing that identifies their source. `assets/icons/README.md` lists
  them; each needs its SVG Repo page to confirm the licence and any attribution.

Lucky Wheel has no utilities.

## Format

- SVG preferred. If PNG, at least 256×256.
- Square, with a little padding for icons. Readable at about 20px; corner icons are drawn larger.
- File names as above, so wiring them up is mechanical.
