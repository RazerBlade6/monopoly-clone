import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, type GameState, type PlayerId, type Player, type RoomMeta, type RoomSettings } from '../../shared/types';
import { createGame } from '../../engine/reducer';
import { Board } from '../components/Board';
import { PlayerList } from '../components/PlayerList';
import { SettingsPanel } from '../components/SettingsPanel';
import { ShareLink } from '../components/ShareLink';
import { getMap } from '../mapSource';
import { setDevMode, useDevMode } from '../devMode';

/**
 * A board for the lobby to sit in front of: the chosen map, bare, with everyone seated
 * so far standing on START. It is scenery only and never reaches the server — the real
 * game is created there when the host starts. Order is not shuffled and the rng is a
 * constant, so the picture doesn't jump around as people join.
 */
function previewState(settings: RoomSettings, players: readonly Player[]): GameState {
  const map = getMap(settings.mapId);
  return createGame(
    map,
    players.map(p => ({ id: p.id, name: p.name, color: p.color })),
    { ...settings, randomizePlayerOrder: false },
    () => 0,
  );
}

/**
 * The lobby is the game screen before it starts, the way richup does it: the same three
 * columns, with the board blurred behind a card that holds the join form or the room
 * settings. Starting the game swaps this for `Game`, and the board comes into focus.
 */
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
  const dev = useDevMode();
  const settings = room?.settings ?? DEFAULT_SETTINGS;
  const map = getMap(settings.mapId);
  const preview = useMemo(() => previewState(settings, players), [settings, players]);

  return (
    <div className="game lobby">
      <div className="rail rail--left">
        <div className="brand">Board Night</div>
        <ShareLink code={code} />
      </div>
      <div className="game__board-wrap lobby__board-wrap">
        <div className="lobby__board" aria-hidden="true">
          <Board map={map} state={preview} />
        </div>
        <div className="lobby__overlay">
          <div className="lobby__card">
            {myPlayerId
              ? (
                <RoomSetup
                  room={room} settings={settings} players={players} myPlayerId={myPlayerId} dev={dev}
                  onLeave={onLeave} onAddDummy={onAddDummy}
                  onUpdateSettings={onUpdateSettings} onStart={onStart}
                />
              )
              : <JoinForm code={code} status={status} onJoin={onJoin} />}
            {error && <p className="lobby__error">{error}</p>}
          </div>
        </div>
      </div>
      <div className="rail rail--right">
        <PlayerList
          players={players}
          hostId={room?.hostId ?? null}
          myPlayerId={myPlayerId}
          {...(dev && myPlayerId ? { onRemoveDummy: onRemovePlayer } : {})}
        />
      </div>
    </div>
  );
}

function JoinForm({
  code, status, onJoin,
}: {
  code: string;
  status: 'connecting' | 'open' | 'closed';
  onJoin: (name: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState('');
  return (
    <>
      <h2 className="lobby__heading">Join room {code}</h2>
      <form
        className="lobby__join"
        onSubmit={e => { e.preventDefault(); const n = nameDraft.trim(); if (n) onJoin(n); }}
      >
        <input
          className="input" placeholder="Your name" value={nameDraft} autoFocus maxLength={20}
          onChange={e => setNameDraft(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={!nameDraft.trim()}>
          {status === 'connecting' ? 'Connecting…' : 'Join game'}
        </button>
      </form>
    </>
  );
}

function RoomSetup({
  room, settings, players, myPlayerId, dev, onLeave, onAddDummy, onUpdateSettings, onStart,
}: {
  room: RoomMeta | null;
  settings: RoomSettings;
  players: readonly Player[];
  myPlayerId: PlayerId;
  dev: boolean;
  onLeave: () => void;
  onAddDummy: () => void;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
  onStart: () => void;
}) {
  const isHost = room?.hostId === myPlayerId;
  const hostName = players.find(p => p.id === room?.hostId)?.name ?? 'the host';
  const full = players.length >= settings.maxPlayers;
  // Solo is a developer affordance; a real room still needs someone to play against.
  const minPlayers = dev ? 1 : 2;
  const startBlocker = players.length < minPlayers
    ? 'You need at least two players to start. Share the link to invite friends.'
    : null;

  return (
    <>
      <SettingsPanel settings={settings} editable={isHost} onChange={onUpdateSettings} playerCount={players.length} />

      <div className="lobby__footer">
        {isHost ? (
          <>
            <button
              className="btn btn--primary btn--big" onClick={onStart}
              disabled={startBlocker !== null} title={startBlocker ?? undefined}
            >
              Start game
            </button>
            {startBlocker && <p className="lobby__waiting">{startBlocker}</p>}
          </>
        ) : (
          <p className="lobby__waiting">Waiting for {hostName} to start the game…</p>
        )}
        <button className="btn btn--quiet" onClick={onLeave}>Leave room</button>
      </div>

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
    </>
  );
}
