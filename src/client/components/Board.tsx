import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  animate, motion, useMotionValue, useReducedMotion, useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import type { GameMap, GameEvent, GameState, Player, Tile } from '../../shared/types';
import { CORNER_TRACK_RATIO, ringLayout, trackSpan, type Edge, type GridPos } from '../ringLayout';
import { countryTint } from '../colors';
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

/** The angle equivalent to `rest` nearest `from`, so a face change with no roll doesn't spin. */
function nearestRest(from: number, rest: number): number {
  return rest + 360 * Math.round((from - rest) / 360);
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
  const scale = useTransform(toss, v => 1 + v * 0.14);
  const seenRoll = useRef(rollId);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (rollId === seenRoll.current || reduced) {
      seenRoll.current = rollId;
      rx.set(nearestRest(rx.get(), restX));
      ry.set(nearestRest(ry.get(), restY));
      return;
    }
    seenRoll.current = rollId;
    const delay = index * DICE_STAGGER_S;
    const spin = { duration: DICE_SPIN_S - delay, delay, ease: [0.15, 0.55, 0.25, 1] as const };
    const controls = [
      animate(rx, spinTarget(rx.get(), restX, 2 + index), spin),
      animate(ry, spinTarget(ry.get(), restY, 3 - index), spin),
      // Up, down onto the felt, one small bounce, and still.
      animate(toss, [0, 1, 0, 0.18, 0], {
        duration: DICE_SPIN_S - delay, delay,
        times: [0, 0.32, 0.64, 0.8, 1],
        ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'],
      }),
    ];
    return () => controls.forEach(c => c.stop());
  }, [rollId, restX, restY, index, rx, ry, toss, reduced]);

  return (
    <motion.div className="die" style={{ y, scale }} aria-label={`die showing ${value}`}>
      <motion.div className="die__cube" style={{ rotateX: rx, rotateY: ry }}>
        {[1, 2, 3, 4, 5, 6].map(face => (
          <div key={face} className={`die__face die__face--${face}`}>
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
type SpotOf = (tileIndex: number, index?: number, count?: number) => Placement;

/**
 * Tokens stand in the middle of their tile, spread out when they share it. Corner tracks
 * are wider than side tracks, so each offset is measured against the track the tile
 * actually sits in, not one uniform cell.
 */
function spotFinder(positions: readonly GridPos[], tracks: readonly number[]): SpotOf {
  return (tileIndex, index = 0, count = 1) => {
    const pos = positions[tileIndex];
    if (!pos) return { spot: [50, 50], scale: 1, corner: false };
    const col = trackSpan(tracks, pos.col);
    const row = trackSpan(tracks, pos.row);
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

  return (
    <motion.div className="token-track" style={{ x: tx, y: ty, zIndex: moving ? 3 : isCurrent ? 2 : 1 }}>
      <motion.div
        className={`token${isCurrent ? ' token--turn' : ''}${moving ? ' token--moving' : ''}`}
        style={{ scale: anchorScale }}
      >
        <span className="token__shadow" />
        <motion.span
          className="token__body"
          style={{ scale: bodyScale, background: player.color }}
          title={player.name}
        >
          <span className="token__eye" />
          <span className="token__eye" />
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

function TokenLayer({
  tracks, positions, players, currentPlayerId, motions,
}: {
  tracks: readonly number[];
  positions: readonly GridPos[];
  players: readonly Player[];
  currentPlayerId: string | undefined;
  motions: Presentation['motions'];
}) {
  const spotOf = spotFinder(positions, tracks);
  const live = players.filter(p => !p.bankrupt);
  const byTile = new Map<number, Player[]>();
  for (const p of live) {
    const arr = byTile.get(p.tileIndex) ?? [];
    arr.push(p);
    byTile.set(p.tileIndex, arr);
  }

  return (
    <div className="board__tokens-layer" style={{ gridRow: `1 / -1`, gridColumn: `1 / -1` }}>
      {live.map(p => {
        const group = byTile.get(p.tileIndex) ?? [p];
        return (
          <Token
            key={p.id}
            player={p}
            place={spotOf(p.tileIndex, group.indexOf(p), group.length)}
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

function BoardTile({
  tile, pos, owner, houses, hotel, onClick,
}: {
  tile: Tile;
  pos: { row: number; col: number; edge: Edge; isCorner: boolean };
  owner: Player | null;
  houses: number;
  hotel: boolean;
  /** Present on properties, which open their deed card; the rest of the board is inert. */
  onClick?: (el: HTMLElement) => void;
}) {
  const { row, col, edge, isCorner } = pos;
  const sub = tileSubLabel(tile);
  // Corners read upright; the four runs read along their own edge, which is what
  // buys side tiles enough room for a full city name instead of an ellipsis.
  const orient = isCorner ? 'corner' : edge;

  return (
    <div
      className={`tile tile--${tile.type} tile--o-${orient}${isCorner ? ' tile--corner' : ''}${onClick ? ' tile--clickable' : ''}`}
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
      {tile.type === 'city' && <div className="tile__flag"><FlagImage tile={tile} /></div>}
      {owner && <div className="tile__owner" style={{ background: owner.color }} title={owner.name} />}
    </div>
  );
}
