import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  animate, motion, useMotionValue, useReducedMotion, useTransform,
  type AnimationPlaybackControls, type MotionValue,
} from 'framer-motion';
import type { GameMap, GameEvent, GameState, Player, Tile } from '../../shared/types';
import { CORNER_TRACK_RATIO, ringLayout, trackSpan, type Edge, type GridPos } from '../ringLayout';
import { countryTint } from '../colors';
import { tileSubLabel } from '../tileArt';
import { DICE_SPIN_S, DICE_STAGGER_S, JUMP_IN_S, JUMP_OUT_S } from '../motionTiming';
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

/** Fractional (dx, dy) nudge, as a share of one cell, for the i-th of `count`
 * tokens sharing a tile — spread evenly around a small circle so any group
 * size (rooms allow up to 8 players) stays distinguishable instead of a
 * fixed-length table silently stacking token 6 on top of token 1. */
function tokenOffset(index: number, count: number): readonly [number, number] {
  if (count <= 1) return [0, 0];
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  const radius = 0.2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/**
 * Stands a token on the tile's badge at the inner edge — the flag that sits on the border,
 * or a non-city tile's icon just inside it. The badge is the one part of a tile that can be
 * covered without losing anything: the name sits right beside it and stays readable, the
 * owner's slab on the outer rim stays in view, and the tile's tint still says the country.
 * A token is wider than the flag, so it is centred a little past the border, over the
 * board's middle; centred on the tile side it would reach across into the name.
 * Corners are square and roomy enough not to need it.
 */
function badgeNudge(pos: GridPos): readonly [number, number] {
  // A corner reads upright and stacks its name above its icon, so the token drops onto
  // the icon rather than sitting dead centre across the name.
  if (pos.isCorner) return [0, 0.18];
  switch (pos.edge) {
    case 'bottom': return [0, -0.56];
    case 'top': return [0, 0.56];
    case 'left': return [0.56, 0];
    default: return [-0.56, 0];
  }
}

type Spot = readonly [number, number];
type SpotOf = (tileIndex: number, offset?: readonly [number, number]) => Spot;

/**
 * Where on the token layer, in percent of it, a token stands on a tile. Corner tracks are
 * wider than side tracks, so offsets are measured against the track the tile actually sits
 * in, not one uniform cell.
 */
function spotFinder(positions: readonly GridPos[], tracks: readonly number[]): SpotOf {
  return (tileIndex, offset = [0, 0]) => {
    const pos = positions[tileIndex];
    if (!pos) return [50, 50];
    const col = trackSpan(tracks, pos.col);
    const row = trackSpan(tracks, pos.row);
    const [nx, ny] = badgeNudge(pos);
    return [col.centre + (nx + offset[0]) * col.size, row.centre + (ny + offset[1]) * row.size];
  };
}

/** How a token makes room when another arrives or leaves its tile: quick, with a little give. */
const SHUFFLE_SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;
/** How far a hop lifts the token, in token heights. */
const HOP_LIFT = 0.62;
/** Squash and stretch: tall on take-off, flat on landing. */
const STRETCH = 1.1;
const SQUASH = 0.8;

/** The keyframes for a walk: each hop eases out of one tile and into the next, rising and
 * falling on the way, stretching as it leaves and squashing as it lands. */
function walkKeyframes(from: Spot, points: readonly Spot[], hops: readonly number[]) {
  const total = hops.reduce((a, b) => a + b, 0);
  const at: number[] = [0];
  for (const h of hops) at.push(at[at.length - 1]! + h);
  const times = at.map(t => t / total);

  const lift: number[] = [0];
  const liftTimes: number[] = [0];
  const squash: number[] = [1];
  const squashTimes: number[] = [0];
  hops.forEach((h, k) => {
    const start = at[k]!;
    const end = at[k + 1]!;
    lift.push(1, 0);
    liftTimes.push((start + h / 2) / total, end / total);
    squash.push(STRETCH, SQUASH);
    squashTimes.push((start + h * 0.18) / total, end / total);
  });

  return {
    total,
    x: { values: [from[0], ...points.map(p => p[0])], times },
    y: { values: [from[1], ...points.map(p => p[1])], times },
    lift: { values: lift, times: liftTimes },
    squash: { values: squash, times: squashTimes },
  };
}

/**
 * A player's token. It stands on `spot` and gets there by whatever `motion` the playback
 * queue last gave it: hopping tile by tile along a walk, vanishing and popping up for a
 * jump to prison, or simply appearing. Without a new motion, a change of `spot` means the
 * tokens on a tile are making room for each other, and it springs across.
 *
 * Every moving part is a Framer motion value on a transform, so a walk never re-renders
 * React and runs on the compositor. The track wrapper is the size of the whole token layer,
 * which is what lets `x`/`y` be percentages of the board: a translate percentage is of the
 * element's own box.
 */
function Token({
  player, spot, motion: move, spotOf, isCurrent,
}: {
  player: Player;
  spot: Spot;
  motion: TokenMotion | undefined;
  spotOf: SpotOf;
  isCurrent: boolean;
}) {
  const x = useMotionValue(spot[0]);
  const y = useMotionValue(spot[1]);
  const lift = useMotionValue(0);
  const squash = useMotionValue(1);
  const pop = useMotionValue(1);
  const tx = useTransform(x, v => `${v}%`);
  const ty = useTransform(y, v => `${v}%`);
  const bodyY = useTransform(lift, v => `${-v * HOP_LIFT}em`);
  const scaleX = useTransform(squash, v => 1 + (1 - v) * 0.9);
  const shadowScale = useTransform(lift, v => 1 - v * 0.45);
  const shadowOpacity = useTransform(lift, v => 0.6 - v * 0.35);

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
        lift.set(0);
        squash.set(1);
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
      const points = m.path.slice(1).map((tile, i, all) => (i === all.length - 1 ? latest.current : spotOf(tile)));
      const k = walkKeyframes([x.get(), y.get()], points, m.hops);
      const legs = m.hops.map(() => 'easeInOut' as const);
      const hopEase = m.hops.flatMap(() => ['easeOut', 'easeIn'] as const);
      const walk = [
        animate(x, k.x.values, { duration: k.total, times: k.x.times, ease: legs }),
        animate(y, k.y.values, { duration: k.total, times: k.y.times, ease: legs }),
        animate(lift, k.lift.values, { duration: k.total, times: k.lift.times, ease: hopEase }),
        animate(squash, k.squash.values, { duration: k.total, times: k.squash.times, ease: 'easeInOut' }),
      ];
      running.current = walk;
      await Promise.all(walk);
      if (!current()) return;
      // Recover from the last landing's squash with a little wobble.
      running.current = [animate(squash, 1, { type: 'spring', stiffness: 520, damping: 13 })];
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

  useEffect(() => () => stopAll(), []);

  return (
    <motion.div className="token-track" style={{ x: tx, y: ty, zIndex: moving ? 3 : isCurrent ? 2 : 1 }}>
      <motion.div className={`token${isCurrent ? ' token--turn' : ''}`} style={{ scale: pop }}>
        <motion.span className="token__shadow" style={{ scale: shadowScale, opacity: shadowOpacity }} />
        {isCurrent && <span className="token__ring" style={{ borderColor: player.color }} />}
        <motion.span
          className="token__body"
          style={{ y: bodyY, scaleX, scaleY: squash as MotionValue<number>, background: player.color }}
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
            spot={spotOf(p.tileIndex, tokenOffset(group.indexOf(p), group.length))}
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
