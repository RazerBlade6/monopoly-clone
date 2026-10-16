import { describe, expect, it } from 'vitest';
import { walkPath } from './playback';
import { MAX_BACKWARD_WALK, walkSeconds } from './motionTiming';

describe('walkPath', () => {
  it('walks forward, both ends included', () => {
    expect(walkPath(3, 7, 40)).toEqual([3, 4, 5, 6, 7]);
  });

  it('wraps past START on any board size', () => {
    expect(walkPath(38, 2, 40)).toEqual([38, 39, 0, 1, 2]);
    expect(walkPath(46, 1, 48)).toEqual([46, 47, 0, 1]);
  });

  it('steps back for a short backward move rather than going the long way round', () => {
    expect(walkPath(7, 4, 40)).toEqual([7, 6, 5, 4]);
    expect(walkPath(1, 46, 48)).toEqual([1, 0, 47, 46]);
  });

  it('goes forward when the backward distance is past the cap', () => {
    const path = walkPath(20, 20 - MAX_BACKWARD_WALK - 1, 40);
    expect(path.length).toBe(40 - MAX_BACKWARD_WALK - 1 + 1);
    expect(path[1]).toBe(21);
  });

  it('is a single tile when nothing moves', () => {
    expect(walkPath(5, 5, 40)).toEqual([5]);
  });
});

describe('walkSeconds', () => {
  it('takes no time to go nowhere', () => {
    expect(walkSeconds(0)).toBe(0);
  });

  it('takes longer the further it goes', () => {
    for (let n = 1; n < 47; n++) expect(walkSeconds(n + 1)).toBeGreaterThan(walkSeconds(n));
  });

  it('covers ground faster the further it goes', () => {
    expect(30 / walkSeconds(30)).toBeGreaterThan(3 * (7 / walkSeconds(7)) / 2);
  });

  it('keeps an ordinary roll and a trip round the board brisk', () => {
    expect(walkSeconds(7)).toBeLessThan(0.7);
    expect(walkSeconds(39)).toBeLessThan(1.2);
  });
});
