import { useState } from 'react';
import type { GameAction, GameMap, GameState, PlayerId } from '../../shared/types';
import { phaseAfterLanding } from '../../engine/debt';

/**
 * The turn's buttons, shown in the middle of the board the way richup does it: one primary
 * button whose label says what it does ("Roll the dice", "Buy for $N", "End turn"), and the
 * alternative beside it. This is UI gating only — final legality is always decided by the
 * engine, and an illegal action just comes back as a `ServerMessage` of type `error`.
 *
 * There is no decline button. Not buying is just carrying on: "End turn", or "Roll again"
 * after doubles, both pass on the property (see `passOnPurchase` in the reducer).
 */
export function ActionBar({
  map, state, myPlayerId, actingPlayerId, onAction, busy = false,
}: {
  map: GameMap;
  state: GameState;
  /** This browser's own seat — used only to label a turn taken on a dummy's behalf. */
  myPlayerId: PlayerId;
  /** The seat these buttons act for, which is a dummy of mine whenever the game waits on one. */
  actingPlayerId: PlayerId;
  onAction: (action: GameAction) => void;
  /** The board is still playing the last update. The buttons hold until it has shown the
   * result they belong to; `state` is the shown one, so they would otherwise offer the
   * turn as it stood before the dice landed. */
  busy?: boolean;
}) {
  const me = state.players.find(p => p.id === actingPlayerId);
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const isMyTurn = currentPlayerId === actingPlayerId;

  if (state.phase === 'GAME_OVER') {
    const winnerName = state.players.find(p => p.id === state.winner)?.name ?? 'Someone';
    return <div className="action-bar"><p className="action-bar__over">{winnerName} won the game.</p></div>;
  }

  if (!me || me.bankrupt) {
    return null;
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
        <p className="action-bar__debt">
          {debt.queued.length === 0
            ? <>You owe ${debt.amount} to {nameOf(debt.creditor)}.</>
            : <>You owe ${total} in total, ${debt.amount} of it to {nameOf(debt.creditor)} first.</>}
          {' '}Sell buildings or properties from your property list, trade, or declare bankruptcy.
        </p>
      );
  } else if (!isMyTurn) {
    const currentName = state.players.find(p => p.id === currentPlayerId)?.name ?? '…';
    phaseContent = <p className="action-bar__waiting">Waiting for {currentName}…</p>;
  } else {
    // Doubles leave the count above zero until the turn ends, so this is "after doubles".
    const rollLabel = state.doublesCount > 0 ? 'Roll again' : 'Roll the dice';
    const tile = map.tiles[me.tileIndex];
    const price = tile && 'price' in tile ? tile.price : 0;
    const short = me.cash < price;
    // Passing on the property is whatever the turn would do next had there been no offer.
    const rollsAgain = phaseAfterLanding(state) === 'AWAITING_ROLL';
    phaseContent = (
      <fieldset className="action-bar__buttons" disabled={busy}>
        {state.phase === 'AWAITING_ROLL' && (
          <>
            <button className="btn btn--primary btn--turn" onClick={() => onAction({ type: 'roll' })}>{rollLabel}</button>
            {me.inJail && (
              <>
                <button
                  className="btn btn--turn" onClick={() => onAction({ type: 'pay_jail_fee' })}
                  disabled={me.cash < state.settings.jailFee}
                >
                  Get out for ${state.settings.jailFee}
                </button>
                {me.pardonCards > 0 && (
                  <button className="btn btn--turn" onClick={() => onAction({ type: 'use_pardon' })}>Use pardon card</button>
                )}
              </>
            )}
          </>
        )}
        {state.phase === 'AWAITING_BUY' && (
          <>
            <button
              className="btn btn--primary btn--turn" onClick={() => onAction({ type: 'buy' })}
              disabled={short} title={short ? "You don't have enough money to pay for it." : undefined}
            >
              Buy for ${price}
            </button>
            <button className="btn btn--turn" onClick={() => onAction({ type: rollsAgain ? 'roll' : 'end_turn' })}>
              {rollsAgain ? 'Roll again' : 'End turn'}
            </button>
          </>
        )}
        {state.phase === 'AWAITING_END_TURN' && (
          <button className="btn btn--primary btn--turn" onClick={() => onAction({ type: 'end_turn' })}>End turn</button>
        )}
      </fieldset>
    );
  }

  return (
    <div className="action-bar">
      {actingPlayerId !== myPlayerId && (
        <p className="action-bar__acting">Playing as {me.name}</p>
      )}
      {phaseContent}
    </div>
  );
}

/** Two-step inline confirm — irreversible, so one click can't trigger it. The second step
 * says what happens, since every property going back on the market is not obvious. */
export function BankruptButton({ onAction }: { onAction: (action: GameAction) => void }) {
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
