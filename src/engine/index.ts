/**
 * The rules engine's public surface. Pure: no I/O, no clock, no global
 * Math.random — every game is a deterministic function of (map, settings,
 * players, rng-seed, action log). See docs/ENGINE.md for the rules this implements.
 */
export { createGame, reduce } from './reducer';
export { legalActions } from './legal';
