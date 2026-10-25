/**
 * Thin adapter over the engine's pinned module API (docs/ENGINE.md, "Public API"):
 *
 *   createGame(map, players, settings, rng): GameState
 *   reduce(map, state, pa, rng): { state, events }
 *
 * The local `CreateGameFn`/`ReduceFn` types re-impose the pinned signatures, so the rest
 * of this lane is typed against the contract rather than against the engine's internals.
 *
 * `reduce` reports an illegal or out-of-turn action by RETURNING `error` — it never throws,
 * and on error it returns the same `state` reference with no events. Callers must check
 * `error` explicitly; a try/catch alone would silently accept every rejected action.
 */
import type { GameEvent, GameMap, GameState, PlayerAction, RoomSettings } from '../shared/types';

export type Rng = () => number;

type EnginePlayer = { id: string; name: string; color: string };

type CreateGameFn = (
  map: GameMap,
  players: EnginePlayer[],
  settings: RoomSettings,
  rng: Rng,
) => GameState;

type ReduceFn = (
  map: GameMap,
  state: GameState,
  pa: PlayerAction,
  rng: Rng,
) => { state: GameState; events: GameEvent[]; error?: string };

import * as engine from '../engine/index';

export const createGame: CreateGameFn = engine.createGame;
export const reduce: ReduceFn = engine.reduce;
