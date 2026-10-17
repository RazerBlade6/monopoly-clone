import type { CountryId } from '../shared/types';

/**
 * Country groups are colored by evenly spacing hues around the color wheel
 * in the order `CountryId` lists them, so any subset of the 14 countries a
 * given map actually uses still gets well-separated colors without a
 * hand-maintained per-country table.
 */
const COUNTRY_ORDER: readonly CountryId[] = [
  'brazil', 'canada', 'china', 'france', 'germany', 'india', 'ireland',
  'israel', 'italy', 'japan', 'romania', 'turkey', 'united-kingdom',
  'united-states-of-america',
];

function countryHue(id: CountryId): number {
  const index = COUNTRY_ORDER.indexOf(id);
  return Math.round((360 / COUNTRY_ORDER.length) * Math.max(index, 0));
}

export function countryColor(id: CountryId): string {
  return `hsl(${countryHue(id)}, 62%, 52%)`;
}

/**
 * The same hue washed over a whole city tile, so the country reads at a glance
 * without a colour bar. Kept faint and biased toward the felt at the outer edge:
 * the tile still has to carry white text and a price on top of it.
 *
 * This is the tint, not a flag image — emoji flags fall back to two-letter codes
 * on some platforms, so nothing load-bearing may depend on them rendering.
 */
export function countryTint(id: CountryId): string {
  const hue = countryHue(id);
  return `linear-gradient(hsla(${hue}, 62%, 52%, 0.30), hsla(${hue}, 55%, 30%, 0.10))`;
}

/**
 * A tile's own hue, lifted: what washes over it when it changes hands. A city's is its
 * country's; anything else takes the tiles' violet surface, brightened.
 */
export function tileShine(id: CountryId | null): string {
  return id ? `hsl(${countryHue(id)}, 70%, 66%)` : 'hsl(255, 34%, 58%)';
}

export function displayName(id: string): string {
  return id.split('-').map(w => (w[0] ?? '').toUpperCase() + w.slice(1)).join(' ');
}
