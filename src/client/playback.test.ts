import { describe, expect, it } from 'vitest';
import { walkPath } from './playback';
import { hopDurations, MAX_BACKWARD_WALK } from './motionTiming';

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

describe('hopDurations', () => {
  it('has one duration per hop', () => {
    for (const n of [1, 2, 7, 12, 39]) expect(hopDurations(n)).toHaveLength(n);
  });

  it('starts and ends slower than it cruises', () => {
    const hops = hopDurations(8);
    const cruise = hops[3]!;
    expect(hops[0]).toBeGreaterThan(cruise);
    expect(hops[hops.length - 1]).toBeGreaterThan(hops[0]!);
    expect(new Set(hops.slice(1, -1)).size).toBe(1);
  });

  it('speeds a long walk up to fit the cap', () => {
    const total = hopDurations(20).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(3.2, 9);
  });

  it('never makes a hop vanishingly short, even round the whole board', () => {
    expect(Math.min(...hopDurations(47))).toBeGreaterThanOrEqual(0.1);
  });
});
