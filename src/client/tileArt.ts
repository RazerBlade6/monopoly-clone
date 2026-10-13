import type { CountryId, Tile } from '../shared/types';

/**
 * Every visual a tile needs beyond its data. Country groups are identified by a
 * flag badge rather than a colour stripe — the maps model groups as real countries,
 * so the flag is both the most legible grouping cue and the most obvious one.
 *
 * Flags are round SVGs from circle-flags (MIT; see `assets/flags/README.md`), and the other
 * tiles' icons are SVGs from SVG Repo (see `assets/icons/README.md`), all bundled rather
 * than hotlinked so the app makes no third-party requests. An icon with no file yet falls
 * back to its emoji (see ASSETS.md).
 */

/** ISO 3166-1 alpha-2 codes, which are circle-flags' file names. */
const FLAG_CODES: Record<CountryId, string> = {
  brazil: 'br',
  canada: 'ca',
  china: 'cn',
  france: 'fr',
  germany: 'de',
  india: 'in',
  ireland: 'ie',
  israel: 'il',
  italy: 'it',
  japan: 'jp',
  romania: 'ro',
  turkey: 'tr',
  'united-kingdom': 'gb',
  'united-states-of-america': 'us',
};

/** Bundled flag URLs by file, content-hashed by Vite. */
const FLAG_URLS = import.meta.glob<string>('./assets/flags/*.svg', {
  eager: true, query: '?url', import: 'default',
});

export function flagUrl(id: CountryId): string {
  const url = FLAG_URLS[`./assets/flags/${FLAG_CODES[id]}.svg`];
  // A missing file is a build mistake, not a runtime condition; fail loudly in development.
  if (!url) throw new Error(`no flag asset for ${id} (${FLAG_CODES[id]}.svg)`);
  return url;
}

/** Bundled icon URLs by file, content-hashed by Vite. */
const ICON_URLS = import.meta.glob<string>('./assets/icons/*.svg', {
  eager: true, query: '?url', import: 'default',
});

/** An icon file by its name in ASSETS.md, or null while that art hasn't been added. */
export function iconUrl(name: IconName): string | null {
  return ICON_URLS[`./assets/icons/${name}.svg`] ?? null;
}

export type IconName =
  | 'airport' | 'power-company' | 'water-company' | 'gas-company'
  | 'start' | 'prison' | 'vacation' | 'go-to-prison'
  | 'treasure' | 'surprise' | 'earnings-tax' | 'premium-tax' | 'tax-refund'
  | 'house' | 'hotel';

/**
 * Icons drawn dark on a transparent ground, which vanish on the board's dark tiles. They are
 * lightened at display time (`.icon-img--dark`) rather than edited, so each file stays exactly
 * as its licence granted it.
 */
const DARK_ICONS: ReadonlySet<IconName> = new Set(['earnings-tax', 'prison', 'house', 'hotel']);

export function isDarkIcon(name: IconName): boolean {
  return DARK_ICONS.has(name);
}

/** Which icon a non-city tile shows; null for a city, which shows its flag. */
export function tileIconName(tile: Tile): IconName | null {
  switch (tile.type) {
    case 'airport': return 'airport';
    case 'company':
      if (tile.name.startsWith('Water')) return 'water-company';
      if (tile.name.startsWith('Gas')) return 'gas-company';
      return 'power-company';
    case 'corner':
      switch (tile.subtype) {
        case 'start': return 'start';
        case 'jail': return 'prison';
        case 'free_parking': return 'vacation';
        case 'go_to_jail': return 'go-to-prison';
      }
      break;
    case 'bonus':
      switch (tile.bonusType) {
        case 'treasure': return 'treasure';
        case 'surprise': return 'surprise';
        case 'tax': return 'earnings-tax';
        case 'premium-tax': return 'premium-tax';
        case 'tax-refund': return 'tax-refund';
      }
      break;
    case 'city':
      return null;
  }
  return null;
}

/** Companies differ by name across maps (Power / Water / Gas), so key off the name. */
function companyIcon(name: string): string {
  if (name.startsWith('Water')) return '💧';
  if (name.startsWith('Gas')) return '🔥';
  return '⚡';
}

/** The emoji fallback for a non-city tile whose icon file hasn't been added yet. */
export function tileIcon(tile: Tile): string {
  switch (tile.type) {
    case 'airport':
      return '✈️';
    case 'company':
      return companyIcon(tile.name);
    case 'corner':
      switch (tile.subtype) {
        case 'start': return '🏁';
        case 'jail': return '🔒';
        case 'free_parking': return '🌴';
        case 'go_to_jail': return '🚔';
      }
      break;
    case 'bonus':
      switch (tile.bonusType) {
        case 'treasure': return '🧰';
        case 'surprise': return '❓';
        case 'tax': return '🧾';
        case 'premium-tax': return '💎';
        case 'tax-refund': return '💸';
      }
      break;
    case 'city':
      return '';
  }
  return '';
}

/** The small line under a corner tile's icon, and the label for tax tiles. */
export function tileSubLabel(tile: Tile): string | null {
  if (tile.type === 'bonus') {
    if (tile.bonusType === 'tax') return `${tile.taxPercentage}%`;
    if (tile.bonusType === 'premium-tax') return `$${tile.taxAmount}`;
    if (tile.bonusType === 'tax-refund') return `+$${tile.taxAmount}`;
  }
  return null;
}
