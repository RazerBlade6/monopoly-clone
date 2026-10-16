import { useState, type FormEvent } from 'react';
import type { MapId } from '../../shared/types';
import { navigate } from '../router';
import { useDevMode } from '../devMode';
import { MAPS } from '../../data/maps';

/**
 * Developer shortcuts, shown in a Vite dev build or with the dev switch (Ctrl+Alt+D) on —
 * the switch is what makes it reachable when the built client is served by `wrangler dev`.
 * The simulation runs the real engine in the page with no server (see `devSim.tsx`).
 */
function DevPanel() {
  const [mapId, setMapId] = useState<MapId>('classic');
  const [bots, setBots] = useState(true);
  const start = () => {
    window.location.assign(`/?dev=sim&map=${mapId}${bots ? '&auto=1' : ''}`);
  };
  return (
    <div className="home__card home__dev">
      <div className="panel__title">Developer</div>
      <div className="home__dev-row">
        <select className="input" value={mapId} onChange={e => setMapId(e.target.value as MapId)} aria-label="Map">
          {Object.values(MAPS).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <label className="home__dev-toggle">
          <input type="checkbox" checked={bots} onChange={e => setBots(e.target.checked)} /> Bots play
        </label>
      </div>
      <button className="btn btn--big" onClick={start}>Simulate a game</button>
    </div>
  );
}

export function Home() {
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dev = useDevMode() || import.meta.env.DEV;

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { code: string };
      navigate(`/${data.code}`);
    } catch {
      setError('Could not create a room. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  function joinRoom(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (code) navigate(`/${code}`);
  }

  return (
    <div className="home">
      <div className="home__card">
        <h1 className="home__title">Board Night</h1>
        <p className="home__subtitle">Create a room, share the link, play with friends. No accounts, ever.</p>
        <button className="btn btn--primary btn--big" onClick={createRoom} disabled={creating}>
          {creating ? 'Creating…' : 'Create room'}
        </button>
        {error && <p className="home__error">{error}</p>}
        <div className="home__divider"><span>or</span></div>
        <form className="home__join" onSubmit={joinRoom}>
          <input
            className="input"
            placeholder="Room code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <button className="btn" type="submit" disabled={!joinCode.trim()}>Join</button>
        </form>
      </div>
      {dev && <DevPanel />}
      {/* Attribution the licences ask for; the full texts are served from `public/`. */}
      <footer className="home__credits">
        Flags by <a href="https://github.com/HatScripts/circle-flags" target="_blank" rel="noreferrer">circle-flags</a> (MIT)
        {' · '}Fonts: Nunito, Nunito Sans, Comfortaa (SIL OFL)
        {' · '}Icons from <a href="https://www.svgrepo.com" target="_blank" rel="noreferrer">SVG Repo</a>, by their authors (see Licences)
        {' · '}<a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Licences</a>
      </footer>
    </div>
  );
}
