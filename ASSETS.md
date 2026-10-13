# Tile art to source

Replacements for the emoji the board uses today (`src/client/tileArt.ts`). The same files
will also be used in the properties panel and on deed cards, so they appear at several sizes.

Flags done; all 15 icons in; three icon licences still to confirm (see below).

## Flags: done

All 14 are in `src/client/assets/flags/`, from HatScripts' `circle-flags` (MIT). The source,
commit and licence are in that folder's `README.md` and `LICENSE.md`, and the attribution
is in `public/THIRD_PARTY_NOTICES.txt`, which the home page links to.

## Icons: all 15 in, three licences open

All fifteen are in `src/client/assets/icons/` and wired in. `assets/icons/README.md` has each
one's SVG Repo page and licence. Three still block the merge into `dev`:

- **`prison.svg`:** the page supplied (398098, police-car-light) is go-to-prison's icon. The
  jail-bars icon's own page is needed.
- **`hotel.svg`:** MIT, which needs the copyright holder's name for the notice.
- **`water-company.svg`:** CC Attribution, which needs the author's name for the credit.

Lucky Wheel has no utilities.

## Format

- SVG preferred. If PNG, at least 256×256.
- Square, with a little padding for icons. Readable at about 20px; corner icons are drawn larger.
- File names as above, so wiring them up is mechanical.
