import { useEffect, useState } from 'react';
import type { GameEvent, GameMap, GameState, MapId, Player } from '../shared/types';
import { useLocation } from './router';
import { Home } from './pages/Home';
import { RoomContainer } from './pages/RoomContainer';
import { Board } from './components/Board';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { getMap } from './mapSource';
import { fixtureEvents, fixtureGameState, fixtureRoomMeta, fixturePlayers } from './fixtures';
import { SimLab } from './devSim';

const MAP_IDS: readonly MapId[] = ['classic', 'mr-worldwide', 'death-valley', 'lucky-wheel'];

/**
 * The fixture's log as history from the first frame, then one roll a moment later. The
 * board animates only what arrives with a new state (see `usePlayback`), so the roll pairs
 * a `rolled` event with a state update, as the real server sends them. Dev-only; no server
 * involved. For whole turns played out on the real engine, see `?dev=sim`.
 */
function useAnimatedFixture(mapId: MapId): { state: GameState; events: readonly GameEvent[] } {
  const [state, setState] = useState(() => fixtureGameState(mapId));
  const [events, setEvents] = useState<readonly GameEvent[]>(fixtureEvents);

  useEffect(() => {
    setState(fixtureGameState(mapId));
    setEvents(fixtureEvents());
    const t = setTimeout(() => {
      setEvents(es => [...es, { type: 'rolled', playerId: 'p2', dice: [6, 2], isDouble: false }]);
      setState(s => ({ ...s, lastRoll: [6, 2] }));
    }, 1200);
    return () => clearTimeout(t);
  }, [mapId]);

  return { state, events };
}

/** Puts the fixture's current player (p1) at a given point in their turn, for `?turn=`. */
function withTurn(map: GameMap, state: GameState, turn: string | null): GameState {
  const unowned = map.tiles.find(t => t.type === 'city' && state.tiles[t.index]?.owner === null)?.index ?? 1;
  const p1 = (patch: Partial<Player>) => state.players.map(p => (p.id === 'p1' ? { ...p, ...patch } : p));
  switch (turn) {
    case 'buy': return { ...state, phase: 'AWAITING_BUY', lastRoll: [4, 2], players: p1({ tileIndex: unowned }) };
    case 'buy-doubles': return { ...state, phase: 'AWAITING_BUY', lastRoll: [3, 3], doublesCount: 1, players: p1({ tileIndex: unowned }) };
    case 'doubles': return { ...state, phase: 'AWAITING_ROLL', lastRoll: [3, 3], doublesCount: 1 };
    case 'end': return { ...state, phase: 'AWAITING_END_TURN' };
    case 'jail': return { ...state, phase: 'AWAITING_ROLL', players: p1({ inJail: true, pardonCards: 1 }) };
    case 'debt': return { ...state, phase: 'RESOLVING_DEBT', debt: { debtor: 'p1', amount: 120, creditor: 'p2', queued: [] }, players: p1({ cash: -120 }) };
    default: return state;
  }
}

/**
 * Renders a fixture instead of connecting to a room, so the board and
 * lobby can be eyeballed without a running server. See:
 *   /?dev=board&map=mr-worldwide   (48-tile board; try each MapId)
 *   /?dev=lobby        (seated, as the host)
 *   /?dev=join         (the lobby before entering a name)
 *   /?dev=game
 *   /?dev=game&turn=buy  (also: doubles, buy-doubles, end, jail, debt — the turn's buttons)
 *   /?dev=sim          (the real engine, every seat played from this tab; &auto=1 for bots)
 */
function DevPreview({ mode, mapId }: { mode: string; mapId: MapId }) {
  if (mode === 'sim') {
    return <SimLab mapId={mapId} auto={new URLSearchParams(window.location.search).get('auto') === '1'} />;
  }
  return <FixturePreview mode={mode} mapId={mapId} />;
}

function FixturePreview({ mode, mapId }: { mode: string; mapId: MapId }) {
  const { state, events } = useAnimatedFixture(mapId);

  if (mode === 'board') {
    const map = getMap(mapId);
    return (
      <div className="dev-preview">
        <p className="dev-preview__label">{map.name} — {map.tiles.length} tiles</p>
        <Board map={map} state={state} events={events} />
      </div>
    );
  }
  if (mode === 'lobby' || mode === 'join') {
    return (
      <Lobby
        code="DEMO" status="open" room={fixtureRoomMeta()} players={fixturePlayers()}
        myPlayerId={mode === 'lobby' ? 'p1' : null} error={null} onJoin={() => {}} onLeave={() => {}}
        onAddDummy={() => {}} onRemovePlayer={() => {}}
        onUpdateSettings={() => {}} onStart={() => {}}
      />
    );
  }
  if (mode === 'game') {
    const map = getMap(mapId);
    const turn = new URLSearchParams(window.location.search).get('turn');
    return <Game map={map} state={withTurn(map, state, turn)} myPlayerId="p1" events={events} onAction={() => {}} code="DEMO" />;
  }
  return null;
}

export function App() {
  const path = useLocation();
  const params = new URLSearchParams(window.location.search);
  const devMode = params.get('dev');
  if (devMode) {
    const mapParam = params.get('map');
    const mapId = MAP_IDS.includes(mapParam as MapId) ? (mapParam as MapId) : 'classic';
    return <DevPreview mode={devMode} mapId={mapId} />;
  }

  const code = path.slice(1).split('/')[0];
  if (!code) return <Home />;
  return <RoomContainer code={code} />;
}
