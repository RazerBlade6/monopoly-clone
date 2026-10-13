import type {
  CountryId, GameEvent, GameMap, GameState, MapId, Ownership, Player, RoomMeta, Tile,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { displayName } from './colors';

/**
 * Placeholder board + game-state data for local development.
 *
 * `src/data/maps/index.ts` (a different lane) owns real board data and is
 * not built yet, so this file stands in for it. It implements the same
 * `getMap(id): GameMap` signature the real module will export — see
 * `src/client/mapSource.ts` for the single place to swap one for the other.
 *
 * Nothing here hardcodes a tile count: `buildRingMap` takes `tileCount` as
 * a parameter and is used for both a 40-tile and a 48-tile board below, to
 * prove the client doesn't assume 40.
 */

const COUNTRIES: readonly CountryId[] = [
  'brazil', 'canada', 'china', 'france', 'germany', 'india', 'ireland',
  'israel', 'italy', 'japan', 'romania', 'turkey', 'united-kingdom',
  'united-states-of-america',
];

interface RingMapOptions {
  id: MapId;
  name: string;
  tileCount: number;
  groupSize: number;
  companyCount: number;
  includeTaxRefund: boolean;
}

function buildRingMap(opts: RingMapOptions): GameMap {
  const { id, name, tileCount, groupSize, companyCount, includeTaxRefund } = opts;
  if ((tileCount - 4) % 4 !== 0) {
    throw new Error(`buildRingMap: ${tileCount} tiles cannot form a square ring`);
  }
  const perSide = (tileCount - 4) / 4;
  const cornerIndices = [0, perSide + 1, 2 * (perSide + 1), 3 * (perSide + 1)];
  const cornerInfo: ReadonlyArray<{ name: string; subtype: 'start' | 'jail' | 'free_parking' | 'go_to_jail' }> = [
    { name: 'START', subtype: 'start' },
    { name: 'Prison', subtype: 'jail' },
    { name: 'Vacation', subtype: 'free_parking' },
    { name: 'Go To Prison', subtype: 'go_to_jail' },
  ];

  const tiles: Tile[] = [];
  let countryIdx = -1;
  let runLeft = 0;
  let companiesLeft = companyCount;
  let airportsPlaced = 0;
  let bonusCycle = 0;
  let sinceAirport = 0;
  let filler = 0; // 0 = try company, 1 = try bonus, 2 = start next city group
  const airportSpacing = Math.max(3, Math.round(perSide * 0.9));

  for (let i = 0; i < tileCount; i++) {
    const cornerAt = cornerIndices.indexOf(i);
    if (cornerAt !== -1) {
      const c = cornerInfo[cornerAt];
      if (c) tiles.push({ index: i, type: 'corner', name: c.name, subtype: c.subtype });
      runLeft = 0;
      sinceAirport = 0;
      filler = 2;
      continue;
    }

    if (runLeft > 0) {
      const country = COUNTRIES[countryIdx % COUNTRIES.length] ?? 'brazil';
      const posInGroup = groupSize - runLeft;
      tiles.push({
        index: i, type: 'city', name: `${displayName(country)} ${posInGroup + 1}`, countryId: country,
        price: 100 + posInGroup * 20, rents: [10, 50, 150, 450, 625, 750],
        housePrice: 50, hotelPrice: 50,
      });
      runLeft--;
      sinceAirport++;
      continue;
    }

    sinceAirport++;
    if (sinceAirport > airportSpacing) {
      airportsPlaced++;
      tiles.push({ index: i, type: 'airport', name: `Airport ${airportsPlaced}`, price: 200, rents: [25, 50, 100, 200] });
      sinceAirport = 0;
      continue;
    }

    if (filler === 0 && companiesLeft > 0) {
      tiles.push({ index: i, type: 'company', name: `Company ${companyCount - companiesLeft + 1}`, price: 150 });
      companiesLeft--;
      filler = 1;
      continue;
    }

    if (filler <= 1) {
      const bonusTiles: Tile[] = [
        { index: i, type: 'bonus', name: 'Treasure', bonusType: 'treasure' },
        { index: i, type: 'bonus', name: 'Surprise', bonusType: 'surprise' },
        { index: i, type: 'bonus', name: 'Tax', bonusType: 'tax', taxPercentage: 10 },
        { index: i, type: 'bonus', name: 'Premium Tax', bonusType: 'premium-tax', taxAmount: 100 },
      ];
      if (includeTaxRefund) {
        bonusTiles.push({ index: i, type: 'bonus', name: 'Tax Refund', bonusType: 'tax-refund', taxAmount: 50 });
      }
      const bonus = bonusTiles[bonusCycle % bonusTiles.length];
      if (bonus) tiles.push(bonus);
      bonusCycle++;
      filler = 2;
      continue;
    }

    countryIdx++;
    runLeft = groupSize - 1;
    filler = 0;
    const country = COUNTRIES[countryIdx % COUNTRIES.length] ?? 'brazil';
    tiles.push({
      index: i, type: 'city', name: `${displayName(country)} 1`, countryId: country,
      price: 100, rents: [10, 50, 150, 450, 625, 750], housePrice: 50, hotelPrice: 50,
    });
  }

  const countrySizes: Record<string, number> = {};
  for (const t of tiles) {
    if (t.type === 'city') countrySizes[t.countryId] = (countrySizes[t.countryId] ?? 0) + 1;
  }

  const start = cornerIndices[0] ?? 0;
  const jail = cornerIndices[1] ?? 0;
  const goToJail = cornerIndices[3] ?? 0;

  return { id, name, tiles, startIndex: start, jailIndex: jail, goToJailIndex: goToJail, countrySizes };
}

const FIXTURE_MAPS: Record<MapId, GameMap> = {
  classic: buildRingMap({
    id: 'classic', name: 'Classic', tileCount: 40, groupSize: 3, companyCount: 2, includeTaxRefund: false,
  }),
  'mr-worldwide': buildRingMap({
    id: 'mr-worldwide', name: 'Mr. Worldwide', tileCount: 48, groupSize: 3, companyCount: 3, includeTaxRefund: false,
  }),
  'death-valley': buildRingMap({
    id: 'death-valley', name: 'Death Valley', tileCount: 40, groupSize: 6, companyCount: 2, includeTaxRefund: false,
  }),
  'lucky-wheel': buildRingMap({
    id: 'lucky-wheel', name: 'Lucky Wheel', tileCount: 40, groupSize: 4, companyCount: 0, includeTaxRefund: true,
  }),
};

export function getMap(id: MapId): GameMap {
  return FIXTURE_MAPS[id];
}

export function fixturePlayers(): Player[] {
  return [
    { id: 'p1', name: 'Ama', color: '#e74c3c', cash: 1500, tileIndex: 0, inJail: false, jailTurns: 0, pardonCards: 0, skipTurns: 0, bankrupt: false, connected: true },
    { id: 'p2', name: 'Noah', color: '#3498db', cash: 1240, tileIndex: 7, inJail: false, jailTurns: 0, pardonCards: 1, skipTurns: 0, bankrupt: false, connected: true },
    { id: 'p3', name: 'Priya', color: '#2ecc71', cash: 860, tileIndex: 22, inJail: true, jailTurns: 1, pardonCards: 0, skipTurns: 0, bankrupt: false, connected: false },
    { id: 'p4', name: 'Yusuf', color: '#f1c40f', cash: 300, tileIndex: 34, inJail: false, jailTurns: 0, pardonCards: 0, skipTurns: 0, bankrupt: false, connected: true },
  ];
}

export function fixtureGameState(mapId: MapId = 'classic'): GameState {
  const map = getMap(mapId);
  const players = fixturePlayers();
  const tiles: Ownership[] = map.tiles.map(() => ({ owner: null, houses: 0, hotel: false, mortgaged: false }));

  const ownable = map.tiles.filter(t => t.type === 'city' || t.type === 'airport' || t.type === 'company');
  const claims: Array<[number, Ownership]> = [
    [0, { owner: 'p1', houses: 2, hotel: false, mortgaged: false }],
    [1, { owner: 'p1', houses: 0, hotel: false, mortgaged: false }],
    [2, { owner: 'p2', houses: 4, hotel: false, mortgaged: false }],
    [3, { owner: 'p2', houses: 0, hotel: true, mortgaged: false }],
  ];
  for (const [ownableIdx, ownership] of claims) {
    const tile = ownable[ownableIdx];
    if (tile) tiles[tile.index] = ownership;
  }

  return {
    version: 1,
    mapId,
    settings: DEFAULT_SETTINGS,
    players,
    turnOrder: players.map(p => p.id),
    currentPlayerIndex: 0,
    tiles,
    bank: { houses: 32 - 6, hotels: 12 - 1 },
    decks: {
      treasure: { order: [], index: 0 },
      surprise: { order: [], index: 0 },
    },
    phase: 'AWAITING_ROLL',
    debt: null,
    doublesCount: 0,
    lastRoll: [4, 3],
    vacationPot: 340,
    winner: null,
    trades: [],
    tradeSendCounts: {},
    nextTradeId: 0,
  };
}

export function fixtureRoomMeta(code = 'DEMO'): RoomMeta {
  return { code, hostId: 'p1', settings: DEFAULT_SETTINGS, started: false };
}

/** Sample event stream for the dev-preview routes — exercises the log's
 * formatting (including a card-drawn line and an id-less fixture card, to
 * prove the lookup guard) without needing a running server. */
export function fixtureEvents(): GameEvent[] {
  return [
    { type: 'game_started', turnOrder: ['p1', 'p2', 'p3', 'p4'] },
    { type: 'rolled', playerId: 'p1', dice: [4, 3], isDouble: false },
    { type: 'moved', playerId: 'p1', from: 0, to: 7, passedStart: false },
    { type: 'bought', playerId: 'p1', tileIndex: 7, price: 180 },
    { type: 'paid', from: null, to: 'p1', amount: 100, reason: 'start_bonus' },
    { type: 'card_drawn', playerId: 'p3', deck: 'treasure', cardId: 'treasure-01' },
    { type: 'card_drawn', playerId: 'p4', deck: 'surprise', cardId: 'fixture-unknown-card' },
    { type: 'turn_skipped', playerId: 'p3' },
    { type: 'turn_ended', nextPlayerId: 'p2' },
  ];
}
