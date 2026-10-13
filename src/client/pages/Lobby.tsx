import { useState } from 'react';
import { DEFAULT_SETTINGS, type PlayerId, type Player, type RoomMeta, type RoomSettings } from '../../shared/types';
import { PlayerList } from '../components/PlayerList';
import { SettingsPanel } from '../components/SettingsPanel';
import { setDevMode, useDevMode } from '../devMode';

export function Lobby({
  code, status, room, players, myPlayerId, error,
  onJoin, onLeave, onAddDummy, onRemovePlayer, onUpdateSettings, onStart,
}: {
  code: string;
  status: 'connecting' | 'open' | 'closed';
  room: RoomMeta | null;
  players: readonly Player[];
  myPlayerId: PlayerId | null;
  error: string | null;
  onJoin: (name: string) => void;
  onLeave: () => void;
  onAddDummy: () => void;
  onRemovePlayer: (playerId: PlayerId) => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onStart: () => void;
}) {
  const [nameDraft, setNameDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const dev = useDevMode();
  const shareUrl = `${window.location.origin}/${code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browser, insecure context); the URL is still on screen.
    }
  }

  if (!myPlayerId) {
    return (
      <div className="lobby lobby--join">
        <div className="lobby__card">
          <div className="brand">Board Night</div>
          <h2>Join room {code}</h2>
          <form onSubmit={e => { e.preventDefault(); const n = nameDraft.trim(); if (n) onJoin(n); }}>
            <input
              className="input" placeholder="Your name" value={nameDraft} autoFocus maxLength={20}
              onChange={e => setNameDraft(e.target.value)}
            />
            <button className="btn btn--primary" type="submit" disabled={!nameDraft.trim()}>
              {status === 'connecting' ? 'Connecting…' : 'Join'}
            </button>
          </form>
          {error && <p className="lobby__error">{error}</p>}
        </div>
      </div>
    );
  }

  const isHost = room?.hostId === myPlayerId;
  const full = players.length >= (room?.settings.maxPlayers ?? DEFAULT_SETTINGS.maxPlayers);
  // Solo is a developer affordance; a real room still needs someone to play against.
  const minPlayers = dev ? 1 : 2;

  return (
    <div className="lobby">
      <div className="brand">Board Night</div>
      <div className="lobby__share">
        <span className="lobby__share-url">{shareUrl}</span>
        <button className="btn" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
      </div>

      <div className="lobby__body">
        <PlayerList
          players={players}
          hostId={room?.hostId ?? null}
          myPlayerId={myPlayerId}
          {...(dev ? { onRemoveDummy: onRemovePlayer } : {})}
        />
        <SettingsPanel settings={room?.settings ?? DEFAULT_SETTINGS} editable={isHost} onChange={onUpdateSettings} playerCount={players.length} />
      </div>

      {isHost ? (
        <button className="btn btn--primary btn--big" onClick={onStart} disabled={players.length < minPlayers}>
          Start game
        </button>
      ) : (
        <p className="lobby__waiting">Waiting for the host to start…</p>
      )}
      {dev && (
        <div className="lobby__dev">
          <div className="lobby__dev-head">
            <span className="lobby__dev-title">Developer</span>
            <button className="btn btn--small" onClick={() => setDevMode(false)}>Turn off</button>
          </div>
          <p className="lobby__dev-note">
            Only this browser sees this panel; Ctrl+Alt+D toggles it. Bots are ordinary seats
            with no player behind them — you take their turns yourself, from this tab.
          </p>
          <button className="btn" onClick={onAddDummy} disabled={!isHost || full}>
            {full ? 'Room is full' : isHost ? '+ Add bot player' : 'Only the host can add bots'}
          </button>
        </div>
      )}

      <button className="btn btn--quiet" onClick={onLeave}>Leave room</button>
      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}
