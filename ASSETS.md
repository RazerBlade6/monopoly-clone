# Tile art to source

Replacements for the emoji the board uses today (`src/client/tileArt.ts`). The same files
will also be used in the properties panel and on deed cards, so they appear at several sizes.

**14 flags + 15 icons** cover all four maps. House and Hotel are optional.

## Flags: 14 countries

Cropped to a circle and centred on the tile's inner border. Square artwork with the key
element centred works best; a rectangular flag loses detail in the crop (China's stars sit
left, the US canton sits in a corner). Round sets exist already, e.g. HatScripts'
`circle-flags` on GitHub, which I believe is MIT-licensed. Check its licence before using it.

| File | Country | Maps |
|---|---|---|
| `flags/brazil.svg` | Brazil | Classic, Mr. Worldwide |
| `flags/canada.svg` | Canada | Death Valley |
| `flags/china.svg` | China | Classic, Mr. Worldwide, Lucky Wheel |
| `flags/france.svg` | France | Classic, Mr. Worldwide |
| `flags/germany.svg` | Germany | all four |
| `flags/india.svg` | India | Mr. Worldwide |
| `flags/ireland.svg` | Ireland | Lucky Wheel |
| `flags/israel.svg` | Israel | Classic, Mr. Worldwide |
| `flags/italy.svg` | Italy | Classic, Mr. Worldwide, Lucky Wheel |
| `flags/japan.svg` | Japan | Mr. Worldwide |
| `flags/romania.svg` | Romania | Lucky Wheel |
| `flags/turkey.svg` | Turkey | Lucky Wheel |
| `flags/united-kingdom.svg` | United Kingdom | all four |
| `flags/united-states-of-america.svg` | United States | all four |

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

**Classic only, for a first pass:** 8 flags (Brazil, Israel, Italy, Germany, China, France,
United Kingdom, United States) and 12 icons (everything except Gas Company, Tax Refund, House
and Hotel).

## Format

- SVG preferred. If PNG, at least 256×256.
- Square, with a little padding for icons. Readable at about 20px; corner icons are drawn larger.
- File names as above, so wiring them up is mechanical.
