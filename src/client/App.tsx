import { useEffect, useState } from 'react';
import type { GameEvent, GameState, MapId } from '../shared/types';
import { useLocation } from './router';
import { Home } from './pages/Home';
import { RoomContainer } from './pages/RoomContainer';
import { Board } from './components/Board';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { getMap } from './mapSource';
import { fixtureEvents, fixtureGameState, fixtureRoomMeta, fixturePlayers } from './fixtures';

const MAP_IDS: readonly MapId[] = ['classic', 'mr-worldwide', 'death-valley', 'lucky-wheel'];

/**
 * Drip-feeds the fixture event log in after mount, then a second roll, instead
 * of rendering them from the first frame — the card popup and dice tumble
 * both key off a `card_drawn`/`rolled` event actually arriving in `events`
 * (see `useBoardEventEffects` in Board.tsx), so a static fixture wouldn't
 * exercise either. The second roll pairs a `state.lastRoll` update with a
 * `rolled` event, same as the real server does for one action. Dev-only; no
 * server involved.
 */
function useAnimatedFixture(mapId: MapId): { state: GameState; events: readonly GameEvent[] } {
  const [state, setState] = useState(() => fixtureGameState(mapId));
  const [events, setEvents] = useState<readonly GameEvent[]>([]);

  useEffect(() => {
    setState(fixtureGameState(mapId));
    setEvents([]);
    const t1 = setTimeout(() => setEvents(fixtureEvents()), 700);
    const t2 = setTimeout(() => {
      setState(s => ({ ...s, lastRoll: [6, 2] }));
      setEvents(es => [...es, { type: 'rolled', playerId: 'p2', dice: [6, 2], isDouble: false }]);
    }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [mapId]);

  return { state, events };
}

/**
 * Renders a fixture instead of connecting to a room, so the board and
 * lobby can be eyeballed without a running server. See:
 *   /?dev=board&map=mr-worldwide   (48-tile board; try each MapId)
 *   /?dev=lobby        (seated, as the host)
 *   /?dev=join         (the lobby before entering a name)
 *   /?dev=game
 */
function DevPreview({ mode, mapId }: { mode: string; mapId: MapId }) {
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
    return <Game map={map} state={state} myPlayerId="p1" events={events} onAction={() => {}} code="DEMO" />;
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
