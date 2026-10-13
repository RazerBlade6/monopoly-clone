import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameAction, GameMap, GameState, PlayerId, Tile } from '../../shared/types';
import { legalActions } from '../../engine/legal';
import {
  countAirports, countCompanies, groupTiles, hotelSaleValue, houseSaleValue, ownsWholeGroup,
} from '../../engine/state';
import { controls } from '../acting';
import { assetBlockedReason, type AssetAction } from '../assetGate';
import { countryColor, displayName } from '../colors';
import { TileBadge } from './TileBadge';

type CityTile = Extract<Tile, { type: 'city' }>;

interface RentRow {
  label: string;
  value: string;
}

/**
 * A deed-style card for one property, owned or not: a property on the market shows its
 * price and the rents it would charge. Build buttons appear only when the owner is a seat
 * this tab drives, and act as that seat; each is enabled only when the engine's
 * `legalActions` lists that exact action.
 */
export function PropertyCard({
  map, state, tileIndex, anchor, within, myPlayerId, error, onAction, onClose,
}: {
  map: GameMap;
  state: GameState;
  tileIndex: number;
  /** The clicked row's or tile's viewport rect; the card is placed beside it. */
  anchor: DOMRect;
  /**
   * A viewport region the card should open into instead of its default left-of-the-row
   * placement. A board tile passes the board's middle, inside the ring of tiles, so the card
   * lands there rather than over the rails or across the tiles of another run.
   */
  within?: DOMRect;
  myPlayerId: PlayerId;
  /** The latest server refusal, shown inside the card so it isn't lost off-screen. */
  error: string | null;
  onAction: (action: GameAction, as: PlayerId) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measured after render, and again whenever the content (and so the size) changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 10;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (within) {
      // Off whichever side of the tile faces the region's centre, centred on the tile along
      // the other axis — below a top-run tile, beside a left-run one — then held inside the
      // region, so a tile near a corner doesn't push the card over the neighbouring run.
      const cx = anchor.left + anchor.width / 2;
      const cy = anchor.top + anchor.height / 2;
      const dx = within.left + within.width / 2 - cx;
      const dy = within.top + within.height / 2 - cy;
      if (Math.abs(dy) > Math.abs(dx)) {
        left = cx - width / 2;
        top = dy > 0 ? anchor.bottom + gap : anchor.top - gap - height;
      } else {
        left = dx > 0 ? anchor.right + gap : anchor.left - gap - width;
        top = cy - height / 2;
      }
      left = Math.max(within.left, Math.min(left, within.right - width));
      top = Math.max(within.top, Math.min(top, within.bottom - height));
    } else {
      // Left of the row, since the list lives in the right rail; the right side only if the left has no room.
      left = anchor.left - gap - width;
      if (left < margin) left = Math.min(anchor.right + gap, vw - width - margin);
      top = anchor.top;
    }
    left = Math.max(margin, Math.min(left, vw - width - margin));
    top = Math.max(margin, Math.min(top, vh - height - margin));
    setPos(prev => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  });

  useLayoutEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // pointerdown, not a click-catcher element: the click still reaches whatever is underneath,
    // so clicking another row opens that row's card in one go.
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const tile = map.tiles[tileIndex];
  const ownership = state.tiles[tileIndex];
  // Absent for a property still on the market, or one sold back or freed by a bankruptcy
  // while the card is open — the card then simply shows it as for sale.
  const owner = state.players.find(p => p.id === ownership?.owner);

  if (!tile || !ownership || (tile.type !== 'city' && tile.type !== 'airport' && tile.type !== 'company')) {
    return null;
  }

  const headerColor = tile.type === 'city' ? countryColor(tile.countryId) : '#5d5876';

  let rows: RentRow[];
  let current: number;
  if (tile.type === 'city') {
    const base = tile.rents[0];
    rows = [
      { label: 'Rent', value: `$${base}` },
      { label: 'Rent with full set', value: `$${state.settings.doubleRentOnFullSet ? base * 2 : base}` },
      ...[1, 2, 3, 4].map(n => ({ label: `Rent with ${n} ${n === 1 ? 'house' : 'houses'}`, value: `$${tile.rents[n]}` })),
      { label: 'Rent with hotel', value: `$${tile.rents[5]}` },
    ];
    current = !owner ? -1
      : ownership.hotel ? 6
      : ownership.houses > 0 ? ownership.houses + 1
      : ownsWholeGroup(map, state, owner.id, tile.countryId) ? 1
      : 0;
  } else if (tile.type === 'airport') {
    const onMap = map.tiles.filter(t => t.type === 'airport').length;
    rows = tile.rents.slice(0, Math.max(1, onMap)).map((rent, i) => ({
      label: `Rent with ${i + 1} ${i === 0 ? 'airport' : 'airports'}`, value: `$${rent}`,
    }));
    current = owner ? countAirports(map, state, owner.id) - 1 : -1;
  } else {
    const onMap = map.tiles.filter(t => t.type === 'company').length;
    rows = state.settings.companyRentMultipliers.slice(0, Math.max(1, onMap)).map((m, i) => ({
      label: `Owning ${i + 1} ${i === 0 ? 'company' : 'companies'}`, value: `${m}× dice total`,
    }));
    current = owner ? countCompanies(map, state, owner.id) - 1 : -1;
  }

  const seat = owner && controls(state, myPlayerId, owner.id) ? owner.id : null;

  return (
    <div
      ref={ref} className="deed" role="dialog" aria-labelledby="deed-title" tabIndex={-1}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="deed__header" style={{ background: headerColor }}>
        <button className="deed__close" onClick={onClose} aria-label="Close">✕</button>
        <TileBadge tile={tile} className="deed__badge" />
        <h2 id="deed-title" className="deed__name">{tile.name}</h2>
        {tile.type === 'city' && <span className="deed__country">{displayName(tile.countryId)}</span>}
      </div>
      <div className="deed__owner">
        {owner
          ? <><span className="trade-col__dot" style={{ background: owner.color }} />Owned by {owner.name}</>
          : <>For sale · ${tile.price}</>}
      </div>
      <ul className="deed__rents">
        {rows.map((row, i) => (
          <li key={row.label} className={`deed__rent${i === current ? ' deed__rent--current' : ''}`}>
            <span>{row.label}</span>
            <span className="deed__value">{row.value}</span>
          </li>
        ))}
      </ul>
      {tile.type === 'city' && seat && (
        <BuildControls map={map} state={state} tile={tile} seat={seat} onAction={onAction} />
      )}
      {tile.type === 'city' && !state.settings.unlimitedBuildings && (
        <p className="deed__bank">Bank: {state.bank.houses} houses · {state.bank.hotels} hotels</p>
      )}
      {error && <p className="trade-modal__error deed__error" role="alert">{error}</p>}
    </div>
  );
}

function BuildControls({
  map, state, tile, seat, onAction,
}: {
  map: GameMap;
  state: GameState;
  tile: CityTile;
  seat: PlayerId;
  onAction: (action: GameAction, as: PlayerId) => void;
}) {
  const own = state.tiles[tile.index]!;
  const legal = legalActions(map, state, seat);

  const upgrade: AssetAction | null = own.hotel ? null
    : own.houses < 4 ? { type: 'buy_house', tileIndex: tile.index }
    : { type: 'buy_hotel', tileIndex: tile.index };
  const upgradeCaption = !upgrade ? 'Max level'
    : upgrade.type === 'buy_house' ? `Cost $${tile.housePrice}` : `Cost $${tile.hotelPrice}`;

  const downgrade: AssetAction | null = own.hotel ? { type: 'sell_hotel', tileIndex: tile.index }
    : own.houses > 0 ? { type: 'sell_house', tileIndex: tile.index }
    : null;
  let downgradeCaption = 'Nothing built';
  if (downgrade?.type === 'sell_house') downgradeCaption = `Payout $${houseSaleValue(tile)}`;
  if (downgrade?.type === 'sell_hotel') {
    // Without 4 spare houses the engine can't break one hotel, so it sells every hotel in the
    // set at once (SPEC decision 17). The caption says so rather than understating the payout.
    const breaksSingle = state.settings.unlimitedBuildings || state.bank.houses >= 4;
    if (breaksSingle) {
      downgradeCaption = `Payout $${hotelSaleValue(tile)}`;
    } else {
      const hotels = groupTiles(map, tile.countryId)
        .filter((t): t is CityTile => t.type === 'city' && state.tiles[t.index]!.owner === seat && state.tiles[t.index]!.hotel);
      downgradeCaption = `Payout $${hotels.reduce((sum, t) => sum + hotelSaleValue(t), 0)}, every hotel in the set`;
    }
  }

  const upgradeBlocked = upgrade ? assetBlockedReason(map, state, seat, legal, upgrade) : 'Already at the highest level';
  const downgradeBlocked = downgrade ? assetBlockedReason(map, state, seat, legal, downgrade) : 'Nothing built here to sell';

  return (
    <div className="deed__actions">
      <DeedButton
        label="Upgrade" caption={upgradeCaption} blocked={upgradeBlocked}
        onClick={() => upgrade && onAction(upgrade, seat)}
      />
      <DeedButton
        label="Downgrade" caption={downgradeCaption} blocked={downgradeBlocked}
        onClick={() => downgrade && onAction(downgrade, seat)}
      />
    </div>
  );
}

function DeedButton({
  label, caption, blocked, onClick,
}: {
  label: string;
  caption: string;
  blocked: string | null;
  onClick: () => void;
}) {
  return (
    <div className="deed__action">
      {/* The tooltip sits on a wrapper because some browsers show none for a disabled button. */}
      <span title={blocked ?? undefined}>
        <button className="btn btn--small deed__button" onClick={onClick} disabled={blocked !== null}>{label}</button>
      </span>
      <span className="deed__caption">{caption}</span>
    </div>
  );
}
