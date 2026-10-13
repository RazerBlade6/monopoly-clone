import { describe, it, expect } from 'vitest';
import type { CountryId, OwnableTile } from '../shared/types';
import { groupProperties } from './propertyOrder';

const rents = { base: 0, withHouse: [0, 0, 0, 0], withHotel: 0 } as never;

function city(index: number, countryId: CountryId, price: number): OwnableTile {
  return { index, type: 'city', name: `c${index}`, countryId, price, rents, housePrice: 50, hotelPrice: 50 } as OwnableTile;
}
function airport(index: number, price = 200): OwnableTile {
  return { index, type: 'airport', name: `a${index}`, price, rents: {} } as OwnableTile;
}
function company(index: number, price = 150): OwnableTile {
  return { index, type: 'company', name: `o${index}`, price };
}
const indexes = (tiles: OwnableTile[]) => groupProperties(tiles).map(g => g.tiles.map(t => t.index));

describe('groupProperties', () => {
  it('is empty for no tiles', () => {
    expect(groupProperties([])).toEqual([]);
  });

  it('orders groups by their cheapest owned tile', () => {
    const groups = groupProperties([city(1, 'italy', 300), city(3, 'france', 100), city(5, 'italy', 60)]);
    expect(groups.map(g => g.countryId)).toEqual(['italy', 'france']);
  });

  it('orders members of a group by price, then index', () => {
    expect(indexes([city(9, 'italy', 200), city(2, 'italy', 200), city(5, 'italy', 100)])).toEqual([[5, 2, 9]]);
  });

  it('keeps all airports together and all companies together', () => {
    const groups = groupProperties([airport(5), company(12), airport(15), company(28), city(1, 'italy', 400)]);
    expect(groups.map(g => g.key)).toEqual(['company', 'airport', 'city:italy']);
    expect(groups.map(g => g.tiles.map(t => t.index))).toEqual([[12, 28], [5, 15], [1]]);
    expect(groups[1]!.countryId).toBeUndefined();
  });

  it('breaks ties between groups by the lowest board index', () => {
    expect(indexes([city(8, 'italy', 100), city(3, 'france', 100)])).toEqual([[3], [8]]);
  });
});
