import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  animate, motion, useMotionValue, useReducedMotion, useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import type { CountryId, GameMap, GameEvent, GameState, Player, Tile } from '../../shared/types';
import { CORNER_TRACK_RATIO, ringLayout, trackSpan, type Edge, type GridPos } from '../ringLayout';
import { countryColor, countryTint, tileShine } from '../colors';
import { tileSubLabel } from '../tileArt';
import { DICE_SPIN_S, DICE_STAGGER_S, JUMP_IN_S, JUMP_OUT_S, WALK_EASE } from '../motionTiming';
import type { CardDrawnEvent, Presentation, TokenMotion } from '../playback';
import { FlagImage, Icon, TileIcon } from './TileBadge';
import { EventLog, getCardSafe } from './EventLog';

function formatPhase(phase: GameState['phase']): string {
  switch (phase) {
    case 'LOBBY': return 'Waiting to start';
    case 'AWAITING_ROLL': return 'Rolling';
    case 'AWAITING_BUY': return 'Buying';
    case 'RESOLVING_DEBT': return 'Settling debt';
    case 'AWAITING_END_TURN': return 'Turn wrapping up';
    case 'GAME_OVER': return 'Game over';
  }
}

function ownerOf(players: readonly Player[], id: string | null): Player | null {
  if (!id) return null;
  return players.find(p => p.id === id) ?? null;
}

/** Which of a 3x3 grid's nine cells carry a pip, per die face. */
const PIP_CELLS: Readonly<Record<number, readonly number[]>> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * Rotation that brings each face to the front of the cube. The inverse of where
 * the face itself is pinned in `styles.css` — face 2 sits at rotateX(90deg), so
 * showing it means turning the cube back by -90.
 */
const FACE_REST: Readonly<Record<number, readonly [number, number]>> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

/** The first angle at least `turns` whole turns past `from` that is equivalent to `rest`. */
function spinTarget(from: number, rest: number, turns: number): number {
  return rest + 360 * Math.ceil((from + turns * 360 - rest) / 360);
}

/**
 * A real cube: six pipped faces in 3D. A roll tosses it up off the felt, tumbles it
 * several whole turns, and drops it with a small bounce onto its face. Each die spins a
 * different number of turns on each axis, and the second leaves a beat after the first,
 * so the pair never move in lockstep.
 *
 * The tumble is still decoration and never decides anything: the resting rotation is
 * derived from the authoritative `value`, so a client that joins mid-game renders the
 * current face with no animation to replay, and the a11y label always names the real
 * value even mid-spin. `rollId` (from the playback queue) is what starts a tumble.
 */
function Die({ value, rollId, index }: { value: number; rollId: number; index: number }) {
  const [restX, restY] = FACE_REST[value] ?? [0, 0];
  const rx = useMotionValue(restX);
  const ry = useMotionValue(restY);
  const toss = useMotionValue(0);
  const y = useTransform(toss, v => `${-v * 42}%`);
  // At rest only the face showing is drawn, and the angles are exactly the rest ones. A
  // tumble leaves the cube turned through whole turns (720deg and so on), and a cube of six
  // planes at those angles is something Chrome's compositor splits and re-sorts with
  // rounding error, which showed as hairlines across the dice whenever something nearby
  // redrew. One plane at a right angle has nothing to split against.
  const [still, setStill] = useState(true);
  const seenRoll = useRef(rollId);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (rollId === seenRoll.current || reduced) {
      seenRoll.current = rollId;
      rx.set(restX);
      ry.set(restY);
      setStill(true);
      return;
    }
    seenRoll.current = rollId;
    setStill(false);
    const delay = index * DICE_STAGGER_S;
    const spin = { duration: DICE_SPIN_S - delay, delay, ease: [0.15, 0.55, 0.25, 1] as const };
    const controls = [
      animate(rx, spinTarget(rx.get(), restX, 2 + index), spin),
      animate(ry, spinTarget(ry.get(), restY, 3 - index), spin),
      // Up, down onto the felt, one small bounce, and still. Height only, no growth: a die
      // scaled mid-flight can be left drawn at its airborne resolution once it lands.
      animate(toss, [0, 1, 0, 0.18, 0], {
        duration: DICE_SPIN_S - delay, delay,
        times: [0, 0.32, 0.64, 0.8, 1],
        ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'],
      }),
    ];
    let live = true;
    void Promise.all(controls).then(() => {
      if (!live) return;
      rx.set(restX);
      ry.set(restY);
      setStill(true);
    });
    return () => {
      live = false;
      controls.forEach(c => c.stop());
    };
  }, [rollId, restX, restY, index, rx, ry, toss, reduced]);

  return (
    <motion.div className="die" style={{ y }} aria-label={`die showing ${value}`}>
      <motion.div className="die__cube" style={{ rotateX: rx, rotateY: ry }}>
        {[1, 2, 3, 4, 5, 6].map(face => (
          <div key={face} className={`die__face die__face--${face}${still && face !== value ? ' die__face--hidden' : ''}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIP_CELLS[face]!.includes(i) ? 'die__pip' : ''} />
            ))}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function DrawnCardPanel({ event, players }: { event: CardDrawnEvent; players: readonly Player[] }) {
  const card = getCardSafe(event.cardId);
  if (!card) return null;
  const drawer = players.find(p => p.id === event.playerId);
  return (
    <div className="board__card-popup" role="status">
      <div className="board__card-popup-deck">{event.deck} card</div>
      <div className="board__card-popup-text">{card.text}</div>
      {drawer && <div className="board__card-popup-player">{drawer.name}</div>}
    </div>
  );
}

/**
 * Where each of `count` tokens sharing a tile stands, and how big it is drawn. `u` runs along
 * the tile's edge and `v` into the board, both as fractions of the tile's extent on that
 * axis. Side tiles are half again as deep as they are wide, so a crowd stacks into the depth
 * first, and tokens shrink as the crowd grows so that even eight stay inside the tile.
 */
const CROWDS: Readonly<Record<number, { scale: number; cells: readonly (readonly [number, number])[] }>> = {
  1: { scale: 1, cells: [[0, 0]] },
  2: { scale: 0.82, cells: [[0, -0.2], [0, 0.2]] },
  3: { scale: 0.72, cells: [[-0.2, -0.2], [0.2, -0.2], [0, 0.2]] },
  4: { scale: 0.7, cells: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] },
  6: { scale: 0.6, cells: [[-0.2, -0.27], [0.2, -0.27], [-0.2, 0], [0.2, 0], [-0.2, 0.27], [0.2, 0.27]] },
  8: {
    scale: 0.55,
    cells: [[-0.2, -0.3], [0.2, -0.3], [-0.2, -0.1], [0.2, -0.1], [-0.2, 0.1], [0.2, 0.1], [-0.2, 0.3], [0.2, 0.3]],
  },
};

function crowdLayout(count: number) {
  const size = [1, 2, 3, 4, 6, 8].find(n => n >= count) ?? 8;
  return CROWDS[size]!;
}

type Spot = readonly [number, number];
/** Where a token stands on the layer, in percent of it, and the scale it is drawn at. */
interface Placement { spot: Spot; scale: number; corner: boolean }
type SpotOf = (tileIndex: number, index?: number, count?: number, inCell?: boolean) => Placement;

/** A token's diameter in percent of the board: `.token`'s font-size is 4.4cqmin of it. */
const TOKEN_PCT = 4.4;
/**
 * The prison corner is split the way richup splits it: a square cell in the corner's inner
 * angle, this share of the corner on each side, and an L-shaped "passing by" band along the
 * two outer edges. The band is what is left, deep enough for one full-size token.
 */
export const JAIL_CELL = 0.6;
const JAIL_BAND = 1 - JAIL_CELL;

/**
 * Points on the prison corner are given as (p, q): p is the distance from the corner's outer
 * side edge, q from its outer top or bottom edge, both as fractions of the corner. That reads
 * the same on whichever corner a map puts its prison, and this turns it into board percent.
 */
function cornerPoint(pos: GridPos, tracks: readonly number[], p: number, q: number): Spot {
  const col = trackSpan(tracks, pos.col);
  const row = trackSpan(tracks, pos.row);
  const x = pos.col === 1 ? p : 1 - p;
  const y = pos.row === 1 ? q : 1 - q;
  return [col.centre - col.size / 2 + x * col.size, row.centre - row.size / 2 + y * row.size];
}

/**
 * Visitors stand in the band. One stands in its outer corner; two take an arm each; more
 * alternate between the two arms, spaced evenly along each, with the outer corner used
 * when the count is odd. They shrink only as far as the spacing along an arm needs.
 */
function passingBySlot(index: number, count: number, cornerPct: number): { p: number; q: number; scale: number } {
  const perArm = Math.floor(count / 2);
  const outer = count % 2 === 1;
  const spacing = perArm > 0 ? (JAIL_CELL * cornerPct) / perArm : Infinity;
  const scale = Math.min(1, (0.95 * Math.min(spacing, JAIL_BAND * cornerPct)) / TOKEN_PCT);
  const mid = JAIL_BAND / 2;
  if (outer && index === 0) return { p: mid, q: mid, scale };
  const k = outer ? index - 1 : index;
  const along = JAIL_BAND + ((Math.floor(k / 2) + 0.5) * JAIL_CELL) / Math.max(perArm, 1);
  return k % 2 === 0 ? { p: along, q: mid, scale } : { p: mid, q: along, scale };
}

/** Prisoners stand in a small square grid inside the cell, shrinking to fit it. */
function cellSlot(index: number, count: number, cornerPct: number): { p: number; q: number; scale: number } {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const scale = Math.min(1, (0.9 * JAIL_CELL * cornerPct) / cols / TOKEN_PCT);
  const c = index % cols;
  const r = Math.floor(index / cols) + (cols - rows) / 2;
  return { p: JAIL_BAND + (JAIL_CELL * (c + 0.5)) / cols, q: JAIL_BAND + (JAIL_CELL * (r + 0.5)) / cols, scale };
}

/** The cell's box on the board, in percent, for the cage drawn over it. */
function jailCellRect(pos: GridPos, tracks: readonly number[]) {
  const [x1, y1] = cornerPoint(pos, tracks, JAIL_BAND, JAIL_BAND);
  const [x2, y2] = cornerPoint(pos, tracks, 1, 1);
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/**
 * Tokens stand in the middle of their tile, spread out when they share it. Corner tracks
 * are wider than side tracks, so each offset is measured against the track the tile
 * actually sits in, not one uniform cell.
 */
function spotFinder(positions: readonly GridPos[], tracks: readonly number[], jailIndex: number): SpotOf {
  return (tileIndex, index = 0, count = 1, inCell = false) => {
    const pos = positions[tileIndex];
    if (!pos) return { spot: [50, 50], scale: 1, corner: false };
    const col = trackSpan(tracks, pos.col);
    const row = trackSpan(tracks, pos.row);
    // The prison has its own two places to stand. A token walking past goes round through
    // the band too, since its single-token spot is the band's outer corner.
    if (tileIndex === jailIndex && pos.isCorner) {
      const { p, q, scale } = (inCell ? cellSlot : passingBySlot)(index, count, col.size);
      return { spot: cornerPoint(pos, tracks, p, q), scale, corner: true };
    }
    const { scale, cells } = crowdLayout(count);
    const [u, v] = cells[index] ?? [0, 0];
    // The left and right runs lie on their side: along the edge is down the screen.
    const sideways = !pos.isCorner && (pos.edge === 'left' || pos.edge === 'right');
    const [dx, dy] = sideways ? [v, u] : [u, v];
    return { spot: [col.centre + dx * col.size, row.centre + dy * row.size], scale, corner: pos.isCorner };
  };
}

/** How a token makes room when another arrives or leaves its tile: quick, with a little give. */
const SHUFFLE_SPRING = { type: 'spring', stiffness: 300, damping: 26 } as const;
/** A token grows with its speed: this much bigger per (percent of the board per second)… */
const GROWTH_PER_SPEED = 0.2 / 150;
/** …up to this much at the most, on the long runs a card sends you on. */
const MAX_GROWTH = 0.4;
/** How far a moving token's corners are rounded off, in percent of the board. */
const CORNER_RADIUS = 4;

/**
 * The route a walk takes: straight down each edge, rounded through the corners it passes,
 * as a dense list of points with a lookup from distance travelled to position. Tile centres
 * along one edge are collinear, so the only turns are at corner tiles.
 */
function route(points: readonly Spot[]): (fraction: number) => Spot {
  const dense: Spot[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1]!, points[i]!, points[i + 1]!];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(CORNER_RADIUS, ab / 2, bc / 2);
    if (r <= 0) continue;
    const p1: Spot = [b[0] + ((a[0] - b[0]) * r) / ab, b[1] + ((a[1] - b[1]) * r) / ab];
    const p2: Spot = [b[0] + ((c[0] - b[0]) * r) / bc, b[1] + ((c[1] - b[1]) * r) / bc];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      const k = [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2] as const;
      dense.push([k[0] * p1[0] + k[1] * b[0] + k[2] * p2[0], k[0] * p1[1] + k[1] * b[1] + k[2] * p2[1]]);
    }
  }
  dense.push(points[points.length - 1]!);

  const along = [0];
  for (let i = 1; i < dense.length; i++) {
    along.push(along[i - 1]! + Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]));
  }
  const total = along[along.length - 1]!;
  return fraction => {
    if (total === 0) return dense[dense.length - 1]!;
    const d = Math.min(Math.max(fraction, 0), 1) * total;
    let i = 1;
    while (i < along.length - 1 && along[i]! < d) i++;
    const span = along[i]! - along[i - 1]!;
    const t = span === 0 ? 0 : (d - along[i - 1]!) / span;
    const [p, q] = [dense[i - 1]!, dense[i]!];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
}

/**
 * A player's token. It stands on `spot` and gets there by whatever `motion` the playback
 * queue last gave it: gliding along the ring for a walk, vanishing and popping up for a
 * jump to prison, or simply appearing. Without a new motion, a change of `spot` means the
 * tokens on a tile are making room for each other, and it springs across.
 *
 * A walk is one continuous glide: it pulls away hard, runs, and eases to a stop on the
 * tile, rounding the corners on the way, and the token swells with its speed. Every moving
 * part is a Framer motion value on a transform, so a walk never re-renders React and runs
 * on the compositor. The track wrapper is the size of the whole token layer, which is what
 * lets `x`/`y` be percentages of the board: a translate percentage is of the element's own box.
 */
function Token({
  player, place, motion: move, spotOf, isCurrent,
}: {
  player: Player;
  place: Placement;
  motion: TokenMotion | undefined;
  spotOf: SpotOf;
  isCurrent: boolean;
}) {
  const { spot, scale: crowdScale } = place;
  const x = useMotionValue(spot[0]);
  const y = useMotionValue(spot[1]);
  const size = useMotionValue(crowdScale);
  const speed = useMotionValue(0);
  const pop = useMotionValue(1);
  const tx = useTransform(x, v => `${v}%`);
  const ty = useTransform(y, v => `${v}%`);
  const anchorScale = useTransform([pop, size], ([p, s]) => (p as number) * (s as number));
  const bodyScale = useTransform(speed, v => 1 + Math.min(MAX_GROWTH, v * GROWTH_PER_SPEED));

  const [moving, setMoving] = useState(false);
  const handled = useRef(move?.id ?? 0);
  const inFlight = useRef(false);
  const latest = useRef(spot);
  latest.current = spot;
  const running = useRef<AnimationPlaybackControls[]>([]);

  function stopAll(): void {
    for (const c of running.current) c.stop();
    running.current = [];
  }

  function settle(): void {
    running.current = [
      animate(x, latest.current[0], SHUFFLE_SPRING),
      animate(y, latest.current[1], SHUFFLE_SPRING),
    ];
  }

  async function run(m: TokenMotion): Promise<void> {
    const current = () => handled.current === m.id;
    inFlight.current = true;
    setMoving(true);
    try {
      if (m.kind === 'snap') {
        x.set(latest.current[0]);
        y.set(latest.current[1]);
        speed.set(0);
        pop.set(1);
        return;
      }
      if (m.kind === 'jump') {
        const out = animate(pop, 0, { duration: JUMP_OUT_S, ease: 'backIn' });
        running.current = [out];
        await out;
        if (!current()) return;
        x.set(latest.current[0]);
        y.set(latest.current[1]);
        const back = animate(pop, 1, { type: 'spring', duration: JUMP_IN_S, bounce: 0.45 });
        running.current = [back];
        await back;
        return;
      }
      // Straight lines between the corners passed, from wherever the token is now to its
      // place on the last tile.
      const corners = m.path.slice(1, -1).filter(t => spotOf(t).corner).map(t => spotOf(t).spot);
      const at = route([[x.get(), y.get()], ...corners, latest.current]);
      let last = { time: performance.now(), x: x.get(), y: y.get() };
      const glide = animate(0, 1, {
        duration: m.duration,
        ease: WALK_EASE,
        onUpdate: fraction => {
          const [px, py] = at(fraction);
          x.set(px);
          y.set(py);
          const now = performance.now();
          const dt = (now - last.time) / 1000;
          if (dt > 0.001) {
            // Smoothed, since frame times jitter and the size should not.
            const measured = Math.hypot(px - last.x, py - last.y) / dt;
            speed.set(speed.get() + (measured - speed.get()) * 0.4);
          }
          last = { time: now, x: px, y: py };
        },
      });
      running.current = [glide];
      await glide;
      if (!current()) return;
      running.current = [animate(speed, 0, { duration: 0.15, ease: 'easeOut' })];
    } finally {
      if (current()) {
        inFlight.current = false;
        setMoving(false);
        // Someone may have arrived or left mid-walk and moved this token's place on the tile.
        if (x.get() !== latest.current[0] || y.get() !== latest.current[1]) settle();
      }
    }
  }

  useEffect(() => {
    if (move && move.id !== handled.current) {
      handled.current = move.id;
      stopAll();
      void run(move);
      return;
    }
    if (inFlight.current) return;
    stopAll();
    settle();
    // `run` and `settle` read the latest spot through a ref; the motion id and the spot
    // are the only things that start anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.id, spot[0], spot[1]]);

  useEffect(() => {
    const c = animate(size, crowdScale, SHUFFLE_SPRING);
    return () => c.stop();
  }, [crowdScale, size]);

  useEffect(() => () => stopAll(), []);

  // A prisoner stays under the cage (`CAGE_LAYER`), even popping into the cell; everyone
  // else is drawn over it, and a moving token over everything.
  const layer = player.inJail ? (isCurrent ? 2 : 1) : moving ? 6 : isCurrent ? 5 : 4;

  return (
    <motion.div className="token-track" style={{ x: tx, y: ty, zIndex: layer }}>
      <motion.div
        className={`token${isCurrent ? ' token--turn' : ''}${moving ? ' token--moving' : ''}`}
        style={{ scale: anchorScale }}
      >
        <span className="token__shadow" />
        <motion.span
          className="token__body"
          style={{ scale: bodyScale, background: player.color }}
          title={player.inJail ? `${player.name} (in prison)` : player.name}
        >
          <span className="token__eye" />
          <span className="token__eye" />
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

/** Between prisoners (1–2) and every other token (4–6). */
const CAGE_LAYER = 3;

function TokenLayer({
  tracks, positions, players, currentPlayerId, motions, jailIndex,
}: {
  tracks: readonly number[];
  positions: readonly GridPos[];
  players: readonly Player[];
  currentPlayerId: string | undefined;
  motions: Presentation['motions'];
  jailIndex: number;
}) {
  const spotOf = spotFinder(positions, tracks, jailIndex);
  const live = players.filter(p => !p.bankrupt);
  // Prisoners and visitors share a tile but not a crowd: each lays out in its own space.
  const inCell = (p: Player) => p.inJail && p.tileIndex === jailIndex;
  const groupKey = (p: Player) => `${p.tileIndex}${inCell(p) ? ':cell' : ''}`;
  const groups = new Map<string, Player[]>();
  for (const p of live) {
    const arr = groups.get(groupKey(p)) ?? [];
    arr.push(p);
    groups.set(groupKey(p), arr);
  }
  const jailPos = positions[jailIndex];
  const cage = jailPos?.isCorner ? jailCellRect(jailPos, tracks) : null;

  return (
    <div className="board__tokens-layer" style={{ gridRow: `1 / -1`, gridColumn: `1 / -1` }}>
      {/* Bars over the whole cell, so whoever is inside shows through them. */}
      {cage && (
        <div
          className="board__cage"
          style={{ left: `${cage.left}%`, top: `${cage.top}%`, width: `${cage.width}%`, height: `${cage.height}%`, zIndex: CAGE_LAYER }}
        >
          <Icon name="prison" />
        </div>
      )}
      {live.map(p => {
        const group = groups.get(groupKey(p)) ?? [p];
        return (
          <Token
            key={p.id}
            player={p}
            place={spotOf(p.tileIndex, group.indexOf(p), group.length, inCell(p))}
            motion={motions[p.id]}
            spotOf={spotOf}
            isCurrent={p.id === currentPlayerId}
          />
        );
      })}
    </div>
  );
}

/** A property tile was clicked: its viewport rect, and the board's middle (inside the ring). */
export type TileClickHandler = (tileIndex: number, rect: DOMRect, middle: DOMRect) => void;

const STILL: Presentation = { rollId: 0, motions: {}, card: null };

export function Board({
  map, state, events = [], onTileClick, controls, presentation = STILL,
}: {
  map: GameMap;
  /** The state as shown — in a game, the playback queue's (`usePlayback`), not the server's. */
  state: GameState;
  events?: readonly GameEvent[];
  /** Absent where the board is scenery (the lobby) and nothing on it should respond. */
  onTileClick?: TileClickHandler;
  /** The turn's buttons, right under the dice. Without them the phase is named instead. */
  controls?: ReactNode;
  /** What the playback queue is animating. Absent, the board is still. */
  presentation?: Presentation;
}) {
  const middleRef = useRef<HTMLDivElement>(null);
  const clickTile = onTileClick && ((tileIndex: number, el: HTMLElement) => {
    const middle = middleRef.current;
    if (middle) onTileClick(tileIndex, el.getBoundingClientRect(), middle.getBoundingClientRect());
  });
  const { side, positions, tracks } = ringLayout(map.tiles.length);
  const template = tracks.map(t => `${t}fr`).join(' ');
  const units = tracks.reduce((a, b) => a + b, 0);
  const { rollId, motions, card: drawnCard } = presentation;
  const setsCompleted = useSetsCompleted(map, state);

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: template,
        gridTemplateRows: template,
        // Bigger boards mean narrower tiles, so text scales with the ring rather
        // than being tuned for one tile count. 12 is the 40-tile board's width in
        // track units: 9 side tracks plus two corners at `CORNER_TRACK_RATIO`.
        ['--tile-scale' as string]: String((9 + 2 * CORNER_TRACK_RATIO) / units),
      }}
    >
      {map.tiles.map((tile, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const ownership = state.tiles[i];
        return (
          <BoardTile
            key={tile.index}
            tile={tile}
            pos={pos}
            owner={ownership ? ownerOf(state.players, ownership.owner) : null}
            houses={ownership?.houses ?? 0}
            hotel={ownership?.hotel ?? false}
            setCompleted={tile.type === 'city' ? setsCompleted.get(tile.countryId) ?? 0 : 0}
            onClick={clickTile && isProperty(tile) ? el => clickTile(i, el) : undefined}
          />
        );
      })}
      <TokenLayer
        tracks={tracks}
        positions={positions}
        players={state.players}
        currentPlayerId={state.turnOrder[state.currentPlayerIndex]}
        motions={motions}
        jailIndex={map.jailIndex}
      />
      <div ref={middleRef} className="board__center" style={{ gridRow: `2 / ${side}`, gridColumn: `2 / ${side}` }}>
        <div className="board__center-inner">
          {/* The dice are always on show, sitting a little above the middle of the space
              over the log, with the turn's buttons right under them. */}
          <div className="board__stage">
            <div className={`board__dice${state.lastRoll ? '' : ' board__dice--idle'}`}>
              <Die value={state.lastRoll?.[0] ?? 1} rollId={rollId} index={0} />
              <Die value={state.lastRoll?.[1] ?? 1} rollId={rollId} index={1} />
            </div>
            {controls ?? <div className="board__phase">{formatPhase(state.phase)}</div>}
            {state.vacationPot > 0 && (
              <div className="board__vacation-pot">Vacation pot: ${state.vacationPot}</div>
            )}
          </div>
          {/* A drawn card covers the log for a few seconds rather than the dice or the
              buttons; the log repeats the card's text, so nothing is lost while it's up.
              Being absolutely positioned with `inset: 0`, it fills this box. */}
          <div className="board__lower">
            <EventLog events={events} players={state.players} map={map} limit={6} />
            {drawnCard && <DrawnCardPanel event={drawnCard} players={state.players} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function isProperty(tile: Tile): boolean {
  return tile.type === 'city' || tile.type === 'airport' || tile.type === 'company';
}

/**
 * Counts, per country, the times one player has come to hold all of it since the board
 * mounted, by purchase or by trade. Sets already whole when the board first draws are not
 * news. A tile keys its glow on its country's count, so each new completion replays it.
 */
function useSetsCompleted(map: GameMap, state: GameState): ReadonlyMap<CountryId, number> {
  const holders = new Map<CountryId, string | null>();
  for (const tile of map.tiles) {
    if (tile.type !== 'city') continue;
    const owner = state.tiles[tile.index]?.owner ?? null;
    const held = holders.get(tile.countryId);
    holders.set(tile.countryId, held === undefined || held === owner ? owner : null);
  }
  const signature = [...holders].map(([c, o]) => `${c}:${o ?? ''}`).join(',');

  const [counts, setCounts] = useState<ReadonlyMap<CountryId, number>>(new Map());
  const previous = useRef(holders);
  useEffect(() => {
    const before = previous.current;
    previous.current = holders;
    const fresh = [...holders].filter(([c, o]) => o !== null && before.get(c) !== o).map(([c]) => c);
    if (fresh.length === 0) return;
    setCounts(old => {
      const next = new Map(old);
      for (const c of fresh) next.set(c, (next.get(c) ?? 0) + 1);
      return next;
    });
    // `signature` is `holders` in a form that only changes when a holder does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return counts;
}

function BoardTile({
  tile, pos, owner, houses, hotel, setCompleted, onClick,
}: {
  tile: Tile;
  pos: { row: number; col: number; edge: Edge; isCorner: boolean };
  owner: Player | null;
  houses: number;
  hotel: boolean;
  /** How many times this tile's country has become one player's whole set; each one glows. */
  setCompleted: number;
  /** Present on properties, which open their deed card; the rest of the board is inert. */
  onClick?: (el: HTMLElement) => void;
}) {
  const { row, col, edge, isCorner } = pos;
  const sub = tileSubLabel(tile);
  // Corners read upright; the four runs read along their own edge, which is what
  // buys side tiles enough room for a full city name instead of an ellipsis.
  const orient = isCorner ? 'corner' : edge;
  const isJail = isCorner && tile.type === 'corner' && tile.subtype === 'jail';
  const acquired = useAcquired(owner?.id ?? null);
  const [shone, setShone] = useState(0);
  const [glowed, setGlowed] = useState(0);
  const countryId = tile.type === 'city' ? tile.countryId : null;

  return (
    <div
      className={`tile tile--${tile.type} tile--o-${orient}${isCorner ? ' tile--corner' : ''}${tile.type === 'corner' ? ` tile--${tile.subtype}` : ''}${onClick ? ' tile--clickable' : ''}`}
      style={{ gridRow: row, gridColumn: col, backgroundImage: tile.type === 'city' ? countryTint(tile.countryId) : undefined }}
      title={tile.name}
      {...(onClick ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `${tile.name}, view card`,
        onClick: (e: React.MouseEvent<HTMLDivElement>) => onClick(e.currentTarget),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e.currentTarget);
          }
        },
      } : {})}
    >
      {/* Inner edge to outer: the badge, then name and price, then the owner's slab on the
          outer rim. A city's flag is not in this flow at all — it sits on the tile's inner
          border, half over the board's middle (see `.tile__flag`), which leaves the whole
          depth of the tile for the words. Other tiles keep their icon in the flow. */}
      {isJail ? <JailCorner row={row} col={col} /> : (
      <div className="tile__inner">
        {tile.type !== 'city' && <div className="tile__icon"><TileIcon tile={tile} /></div>}
        <div className="tile__text">
          <div className="tile__name">{tile.name}</div>
          {sub && <div className="tile__sub">{sub}</div>}
          {'price' in tile && <div className="tile__price">${tile.price}</div>}
          {(houses > 0 || hotel) && (
            <div className="tile__buildings">
              {hotel
                ? <Icon name="hotel" />
                : Array.from({ length: houses }, (_, n) => <Icon key={n} name="house" />)}
            </div>
          )}
        </div>
      </div>
      )}
      {tile.type === 'city' && <div className="tile__flag"><FlagImage tile={tile} /></div>}
      {owner && (
        <div
          key={`${owner.id}:${acquired}`}
          className={`tile__owner${acquired ? ' tile__owner--new' : ''}`}
          style={{ background: owner.color }}
          title={owner.name}
        />
      )}
      {acquired > shone && (
        <div
          key={`shine:${acquired}`}
          className="tile__shine"
          aria-hidden
          style={{ ['--shine' as string]: tileShine(countryId) }}
          onAnimationEnd={() => setShone(acquired)}
        />
      )}
      {countryId && setCompleted > glowed && (
        <div
          key={`glow:${setCompleted}`}
          className="tile__set-glow"
          aria-hidden
          style={{ ['--set' as string]: countryColor(countryId) }}
          onAnimationEnd={() => setGlowed(setCompleted)}
        />
      )}
    </div>
  );
}

/**
 * Counts the times a tile has changed hands to someone since it mounted, so a purchase (or
 * a trade) can replay its shine and grow the owner's bar in, keyed on the count. What a
 * tile already owns when the board first draws is not news, and stays still.
 */
function useAcquired(ownerId: string | null): number {
  const [count, setCount] = useState(0);
  const previous = useRef(ownerId);
  useEffect(() => {
    if (ownerId === previous.current) return;
    previous.current = ownerId;
    if (ownerId) setCount(n => n + 1);
  }, [ownerId]);
  return count;
}

/**
 * The prison corner's face: the cell in the corner's inner angle, and "Passing by" along the
 * band's outer edge. The cage itself is drawn in the token layer, over the cell, so that the
 * prisoners standing in it show through the bars.
 */
function JailCorner({ row, col }: { row: number; col: number }) {
  const cellSide = `${JAIL_CELL * 100}%`;
  const bandSide = `${JAIL_BAND * 100}%`;
  return (
    <>
      <div
        className="tile__cell"
        style={{
          width: cellSide, height: cellSide,
          ...(col === 1 ? { right: 0 } : { left: 0 }),
          ...(row === 1 ? { bottom: 0 } : { top: 0 }),
        }}
      />
      <div
        className="tile__passing"
        style={{ height: bandSide, ...(row === 1 ? { top: 0 } : { bottom: 0, alignItems: 'flex-end', paddingTop: 0, paddingBottom: '2cqmin' }) }}
      >
        Passing by
      </div>
    </>
  );
}
