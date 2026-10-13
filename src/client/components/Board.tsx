import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameMap, GameState, Player, Tile } from '../../shared/types';
import { CORNER_TRACK_RATIO, ringLayout, trackSpan, type Edge, type GridPos } from '../ringLayout';
import { countryTint } from '../colors';
import { countryFlag, tileIcon, tileSubLabel } from '../tileArt';
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

/**
 * A real cube: six pipped faces in 3D, tumbled by transitioning to a rotation
 * several whole turns past where it needs to land. `turns` counts rolls, so each
 * roll adds another full spin and the CSS transition does the settling.
 *
 * The tumble is still decoration and never decides anything: the resting rotation
 * is derived from the authoritative `value`, so a client that joins mid-game
 * renders the current face at `turns === 0` with no animation to replay, and the
 * a11y label always names the real value even mid-spin.
 */
function Die({ value, turns }: { value: number; turns: number }) {
  const [restX, restY] = FACE_REST[value] ?? [0, 0];
  return (
    <div className="die" aria-label={`die showing ${value}`}>
      <div
        className="die__cube"
        style={{ transform: `rotateX(${restX - turns * 360}deg) rotateY(${restY + turns * 720}deg)` }}
      >
        {[1, 2, 3, 4, 5, 6].map(face => (
          <div key={face} className={`die__face die__face--${face}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIP_CELLS[face]!.includes(i) ? 'die__pip' : ''} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type CardDrawnEvent = Extract<GameEvent, { type: 'card_drawn' }>;

/** Drives both the dice tumble and the drawn-card popup off the same scan of
 * what's newly arrived in `events` — an object-identity walk back from the
 * end to the last event already seen, not a length check, since the log
 * array gets truncated once it hits its cap. Only events appended since the
 * last render count as "new", so a client joining mid-game replays neither:
 * `state.lastRoll` renders correctly with no `rolled` event to animate it,
 * and no stale `card_drawn` pops up.
 *
 * The dice deliberately don't key off `state.lastRoll` changing — every
 * `state` message carries a freshly-parsed `lastRoll` array (same values or
 * not), so reference equality would tumble the dice on a buy, a build, or
 * any other player's turn. A `rolled` event is the one authoritative signal
 * that a roll actually happened. */
function useBoardEventEffects(
  events: readonly GameEvent[],
): { drawnCard: CardDrawnEvent | null; rolling: boolean } {
  const [drawnCard, setDrawnCard] = useState<CardDrawnEvent | null>(null);
  const [rolling, setRolling] = useState(false);
  const lastSeen = useRef<GameEvent | null>(events.length > 0 ? events[events.length - 1]! : null);
  // Held in refs, not cleared by this effect's cleanup: `events` changes on every
  // broadcast, and a card's own effect emits `paid`/`moved` in the very next one — a
  // cleanup that killed pending timers would cancel the dismissal that batch triggered
  // and leave the popup (or the tumbling dice) on screen until the next card or roll.
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    if (rollTimer.current) clearTimeout(rollTimer.current);
  }, []);

  useEffect(() => {
    const boundary = lastSeen.current;
    const fresh: GameEvent[] = [];
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]!;
      if (event === boundary) break;
      fresh.push(event);
    }
    lastSeen.current = events.length > 0 ? events[events.length - 1]! : lastSeen.current;

    const card = fresh.find(
      (e): e is CardDrawnEvent => e.type === 'card_drawn' && getCardSafe(e.cardId) !== null,
    );
    if (card) {
      if (cardTimer.current) clearTimeout(cardTimer.current);
      setDrawnCard(card);
      cardTimer.current = setTimeout(() => setDrawnCard(null), 4500);
    }

    if (fresh.some((e) => e.type === 'rolled')) {
      if (rollTimer.current) clearTimeout(rollTimer.current);
      setRolling(true);
      rollTimer.current = setTimeout(() => setRolling(false), 900);
    }
  }, [events]);

  return { drawnCard, rolling };
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
 * The tile a token is *drawn* on, which walks the ring one tile at a time toward
 * the tile the server says it occupies. Transitioning straight from the old
 * position to the new one interpolates both axes at once and cuts diagonally
 * across the board; every adjacent pair of ring positions differs on exactly one
 * axis, so stepping tile by tile keeps the token on the track.
 *
 * Long hops are teleports, not walks — going to prison, or a card sending you
 * across the board — and are snapped. The cut-off is a fraction of the ring, never
 * a dice-sized constant: boards are 40 or 48 tiles and nothing here may assume which.
 *
 * The effect keys on `target` alone, so an unrelated re-render (another player's
 * move, a rent payment) can't restart or abort a walk in progress; a genuinely new
 * target mid-walk just re-aims from wherever the token had got to.
 */
function useWalkedTile(target: number, tileCount: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const forward = (((target - from) % tileCount) + tileCount) % tileCount;
    const step = forward <= tileCount - forward ? 1 : -1;
    if (Math.min(forward, tileCount - forward) > tileCount / 4) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const id = setInterval(() => {
      const next = (((shownRef.current + step) % tileCount) + tileCount) % tileCount;
      shownRef.current = next;
      setShown(next);
      if (next === target) clearInterval(id);
    }, 130);
    return () => clearInterval(id);
  }, [target, tileCount]);

  return shown;
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

function Token({
  player, positions, tracks, offset, isCurrent,
}: {
  player: Player;
  positions: readonly GridPos[];
  tracks: readonly number[];
  offset: readonly [number, number];
  isCurrent: boolean;
}) {
  const shownTile = useWalkedTile(player.tileIndex, positions.length);
  const pos = positions[shownTile];
  if (!pos) return null;
  // Corner tracks are wider than side tracks, so a token's offsets are measured
  // against the size of the track it actually sits in, not one uniform cell.
  const col = trackSpan(tracks, pos.col);
  const row = trackSpan(tracks, pos.row);
  const [nx, ny] = badgeNudge(pos);
  const [dx, dy] = offset;
  return (
    <span
      className={`token${isCurrent ? ' token--turn' : ''}`}
      style={{
        left: `${col.centre + (nx + dx) * col.size}%`,
        top: `${row.centre + (ny + dy) * row.size}%`,
        background: player.color,
      }}
      title={player.name}
    >
      <span className="token__eye" />
      <span className="token__eye" />
    </span>
  );
}

function TokenLayer({
  tracks, positions, players, currentPlayerId,
}: {
  tracks: readonly number[];
  positions: readonly GridPos[];
  players: readonly Player[];
  currentPlayerId: string | undefined;
}) {
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
            positions={positions}
            tracks={tracks}
            offset={tokenOffset(group.indexOf(p), group.length)}
            isCurrent={p.id === currentPlayerId}
          />
        );
      })}
    </div>
  );
}

/** A property tile was clicked: its viewport rect, and the board's middle (inside the ring). */
export type TileClickHandler = (tileIndex: number, rect: DOMRect, middle: DOMRect) => void;

export function Board({
  map, state, events = [], onTileClick,
}: {
  map: GameMap;
  state: GameState;
  events?: readonly GameEvent[];
  /** Absent where the board is scenery (the lobby) and nothing on it should respond. */
  onTileClick?: TileClickHandler;
}) {
  const middleRef = useRef<HTMLDivElement>(null);
  const clickTile = onTileClick && ((tileIndex: number, el: HTMLElement) => {
    const middle = middleRef.current;
    if (middle) onTileClick(tileIndex, el.getBoundingClientRect(), middle.getBoundingClientRect());
  });
  const { side, positions, tracks } = ringLayout(map.tiles.length);
  const template = tracks.map(t => `${t}fr`).join(' ');
  const units = tracks.reduce((a, b) => a + b, 0);
  const { drawnCard, rolling } = useBoardEventEffects(events);
  // One more whole spin per roll; the dice transition to the new rotation and settle.
  const [turns, setTurns] = useState(0);
  useEffect(() => { if (rolling) setTurns(t => t + 1); }, [rolling]);

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
      />
      <div ref={middleRef} className="board__center" style={{ gridRow: `2 / ${side}`, gridColumn: `2 / ${side}` }}>
        <div className="board__center-inner">
          {/* The dice sit centred in the space above the log rather than pinned to the
              top edge. The card popup lives inside the stage (`position: relative`) so it
              covers just that area and leaves the log readable; being absolutely
              positioned with `inset: 0`, it fills the stage rather than shrinking to the dice. */}
          <div className="board__stage">
            {state.lastRoll && (
              <div className="board__dice">
                <Die value={state.lastRoll[0]} turns={turns} />
                <Die value={state.lastRoll[1]} turns={turns} />
              </div>
            )}
            <div className="board__phase">{formatPhase(state.phase)}</div>
            {state.vacationPot > 0 && (
              <div className="board__vacation-pot">Vacation pot: ${state.vacationPot}</div>
            )}
            {drawnCard && <DrawnCardPanel event={drawnCard} players={state.players} />}
          </div>
          <EventLog events={events} players={state.players} map={map} limit={6} />
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
  // A city is identified by its tint and its flag badge, so it skips the generic icon.
  const icon = tile.type === 'city' ? '' : tileIcon(tile);
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
        {icon && <div className="tile__icon">{icon}</div>}
        <div className="tile__text">
          <div className="tile__name">{tile.name}</div>
          {sub && <div className="tile__sub">{sub}</div>}
          {'price' in tile && <div className="tile__price">${tile.price}</div>}
          {(houses > 0 || hotel) && (
            <div className="tile__buildings">{hotel ? '🏨' : '🏠'.repeat(houses)}</div>
          )}
        </div>
      </div>
      {tile.type === 'city' && <div className="tile__flag">{countryFlag(tile.countryId)}</div>}
      {owner && <div className="tile__owner" style={{ background: owner.color }} title={owner.name} />}
    </div>
  );
}
