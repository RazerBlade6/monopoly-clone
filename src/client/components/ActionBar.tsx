import { useState } from 'react';
import type { GameAction, GameMap, GameState, PlayerId } from '../../shared/types';

/**
 * Shows the buttons that make sense for the current phase. This is UI
 * gating only — final legality is always decided by the engine, and an
 * illegal action just comes back as a `ServerMessage` of type `error`.
 *
 * The bankruptcy button is the one exception to "phase decides the
 * buttons": `legalActions` allows `declare_bankruptcy` for any non-bankrupt
 * player in any non-terminal phase, turn or no turn, so it renders once,
 * after the phase-specific branches, instead of being threaded into each.
 */
export function ActionBar({
  map, state, myPlayerId, actingPlayerId, onAction,
}: {
  map: GameMap;
  state: GameState;
  /** This browser's own seat — used only to label a turn taken on a dummy's behalf. */
  myPlayerId: PlayerId;
  /** The seat these buttons act for, which is a dummy of mine whenever the game waits on one. */
  actingPlayerId: PlayerId;
  onAction: (action: GameAction) => void;
}) {
  const me = state.players.find(p => p.id === actingPlayerId);
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const isMyTurn = currentPlayerId === actingPlayerId;

  if (state.phase === 'GAME_OVER') {
    const winnerName = state.players.find(p => p.id === state.winner)?.name ?? 'Someone';
    return <div className="action-bar"><p className="action-bar__over">{winnerName} won the game.</p></div>;
  }

  if (!me || me.bankrupt) {
    return <div className="action-bar" />;
  }

  let phaseContent: React.ReactNode;

  if (state.phase === 'RESOLVING_DEBT' && state.debt) {
    const debt = state.debt;
    const nameOf = (id: PlayerId | null) => (id ? state.players.find(p => p.id === id)?.name ?? 'a player' : 'the bank');
    const total = debt.amount + debt.queued.reduce((sum, q) => sum + q.amount, 0);
    // Only the debtor can end this, so only they get controls; trades stay open to everyone
    // through the player cards.
    phaseContent = debt.debtor !== actingPlayerId
      ? <p className="action-bar__waiting">Waiting for {nameOf(debt.debtor)} to settle a debt…</p>
      : (
        <>
          <p className="action-bar__debt">
            {debt.queued.length === 0
              ? <>You owe ${debt.amount} to {nameOf(debt.creditor)}.</>
              : <>You owe ${total} in total, ${debt.amount} of it to {nameOf(debt.creditor)} first.</>}
            {' '}Sell buildings or trade to raise money, or declare bankruptcy.
          </p>
          <BuildingControls map={map} state={state} myPlayerId={actingPlayerId} onAction={onAction} sellOnly />
        </>
      );
  } else if (!isMyTurn) {
    const currentName = state.players.find(p => p.id === currentPlayerId)?.name ?? '…';
    phaseContent = <p className="action-bar__waiting">Waiting for {currentName}…</p>;
  } else {
    phaseContent = (
      <>
        {state.phase === 'AWAITING_ROLL' && (
          <>
            {me.inJail && (
              <>
                <button className="btn" onClick={() => onAction({ type: 'pay_jail_fee' })}>
                  Pay ${state.settings.jailFee} fee
                </button>
                {me.pardonCards > 0 && (
                  <button className="btn" onClick={() => onAction({ type: 'use_pardon' })}>Use pardon card</button>
                )}
              </>
            )}
            <button className="btn btn--primary" onClick={() => onAction({ type: 'roll' })}>Roll</button>
          </>
        )}
        {state.phase === 'AWAITING_BUY' && (
          <>
            <button className="btn btn--primary" onClick={() => onAction({ type: 'buy' })}>Buy</button>
            <button className="btn" onClick={() => onAction({ type: 'decline_buy' })}>Decline</button>
          </>
        )}
        {(state.phase === 'AWAITING_ROLL' || state.phase === 'AWAITING_END_TURN') && (
          <BuildingControls map={map} state={state} myPlayerId={actingPlayerId} onAction={onAction} />
        )}
        {state.phase === 'AWAITING_END_TURN' && (
          <button className="btn btn--primary" onClick={() => onAction({ type: 'end_turn' })}>End turn</button>
        )}
      </>
    );
  }

  return (
    <div className="action-bar">
      {actingPlayerId !== myPlayerId && (
        <p className="action-bar__acting">Playing as {me.name}</p>
      )}
      {phaseContent}
      <BankruptButton onAction={onAction} />
    </div>
  );
}

/** Two-step inline confirm — irreversible, so one click can't trigger it. The second step
 * says what happens, since every property going back on the market is not obvious. */
function BankruptButton({ onAction }: { onAction: (action: GameAction) => void }) {
  const [confirming, setConfirming] = useState(false);

  function click() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    onAction({ type: 'declare_bankruptcy' });
  }

  return (
    <button
      className="btn btn--danger btn--small"
      onClick={click}
      onBlur={() => setConfirming(false)}
      title="Leave the game. Your properties return to the market and your buildings to the bank."
    >
      {confirming ? 'Sure? Your properties return to the market' : 'Bankrupt'}
    </button>
  );
}

function BuildingControls({
  map, state, myPlayerId, onAction, sellOnly = false,
}: {
  map: GameMap;
  state: GameState;
  myPlayerId: PlayerId;
  onAction: (action: GameAction) => void;
  /** In debt only selling is allowed, so only cities with something to sell are listed. */
  sellOnly?: boolean;
}) {
  const myCities = map.tiles.filter((tile, i) => {
    const o = state.tiles[i];
    return tile.type === 'city' && o?.owner === myPlayerId && (!sellOnly || o.hotel || o.houses > 0);
  });
  if (myCities.length === 0) return null;

  return (
    <div className="building-controls">
      {myCities.map((tile) => {
        const ownership = state.tiles[tile.index];
        if (!ownership || tile.type !== 'city') return null;
        return (
          <div key={tile.index} className="building-controls__row">
            <span className="building-controls__name">{tile.name}</span>
            {ownership.hotel ? (
              <button className="btn btn--small" onClick={() => onAction({ type: 'sell_hotel', tileIndex: tile.index })}>
                Sell hotel
              </button>
            ) : (
              <>
                {!sellOnly && (
                  <button className="btn btn--small" onClick={() => onAction({ type: 'buy_house', tileIndex: tile.index })}>
                    +House
                  </button>
                )}
                {ownership.houses > 0 && (
                  <button className="btn btn--small" onClick={() => onAction({ type: 'sell_house', tileIndex: tile.index })}>
                    -House
                  </button>
                )}
                {!sellOnly && ownership.houses === 4 && (
                  <button className="btn btn--small" onClick={() => onAction({ type: 'buy_hotel', tileIndex: tile.index })}>
                    +Hotel
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
