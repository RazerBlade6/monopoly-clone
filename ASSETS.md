# Tile art to source

Replacements for the emoji the board uses today (`src/client/tileArt.ts`). The same files
will also be used in the properties panel and on deed cards, so they appear at several sizes.

All done: 14 flags and 15 icons, all attributed.

## Flags: done

All 14 are in `src/client/assets/flags/`, from HatScripts' `circle-flags` (MIT). The source,
commit and licence are in that folder's `README.md` and `LICENSE.md`, and the attribution
is in `public/THIRD_PARTY_NOTICES.txt`, which the home page links to.

## Icons: done

All fifteen are in `src/client/assets/icons/`, wired in, and attributed. Each one's SVG
Repo page, author and licence is in `assets/icons/README.md`, and the credits are in
`public/THIRD_PARTY_NOTICES.txt`.

Lucky Wheel has no utilities.

## Format

- SVG preferred. If PNG, at least 256×256.
- Square, with a little padding for icons. Readable at about 20px; corner icons are drawn larger.
- File names as above, so wiring them up is mechanical.
