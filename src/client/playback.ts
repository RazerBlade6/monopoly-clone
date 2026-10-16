import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameMap, GameState, Player, PlayerId } from '../shared/types';
import {
  CARD_READ_MS, CARD_SHOW_MS, DICE_SETTLE_MS, JUMP_IN_S, JUMP_OUT_S, JUMP_PAUSE_MS,
  LAND_BEAT_MS, MAX_BACKWARD_WALK, walkSeconds,
} from './motionTiming';

export type CardDrawnEvent = Extract<GameEvent, { type: 'card_drawn' }>;

/**
 * How a token gets to the tile the shown state now puts it on. `id` is unique per motion,
 * so a token runs each one exactly once however often the board re-renders.
 *
 * - `walk` glides along `path`, which starts on the tile the token is leaving, in `duration` seconds.
 * - `jump` shrinks away and pops up on the new tile (prison).
 * - `snap` just appears there: reduced motion, or the queue catching up all at once.
 */
export type TokenMotion =
  | { id: number; kind: 'walk'; path: readonly number[]; duration: number }
  | { id: number; kind: 'jump' }
  | { id: number; kind: 'snap' };

/** What the board needs beyond the state itself to play a batch. */
export interface Presentation {
  /** Bumped once per roll; the dice tumble when it changes. */
  rollId: number;
  motions: Readonly<Record<PlayerId, TokenMotion>>;
  card: CardDrawnEvent | null;
}

export interface Playback {
  /** The state as far as the animation has got. Every panel renders this, not the server's. */
  state: GameState;
  /** The log as far as the animation has got. */
  events: readonly GameEvent[];
  /** A batch is still playing; the turn's buttons wait for it. */
  busy: boolean;
  presentation: Presentation;
}

interface Batch {
  state: GameState;
  events: readonly GameEvent[];
}

const MAX_LOG_EVENTS = 300;
/** More than this many batches waiting means the board has fallen behind: catch up at once. */
const MAX_BACKLOG = 2;

const EMPTY_PRESENTATION: Presentation = { rollId: 0, motions: {}, card: null };

/** Events that take time to show. A batch with none of them is applied the moment it can be. */
function isAnimated(e: GameEvent): boolean {
  return e.type === 'rolled' || e.type === 'moved' || e.type === 'jailed' || e.type === 'card_drawn';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function patchPlayer(state: GameState, id: PlayerId, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)) };
}

/** Money as it moves. Approximate on purpose: the batch's real state replaces it at the end. */
function applyPaid(state: GameState, e: Extract<GameEvent, { type: 'paid' }>): GameState {
  return {
    ...state,
    players: state.players.map(p => {
      let cash = p.cash;
      if (p.id === e.from) cash -= e.amount;
      if (p.id === e.to) cash += e.amount;
      return cash === p.cash ? p : { ...p, cash };
    }),
  };
}

/**
 * The tiles a token passes through, both ends included. Forward round the ring, except a
 * short step back (a card's "go back three"), which walks backwards rather than the long
 * way round.
 */
export function walkPath(from: number, to: number, tileCount: number): number[] {
  const mod = (n: number) => ((n % tileCount) + tileCount) % tileCount;
  const forward = mod(to - from);
  const backward = mod(from - to);
  const step = backward <= MAX_BACKWARD_WALK && backward < forward ? -1 : 1;
  const count = step === 1 ? forward : backward;
  return Array.from({ length: count + 1 }, (_, i) => mod(from + i * step));
}

/** Everything appended to `events` since `boundary`, found by identity because the log is capped. */
function freshSince(events: readonly GameEvent[], boundary: GameEvent | null): GameEvent[] {
  const fresh: GameEvent[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event === boundary) break;
    fresh.push(event);
  }
  return fresh.reverse();
}

/**
 * Plays the server's updates back in order instead of showing their end result at once.
 *
 * One action reaches the client as an `events` message (rolled, moved, paid, card_drawn,
 * moved again…) followed by a `state` message with the final result. Rendered as it
 * arrives, the dice start tumbling, the token sets off, and the balances, ownership and
 * buttons all change in the same instant. This holds the *shown* state back and walks it
 * forward one event at a time: the dice settle, then the token walks, then the money moves,
 * then a card shows and its effect plays, and only then does the batch's real state
 * replace the shown one. Batches queue, so a second update waits for the first.
 *
 * Decoration only. The server's state is still the truth: each batch ends by showing it
 * exactly, whatever the steps before it approximated, and a client that joins mid-game
 * starts on the current state with nothing to replay.
 *
 * A batch pairs with the `state` message that closes it: the server sends a batch's
 * events first, so by the time `state` changes, everything new in `events` belongs to it.
 */
export function usePlayback(map: GameMap, state: GameState, events: readonly GameEvent[]): Playback {
  const [view, setView] = useState<Playback>(() => ({
    state, events: events.slice(-MAX_LOG_EVENTS), busy: false, presentation: EMPTY_PRESENTATION,
  }));
  const viewRef = useRef(view);
  const queue = useRef<Batch[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const lastState = useRef(state);
  const lastSeen = useRef<GameEvent | null>(events.length > 0 ? events[events.length - 1]! : null);
  const motionSeq = useRef(0);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileCount = map.tiles.length;
  const jailIndex = map.jailIndex;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (cardTimer.current) clearTimeout(cardTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    const fresh = freshSince(events, lastSeen.current);
    if (events.length > 0) lastSeen.current = events[events.length - 1]!;
    queue.current.push({ state, events: fresh });
    void pump();
    // `events` is read, not watched: its message always lands before the state that
    // closes the batch, and reacting to it alone would split a batch from its state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function update(patch: Partial<Playback>): void {
    viewRef.current = { ...viewRef.current, ...patch };
    setView(viewRef.current);
  }

  function present(patch: Partial<Presentation>): Partial<Playback> {
    return { presentation: { ...viewRef.current.presentation, ...patch } };
  }

  function motionId(): number {
    motionSeq.current += 1;
    return motionSeq.current;
  }

  function withMotion(id: PlayerId, motion: TokenMotion): Partial<Playback> {
    return present({ motions: { ...viewRef.current.presentation.motions, [id]: motion } });
  }

  function reveal(more: readonly GameEvent[]): Partial<Playback> {
    if (more.length === 0) return {};
    return { events: [...viewRef.current.events, ...more].slice(-MAX_LOG_EVENTS) };
  }

  /** Waits, and says whether it is still worth carrying on afterwards. */
  function sleep(ms: number): Promise<boolean> {
    return new Promise(resolve => setTimeout(() => resolve(alive.current), ms));
  }

  /**
   * Shows `target` as the final word. Any token the steps left somewhere else (they only
   * approximate) snaps to where the server says it is.
   */
  function commit(target: GameState, pending: readonly GameEvent[]): void {
    const shown = viewRef.current.state;
    const motions = { ...viewRef.current.presentation.motions };
    for (const p of target.players) {
      const was = shown.players.find(q => q.id === p.id);
      if (was && was.tileIndex !== p.tileIndex) motions[p.id] = { id: motionId(), kind: 'snap' };
    }
    update({ ...reveal(pending), state: target, busy: false, ...present({ motions }) });
  }

  function showCard(card: CardDrawnEvent): void {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    update(present({ card }));
    cardTimer.current = setTimeout(() => {
      if (alive.current) update(present({ card: null }));
    }, CARD_SHOW_MS);
  }

  async function pump(): Promise<void> {
    if (running.current) return;
    running.current = true;
    try {
      while (alive.current && queue.current.length > 0) {
        // A hidden tab runs no animation frames, and a long backlog is stale news:
        // either way, show where things stand now rather than replaying the past.
        if (document.hidden || queue.current.length > MAX_BACKLOG) {
          const all = queue.current.splice(0);
          commit(all[all.length - 1]!.state, all.flatMap(b => b.events));
          continue;
        }
        await play(queue.current.shift()!);
      }
    } finally {
      running.current = false;
    }
  }

  async function play(batch: Batch): Promise<void> {
    if (!batch.events.some(isAnimated)) {
      commit(batch.state, batch.events);
      return;
    }
    const reduced = prefersReducedMotion();
    let shown = viewRef.current.state;
    update({ busy: true });

    for (const e of batch.events) {
      switch (e.type) {
        case 'rolled': {
          shown = { ...shown, lastRoll: e.dice };
          update({ state: shown, ...present({ rollId: viewRef.current.presentation.rollId + 1 }) });
          if (!reduced && !(await sleep(DICE_SETTLE_MS))) return;
          update(reveal([e]));
          break;
        }
        case 'moved': {
          const path = walkPath(e.from, e.to, tileCount);
          shown = patchPlayer(shown, e.playerId, { tileIndex: e.to });
          if (path.length < 2 || reduced) {
            update({ state: shown, ...withMotion(e.playerId, { id: motionId(), kind: 'snap' }), ...reveal([e]) });
            break;
          }
          const duration = walkSeconds(path.length - 1);
          update({ state: shown, ...withMotion(e.playerId, { id: motionId(), kind: 'walk', path, duration }) });
          const walkMs = duration * 1000;
          if (!(await sleep(walkMs + LAND_BEAT_MS))) return;
          update(reveal([e]));
          break;
        }
        case 'jailed': {
          const wasElsewhere = shown.players.find(p => p.id === e.playerId)?.tileIndex !== jailIndex;
          shown = patchPlayer(shown, e.playerId, { tileIndex: jailIndex, inJail: true });
          if (!wasElsewhere || reduced) {
            update({ state: shown, ...withMotion(e.playerId, { id: motionId(), kind: 'snap' }), ...reveal([e]) });
            break;
          }
          if (!(await sleep(JUMP_PAUSE_MS))) return;
          update({ state: shown, ...withMotion(e.playerId, { id: motionId(), kind: 'jump' }), ...reveal([e]) });
          if (!(await sleep((JUMP_OUT_S + JUMP_IN_S) * 1000))) return;
          break;
        }
        case 'left_jail': {
          // Out before the walk starts, so the cage doesn't ride along.
          shown = patchPlayer(shown, e.playerId, { inJail: false });
          update({ state: shown, ...reveal([e]) });
          break;
        }
        case 'card_drawn': {
          showCard(e);
          update(reveal([e]));
          if (!(await sleep(CARD_READ_MS))) return;
          break;
        }
        case 'paid': {
          shown = applyPaid(shown, e);
          update({ state: shown, ...reveal([e]) });
          break;
        }
        default:
          update(reveal([e]));
      }
    }
    commit(batch.state, []);
  }

  return view;
}
