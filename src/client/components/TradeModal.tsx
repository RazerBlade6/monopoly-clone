import { useEffect, useState } from 'react';
import type { GameAction, GameMap, GameState, OwnableTile, Player, PlayerId, TradeSide } from '../../shared/types';
import { TRADE_SEND_LIMIT } from '../../engine/trades';
import { TileBadge } from './TileBadge';

/**
 * `self` is the seat this tab is trading as: its own, or one of its dummies. The left column
 * is always `self`, the right always the other party, whichever of them proposed.
 */
export type TradeModalMode =
  | { kind: 'pick'; self: PlayerId }
  | {
      kind: 'create'; self: PlayerId; partner: PlayerId; counterOf?: string; mine?: TradeSide; theirs?: TradeSide;
      /** Reached from the player picker, so the modal offers a way back to it. */
      fromPicker?: boolean;
    }
  | { kind: 'view'; self: PlayerId; tradeId: string };

const EMPTY: TradeSide = { cash: 0, tiles: [], pardonCards: 0 };

function isEmpty(side: TradeSide): boolean {
  return side.cash === 0 && side.tiles.length === 0 && side.pardonCards === 0;
}

function isOwnable(tile: GameMap['tiles'][number]): tile is OwnableTile {
  return tile.type === 'city' || tile.type === 'airport' || tile.type === 'company';
}

/** The engine refuses a city while anything stands in its country, so the row says so first. */
function groupHasBuildings(map: GameMap, state: GameState, tile: OwnableTile): boolean {
  if (tile.type !== 'city') return false;
  return map.tiles.some(t => {
    if (t.type !== 'city' || t.countryId !== tile.countryId) return false;
    const o = state.tiles[t.index];
    return !!o && (o.hotel || o.houses > 0);
  });
}

function sideValue(map: GameMap, state: GameState, side: TradeSide): number {
  let value = side.cash + side.pardonCards * state.settings.jailFee;
  for (const i of side.tiles) {
    const tile = map.tiles[i];
    if (tile && isOwnable(tile)) value += tile.price;
  }
  return value;
}

/** Drops anything the board has since taken out of reach, so a stale draft isn't refused whole. */
function sanitize(map: GameMap, state: GameState, owner: Player, side: TradeSide): TradeSide {
  return {
    cash: Math.min(side.cash, Math.max(0, owner.cash)),
    tiles: side.tiles.filter(i => state.tiles[i]?.owner === owner.id),
    pardonCards: Math.min(side.pardonCards, owner.pardonCards),
  };
}

/** UI gating only, mirroring the engine's refusals so a row explains itself. */
function tradeBlocked(state: GameState, selfId: PlayerId, partner: Player): string | null {
  if (state.trades.some(t => t.from === selfId && t.to === partner.id)) {
    return `You already have a trade waiting with ${partner.name}`;
  }
  if ((state.tradeSendCounts[`${selfId}>${partner.id}`] ?? 0) >= TRADE_SEND_LIMIT) {
    return `You've sent ${TRADE_SEND_LIMIT} trades to ${partner.name} this turn. Try again next turn.`;
  }
  return null;
}

function tradeNumber(id: string): number {
  return Number(id.replace('trade-', ''));
}

export function TradeModal({
  map, state, mode, error, onAction, onModeChange, onClose,
}: {
  map: GameMap;
  state: GameState;
  mode: TradeModalMode;
  /** The latest server refusal. Shown inside the modal so it isn't lost behind the backdrop. */
  error: string | null;
  onAction: (action: GameAction, as: PlayerId) => void;
  onModeChange: (mode: TradeModalMode) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trade = mode.kind === 'view' ? state.trades.find(t => t.id === mode.tradeId) : undefined;
  // Accepted, declined, withdrawn or dropped: whatever happened, there is nothing left to show.
  const gone = mode.kind === 'view' && !trade;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);

  const selfPlayer = state.players.find(p => p.id === mode.self);
  const partnerId = mode.kind === 'create' ? mode.partner : mode.kind === 'view' && trade ? (trade.from === mode.self ? trade.to : trade.from) : null;
  const partner = state.players.find(p => p.id === partnerId);
  if (!selfPlayer || (mode.kind !== 'pick' && !partner)) return null;

  return (
    <div className="trade-backdrop">
      <div className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-modal-title">
        <button className="trade-modal__close" onClick={onClose} aria-label="Close">✕</button>
        {mode.kind === 'pick' ? (
          <PickPartner
            state={state} self={selfPlayer}
            onPick={partnerId => onModeChange({ kind: 'create', self: mode.self, partner: partnerId, fromPicker: true })}
          />
        ) : mode.kind === 'create' && partner ? (
          <>
            {mode.fromPicker && (
              <button
                className="btn btn--small trade-modal__back"
                onClick={() => onModeChange({ kind: 'pick', self: mode.self })}
              >
                ← Back
              </button>
            )}
            <CreateTrade
              map={map} state={state} mode={mode} self={selfPlayer} partner={partner}
              error={error} onAction={onAction} onClose={onClose}
            />
          </>
        ) : trade && partner ? (
          <ViewTrade
            map={map} state={state} self={selfPlayer} partner={partner}
            incoming={trade.to === mode.self}
            mine={trade.from === mode.self ? trade.offer : trade.request}
            theirs={trade.from === mode.self ? trade.request : trade.offer}
            error={error}
            onAccept={() => onAction({ type: 'accept_trade', tradeId: trade.id }, mode.self)}
            onDecline={() => onAction({ type: 'decline_trade', tradeId: trade.id }, mode.self)}
            onCancel={() => onAction({ type: 'cancel_trade', tradeId: trade.id }, mode.self)}
            // Countering is seen from my side: what they offered me sits in their column.
            onNegotiate={() => onModeChange({
              kind: 'create', self: mode.self, partner: trade.from, counterOf: trade.id,
              mine: trade.request, theirs: trade.offer,
            })}
          />
        ) : null}
      </div>
    </div>
  );
}

function PickPartner({
  state, self, onPick,
}: {
  state: GameState;
  self: Player;
  onPick: (partner: PlayerId) => void;
}) {
  const others = state.players.filter(p => p.id !== self.id && !p.bankrupt);
  return (
    <>
      <h2 id="trade-modal-title" className="trade-modal__title">Trade with…</h2>
      <div className="trade-picker">
        {others.map(p => {
          const blocked = tradeBlocked(state, self.id, p);
          return (
            <button
              key={p.id}
              type="button"
              className="trade-tile"
              onClick={() => onPick(p.id)}
              disabled={blocked !== null}
              title={blocked ?? `Propose a trade to ${p.name}`}
            >
              <span className="trade-col__dot" style={{ background: p.color }} />
              <span className="trade-tile__text">
                <span className="trade-tile__name">
                  {p.name}
                  {p.dummyOf && <span className="trade-tile__bot"> bot</span>}
                </span>
                {blocked && <span className="trade-tile__reason">{blocked}</span>}
              </span>
              <span className={`trade-tile__price${p.cash < 0 ? ' trade-tile__price--negative' : ''}`}>
                {p.cash < 0 ? `-$${-p.cash}` : `$${p.cash}`}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function CreateTrade({
  map, state, mode, self, partner, error, onAction, onClose,
}: {
  map: GameMap;
  state: GameState;
  mode: Extract<TradeModalMode, { kind: 'create' }>;
  self: Player;
  partner: Player;
  error: string | null;
  onAction: (action: GameAction, as: PlayerId) => void;
  onClose: () => void;
}) {
  const [mine, setMine] = useState<TradeSide>(mode.mine ?? EMPTY);
  const [theirs, setTheirs] = useState<TradeSide>(mode.theirs ?? EMPTY);
  // The id the trade will get if the engine takes it. The modal closes when a trade from
  // this seat to this partner with at least that id shows up, and stays open on a refusal.
  const [sentAt, setSentAt] = useState<number | null>(null);

  useEffect(() => {
    if (sentAt === null) return;
    if (error) {
      setSentAt(null);
      return;
    }
    const arrived = state.trades.some(t => t.from === self.id && t.to === partner.id && tradeNumber(t.id) >= sentAt);
    if (arrived) onClose();
  }, [sentAt, error, state.trades, self.id, partner.id, onClose]);

  function send() {
    const offer = sanitize(map, state, self, mine);
    const request = sanitize(map, state, partner, theirs);
    setMine(offer);
    setTheirs(request);
    setSentAt(state.nextTradeId);
    onAction(
      mode.counterOf
        ? { type: 'propose_trade', to: partner.id, offer, request, counterOf: mode.counterOf }
        : { type: 'propose_trade', to: partner.id, offer, request },
      self.id,
    );
  }

  return (
    <>
      <h2 id="trade-modal-title" className="trade-modal__title">
        {mode.counterOf ? 'Counter-offer' : 'Create a trade'}
      </h2>
      <div className="trade-modal__columns">
        <TradeColumn map={map} state={state} player={self} side={mine} onChange={setMine} />
        <div className="trade-modal__divider" aria-hidden="true">↔</div>
        <TradeColumn map={map} state={state} player={partner} side={theirs} onChange={setTheirs} />
      </div>
      {error && <p className="trade-modal__error" role="alert">{error}</p>}
      <div className="trade-modal__footer">
        <button
          className="btn btn--primary trade-modal__send"
          onClick={send}
          disabled={isEmpty(mine) && isEmpty(theirs)}
        >
          Send trade
        </button>
      </div>
    </>
  );
}

function ViewTrade({
  map, state, self, partner, incoming, mine, theirs, error,
  onAccept, onDecline, onCancel, onNegotiate,
}: {
  map: GameMap;
  state: GameState;
  self: Player;
  partner: Player;
  incoming: boolean;
  mine: TradeSide;
  theirs: TradeSide;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onNegotiate: () => void;
}) {
  return (
    <>
      <h2 id="trade-modal-title" className="trade-modal__title">
        {incoming ? `${partner.name} sent you a trade` : `Waiting for ${partner.name}`}
      </h2>
      <div className="trade-modal__columns">
        <TradeColumn map={map} state={state} player={self} side={mine} />
        <div className="trade-modal__divider" aria-hidden="true">↔</div>
        <TradeColumn map={map} state={state} player={partner} side={theirs} />
      </div>
      {error && <p className="trade-modal__error" role="alert">{error}</p>}
      <div className="trade-modal__footer">
        {incoming ? (
          <>
            <button className="btn" onClick={onDecline}>Decline</button>
            <button className="btn" onClick={onNegotiate}>Negotiate</button>
            <button className="btn btn--primary trade-modal__send" onClick={onAccept}>Accept</button>
          </>
        ) : (
          <button className="btn btn--danger" onClick={onCancel}>Cancel trade</button>
        )}
      </div>
    </>
  );
}

/** One party's half of the trade. Without `onChange` it is read-only and lists only what is in it. */
function TradeColumn({
  map, state, player, side, onChange,
}: {
  map: GameMap;
  state: GameState;
  player: Player;
  side: TradeSide;
  onChange?: (side: TradeSide) => void;
}) {
  const editable = !!onChange;
  const maxCash = Math.max(0, player.cash);
  const tiles = map.tiles.filter(isOwnable).filter(t =>
    editable ? state.tiles[t.index]?.owner === player.id : side.tiles.includes(t.index));
  const showPardons = editable ? player.pardonCards > 0 : side.pardonCards > 0;

  function toggle(index: number) {
    if (!onChange) return;
    onChange({
      ...side,
      tiles: side.tiles.includes(index) ? side.tiles.filter(i => i !== index) : [...side.tiles, index],
    });
  }

  return (
    <div className="trade-col">
      <div className="trade-col__head">
        <span className="trade-col__dot" style={{ background: player.color }} />
        <span className="trade-col__name">{player.name}</span>
      </div>

      {editable ? (
        <div className="trade-col__cash">
          <input
            type="range" min={0} max={maxCash} step={1}
            value={Math.min(side.cash, maxCash)}
            disabled={maxCash === 0}
            onChange={e => onChange({ ...side, cash: Number(e.target.value) })}
            aria-label={`Cash from ${player.name}`}
          />
          <div className="trade-col__range">
            <span>0</span>
            <span className="trade-col__chip">{side.cash} $</span>
            <span>{maxCash}</span>
          </div>
        </div>
      ) : (
        side.cash > 0 && <div className="trade-col__range trade-col__range--fixed"><span className="trade-col__chip">{side.cash} $</span></div>
      )}

      <div className="trade-col__tiles">
        {tiles.map(tile => {
          const selected = side.tiles.includes(tile.index);
          const built = editable && groupHasBuildings(map, state, tile);
          return (
            <button
              key={tile.index}
              type="button"
              className={`trade-tile${selected ? ' trade-tile--selected' : ''}`}
              onClick={() => toggle(tile.index)}
              disabled={!editable || built}
              title={built ? 'Sell the buildings in this country before trading it' : tile.name}
            >
              <TileBadge tile={tile} className="trade-tile__badge" />
              <span className="trade-tile__name">{tile.name}</span>
              <span className="trade-tile__price">${tile.price}</span>
            </button>
          );
        })}
        {editable
          ? tiles.length === 0 && <p className="trade-col__empty">No properties</p>
          : isEmpty(side) && <p className="trade-col__empty">Nothing</p>}
      </div>

      {showPardons && (
        <div className="trade-pardon">
          <span className="trade-pardon__label">Pardon card · ${state.settings.jailFee} each</span>
          {editable ? (
            <span className="trade-pardon__counter">
              <button
                type="button" className="btn btn--small"
                onClick={() => onChange({ ...side, pardonCards: side.pardonCards - 1 })}
                disabled={side.pardonCards <= 0}
                aria-label="One fewer pardon card"
              >−</button>
              <span>{side.pardonCards}</span>
              <button
                type="button" className="btn btn--small"
                onClick={() => onChange({ ...side, pardonCards: side.pardonCards + 1 })}
                disabled={side.pardonCards >= player.pardonCards}
                aria-label="One more pardon card"
              >+</button>
            </span>
          ) : (
            <span>× {side.pardonCards}</span>
          )}
        </div>
      )}

      <div className="trade-col__total">Total value: ${sideValue(map, state, side)}</div>
    </div>
  );
}
