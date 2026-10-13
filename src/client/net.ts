import { useEffect, useRef, useState } from 'react';
import type {
  ClientMessage, ServerMessage, RoomMeta, Player, GameState, GameEvent,
  RoomSettings, GameAction,
} from '../shared/types';

/**
 * One WebSocket per room, typed against `ClientMessage`/`ServerMessage`.
 * The client only ever renders what arrives here — it never computes rent,
 * rolls dice, or decides what's legal.
 */

export interface ConnState {
  status: 'connecting' | 'open' | 'closed';
  room: RoomMeta | null;
  players: readonly Player[];
  state: GameState | null;
  events: GameEvent[];
  playerId: string | null;
  error: string | null;
}

function initialConnState(): ConnState {
  return {
    status: 'connecting', room: null, players: [], state: null,
    events: [], playerId: null, error: null,
  };
}

interface StoredIdentity {
  playerId: string;
  token: string;
  name: string;
}

function storageKey(code: string): string {
  return `boardclone:room:${code}`;
}

function loadIdentity(code: string): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(storageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
    if (typeof parsed.playerId === 'string' && typeof parsed.token === 'string' && typeof parsed.name === 'string') {
      return { playerId: parsed.playerId, token: parsed.token, name: parsed.name };
    }
    return null;
  } catch {
    // localStorage can throw (private browsing, disabled storage) — just skip resume
    return null;
  }
}

function saveIdentity(code: string, identity: StoredIdentity): void {
  try {
    window.localStorage.setItem(storageKey(code), JSON.stringify(identity));
  } catch {
    // best-effort; without storage the player just re-enters their name next time
  }
}

function clearIdentity(code: string): void {
  try {
    window.localStorage.removeItem(storageKey(code));
  } catch {
    // nothing stored means nothing to clear
  }
}

const MAX_LOG_EVENTS = 300;
const RECONNECT_DELAY_MS = 1500;

class RoomConnection {
  private ws: WebSocket | null = null;
  private readonly code: string;
  private readonly listeners = new Set<(s: ConnState) => void>();
  private snapshot: ConnState = initialConnState();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private pendingName: string | null = null;

  constructor(code: string) {
    this.code = code;
    this.connect();
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/api/rooms/${encodeURIComponent(this.code)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.patch({ status: 'open', error: null });
      const identity = loadIdentity(this.code);
      if (identity) {
        this.pendingName = identity.name;
        this.sendRaw({ type: 'join', name: identity.name, token: identity.token });
      } else if (this.pendingName) {
        this.sendRaw({ type: 'join', name: this.pendingName });
      }
    });

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage;
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    ws.addEventListener('close', () => {
      this.patch({ status: 'closed' });
      if (!this.closedByUser) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    });
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'joined':
        saveIdentity(this.code, { playerId: msg.playerId, token: msg.token, name: this.pendingName ?? '' });
        this.patch({ playerId: msg.playerId, room: msg.room, error: null });
        break;
      case 'room':
        this.patch({ room: msg.room, players: msg.players });
        break;
      case 'state':
        this.patch({ state: msg.state });
        break;
      case 'events':
        this.patch({ events: [...this.snapshot.events, ...msg.events].slice(-MAX_LOG_EVENTS) });
        break;
      case 'error':
        // A dead token can't be retried: the seat is gone (left, or swept after a long
        // disconnect). Forget it and fall back to the join form, or the reconnect loop
        // would re-offer the same token every 1.5s forever.
        if (msg.code === 'unknown_token') {
          clearIdentity(this.code);
          this.pendingName = null;
          this.patch({ playerId: null, error: null });
          break;
        }
        // A refused join (name taken, room full) must not be replayed by the reconnect
        // path; the form's next submit sets a fresh name.
        if (!this.snapshot.playerId) this.pendingName = null;
        this.patch({ error: msg.message });
        break;
    }
  }

  private patch(partial: Partial<ConnState>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l(this.snapshot);
  }

  subscribe(listener: (s: ConnState) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  send(msg: ClientMessage): void {
    this.sendRaw(msg);
  }

  join(name: string): void {
    this.pendingName = name;
    this.sendRaw({ type: 'join', name });
  }

  /** Gives up this seat. Lobby only — the server refuses once the game is running. */
  leave(): void {
    this.sendRaw({ type: 'leave' });
    clearIdentity(this.code);
    this.pendingName = null;
    this.patch({ playerId: null, players: [], error: null });
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export interface RoomConnectionApi extends ConnState {
  join: (name: string) => void;
  leave: () => void;
  addDummy: () => void;
  removePlayer: (playerId: string) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  /** `asPlayerId` acts for one of your own dummy players; the server refuses any other id. */
  sendAction: (action: GameAction, asPlayerId?: string) => void;
  startGame: () => void;
}

export function useRoomConnection(code: string): RoomConnectionApi {
  const connRef = useRef<RoomConnection | null>(null);
  const [snapshot, setSnapshot] = useState<ConnState>(initialConnState);

  useEffect(() => {
    const conn = new RoomConnection(code);
    connRef.current = conn;
    const unsubscribe = conn.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      conn.close();
      connRef.current = null;
    };
  }, [code]);

  return {
    ...snapshot,
    join: (name: string) => connRef.current?.join(name),
    leave: () => connRef.current?.leave(),
    addDummy: () => connRef.current?.send({ type: 'add_dummy' }),
    removePlayer: (playerId: string) => connRef.current?.send({ type: 'remove_player', playerId }),
    updateSettings: (settings: Partial<RoomSettings>) => connRef.current?.send({ type: 'update_settings', settings }),
    sendAction: (action: GameAction, asPlayerId?: string) =>
      connRef.current?.send(asPlayerId ? { type: 'action', action, asPlayerId } : { type: 'action', action }),
    startGame: () => connRef.current?.send({ type: 'action', action: { type: 'start_game' } }),
  };
}
