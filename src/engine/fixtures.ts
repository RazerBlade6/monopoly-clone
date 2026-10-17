/**
 * Fixture maps for engine tests. Deliberately independent of src/data/maps —
 * the engine must never assume a 40-tile board, a 3-property group, or that
 * companies exist, and these fixtures are built to break exactly those
 * assumptions if they creep in.
 */
import type { CityRents, CountryId, GameMap, RoomSettings, Tile } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';

// ─── Test rng helpers ──────────────────────────────────────────────────────

/** A single die value 1-6, as the [0,1) bucket rollDie() maps back to n. */
export function dieVal(n: 1 | 2 | 3 | 4 | 5 | 6): number {
  return (n - 0.5) / 6;
}

/** Deals fixed values in order, then repeats the last one forever (never throws mid-test). */
export function queueRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)]!;
    i++;
    return v;
  };
}

/** rng() just under 1: makes Fisher-Yates shuffle a no-op, so deck/turn order stays as given. */
export function identityRng(): number {
  return 0.999999;
}

export function settingsFor(overrides: Partial<RoomSettings> = {}): RoomSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

function cityTile(index: number, name: string, countryId: CountryId, base: number): Tile {
  const rents = [
    Math.round(base * 0.1),
    Math.round(base * 0.5),
    Math.round(base * 1.5),
    Math.round(base * 4),
    Math.round(base * 6),
    Math.round(base * 8),
  ] as unknown as CityRents;
  return { index, type: 'city', name, countryId, price: base, rents, housePrice: Math.round(base / 4), hotelPrice: Math.round(base / 4) };
}

function airportTile(index: number, name: string): Tile {
  return { index, type: 'airport', name, price: 200, rents: [25, 50, 100, 200] };
}

function companyTile(index: number, name: string): Tile {
  return { index, type: 'company', name, price: 150 };
}

function countrySizesOf(tiles: readonly Tile[]): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const t of tiles) {
    if (t.type === 'city') sizes[t.countryId] = (sizes[t.countryId] ?? 0) + 1;
  }
  return sizes;
}

/**
 * A compact 22-tile board: group sizes 2, 3 and 4; two airports; two
 * companies; every bonus subtype. Small enough to play a full game quickly
 * in tests.
 */
export const SMALL_MAP: GameMap = (() => {
  const tiles: Tile[] = [
    { index: 0, type: 'corner', name: 'Start', subtype: 'start' },
    cityTile(1, 'Alpha 1', 'brazil', 60),
    { index: 2, type: 'bonus', name: 'Treasure', bonusType: 'treasure' },
    cityTile(3, 'Alpha 2', 'brazil', 60),
    { index: 4, type: 'bonus', name: 'Tax', bonusType: 'tax', taxPercentage: 10 },
    airportTile(5, 'Airport 1'),
    cityTile(6, 'Bravo 1', 'india', 100),
    { index: 7, type: 'corner', name: 'Prison', subtype: 'jail' },
    cityTile(8, 'Bravo 2', 'india', 110),
    { index: 9, type: 'bonus', name: 'Surprise', bonusType: 'surprise' },
    cityTile(10, 'Bravo 3', 'india', 120),
    companyTile(11, 'Company 1'),
    cityTile(12, 'Charlie 1', 'japan', 150),
    cityTile(13, 'Charlie 2', 'japan', 160),
    { index: 14, type: 'bonus', name: 'Premium Tax', bonusType: 'premium-tax', taxAmount: 75 },
    cityTile(15, 'Charlie 3', 'japan', 170),
    airportTile(16, 'Airport 2'),
    cityTile(17, 'Charlie 4', 'japan', 180),
    { index: 18, type: 'corner', name: 'Go To Jail', subtype: 'go_to_jail' },
    { index: 19, type: 'bonus', name: 'Tax Refund', bonusType: 'tax-refund', taxAmount: 50 },
    companyTile(20, 'Company 2'),
    { index: 21, type: 'corner', name: 'Free Parking', subtype: 'free_parking' },
  ];
  return {
    id: 'classic',
    name: 'Fixture: Small',
    tiles,
    startIndex: 0,
    jailIndex: 7,
    goToJailIndex: 18,
    countrySizes: countrySizesOf(tiles),
  };
})();

/**
 * A 48-tile board with zero companies and a 5-property and a 6-property
 * group (docs/DATA.md: group sizes are 2, 3, 4, 5 or 6 — never assume 3, never
 * assume companies exist).
 */
export const WEIRD_MAP: GameMap = (() => {
  type Token =
    | 'start' | 'jail' | 'free_parking' | 'go_to_jail'
    | 'airport' | 'treasure' | 'surprise' | 'tax' | 'premium-tax' | 'tax-refund'
    | { city: CountryId };

  const plan: Token[] = [
    'start',
    { city: 'canada' }, { city: 'canada' }, 'airport', 'treasure', { city: 'canada' }, 'tax',
    { city: 'canada' }, 'surprise', { city: 'canada' }, 'airport', 'premium-tax',
    'jail',
    { city: 'germany' }, { city: 'germany' }, 'treasure', { city: 'germany' }, 'airport', 'surprise',
    { city: 'germany' }, 'tax-refund', { city: 'germany' }, { city: 'germany' }, 'airport',
    'free_parking',
    { city: 'france' }, { city: 'france' }, 'treasure', 'surprise', 'tax', 'premium-tax',
    'tax-refund', 'treasure', 'surprise', 'tax', 'airport',
    'go_to_jail',
    { city: 'italy' }, { city: 'italy' }, { city: 'italy' }, 'treasure', 'surprise', 'tax-refund',
    'airport', 'treasure', 'surprise', 'tax', 'premium-tax',
  ];

  const cityBases: Record<CountryId, number> = {
    canada: 100, germany: 150, france: 200, italy: 250,
  } as Record<CountryId, number>;
  const cityCounters: Record<string, number> = {};

  const tiles: Tile[] = plan.map((token, index) => {
    if (token === 'start') return { index, type: 'corner', name: 'Start', subtype: 'start' };
    if (token === 'jail') return { index, type: 'corner', name: 'Prison', subtype: 'jail' };
    if (token === 'free_parking') return { index, type: 'corner', name: 'Free Parking', subtype: 'free_parking' };
    if (token === 'go_to_jail') return { index, type: 'corner', name: 'Go To Jail', subtype: 'go_to_jail' };
    if (token === 'airport') return airportTile(index, `Airport ${index}`);
    if (token === 'treasure') return { index, type: 'bonus', name: 'Treasure', bonusType: 'treasure' };
    if (token === 'surprise') return { index, type: 'bonus', name: 'Surprise', bonusType: 'surprise' };
    if (token === 'tax') return { index, type: 'bonus', name: 'Tax', bonusType: 'tax', taxPercentage: 10 };
    if (token === 'premium-tax') return { index, type: 'bonus', name: 'Premium Tax', bonusType: 'premium-tax', taxAmount: 75 };
    if (token === 'tax-refund') return { index, type: 'bonus', name: 'Tax Refund', bonusType: 'tax-refund', taxAmount: 50 };
    const countryId = token.city;
    const n = (cityCounters[countryId] = (cityCounters[countryId] ?? 0) + 1);
    return cityTile(index, `${countryId} ${n}`, countryId, cityBases[countryId] + n * 10);
  });

  return {
    id: 'death-valley',
    name: 'Fixture: Weird (48 tiles, no companies, a 5- and a 6-group)',
    tiles,
    startIndex: 0,
    jailIndex: 12,
    goToJailIndex: 36,
    countrySizes: countrySizesOf(tiles),
  };
})();
