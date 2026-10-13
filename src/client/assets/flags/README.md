# Flags

Round country flags from **circle-flags** by HatScripts, used under the MIT License
(see `LICENSE.md` in this folder).

- Source: https://github.com/HatScripts/circle-flags
- Taken from the `gh-pages` branch at commit `379588b5da95` (2026-07-26), via
  `https://hatscripts.github.io/circle-flags/flags/<code>.svg`.
- Files keep upstream's names, the ISO 3166-1 alpha-2 country code, so they can be
  refreshed by downloading the same names again. `src/client/tileArt.ts` maps each
  `CountryId` to its code.

Only the countries the maps use are copied in. Adding a map with a new country means
adding its flag here and its code in `tileArt.ts`; the type checker flags the missing code.
