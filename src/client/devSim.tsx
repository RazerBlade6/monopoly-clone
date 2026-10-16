import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, GameEvent, GameState, MapId, PlayerId } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { createGame, legalActions, reduce } from '../engine';
import { getMap } from './mapSource';
import { Game } from './pages/Game';

/** richup's first four appearance swatches (`research/richup-observed-live.md` §3). */
const SEATS = [
  { id: 'p1', name: 'Ama', color: '#FFC73F' },
  { id: 'p2', name: 'Noah', color: '#5A99DA' },
  { id: 'p3', name: 'Zara', color: '#C34848' },
  { id: 'p4', name: 'Leo', color: '#73E85D' },
];

/** How long a bot waits, once the board has caught up, before taking its next action. */
const BOT_THINK_MS = 650;

interface Sim {
  state: GameState;
  events: readonly GameEvent[];
}

/** Who has to act next: the debtor while a debt is open, otherwise whoever's turn it is. */
function actor(state: GameState): PlayerId {
  return state.phase === 'RESOLVING_DEBT' && state.debt
    ? state.debt.debtor
    : state.turnOrder[state.currentPlayerIndex]!;
}

/** A bot that buys whatever it can afford and otherwise just keeps the game moving. */
function botAction(state: GameState, legal: readonly GameAction[]): GameAction | null {
  if (state.phase === 'RESOLVING_DEBT') return { type: 'declare_bankruptcy' };
  for (const type of ['buy', 'roll', 'end_turn'] as const) {
    const found = legal.find(a => a.type === type);
    if (found) return found;
  }
  return null;
}

/**
 * The real engine running in the page, with no server: every seat is played from this tab,
 * and the turn's buttons always act for whoever is up. For watching the board's motion
 * (rolls, walks, cards, prison) end to end. `?dev=sim&auto=1` lets bots play every seat,
 * each one waiting for the board to finish showing the last action first, as a person
 * would. Randomness is `Math.random`: a dev tool, not a replay.
 */
export function SimulatedGame({ mapId, auto }: { mapId: MapId; auto: boolean }) {
  const map = getMap(mapId);
  const [sim, setSim] = useState<Sim>(() => {
    const created = createGame(map, SEATS, { ...DEFAULT_SETTINGS, randomizePlayerOrder: false }, Math.random);
    const started = reduce(map, created, { playerId: 'p1', action: { type: 'start_game' } }, Math.random);
    return { state: started.state, events: started.events };
  });
  const [busy, setBusy] = useState(false);
  const simRef = useRef(sim);
  simRef.current = sim;

  // Reduced outside the state updater, so StrictMode's double call can't roll twice.
  const act = useCallback((action: GameAction, asPlayerId?: PlayerId) => {
    const current = simRef.current;
    const playerId = asPlayerId ?? actor(current.state);
    const result = reduce(map, current.state, { playerId, action }, Math.random);
    if (result.error) {
      console.warn(`sim: ${action.type} refused: ${result.error}`);
      return;
    }
    const next = { state: result.state, events: [...current.events, ...result.events].slice(-300) };
    simRef.current = next;
    setSim(next);
  }, [map]);

  useEffect(() => {
    if (!auto || busy || sim.state.phase === 'GAME_OVER') return;
    const t = setTimeout(() => {
      const { state } = simRef.current;
      const who = actor(state);
      const action = botAction(state, legalActions(map, state, who));
      if (action) act(action, who);
    }, BOT_THINK_MS);
    return () => clearTimeout(t);
  }, [auto, busy, sim, map, act]);

  return (
    <Game
      map={map} state={sim.state} events={sim.events} myPlayerId={actor(sim.state)}
      onAction={act} code="SIM" onBusyChange={setBusy}
    />
  );
}
