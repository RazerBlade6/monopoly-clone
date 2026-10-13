import { useState, type FormEvent } from 'react';
import { navigate } from '../router';

export function Home() {
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
