import type { GameState, PlayerId } from '../../shared/types';
import { controls } from '../acting';

/**
 * Pending trades that involve any seat this tab drives. A trade between two of my own seats
 * is listed once, as incoming, since answering it is the thing waiting to be done.
 */
export function TradesPanel({
  state, myPlayerId, onView, onNewTrade, canPickPartner,
}: {
  state: GameState;
  myPlayerId: PlayerId;
  onView: (self: PlayerId, tradeId: string) => void;
  /** Absent when the acting seat can't trade at all, which hides the button. */
  onNewTrade?: () => void;
  canPickPartner: boolean;
}) {
  const nameOf = (id: PlayerId) => state.players.find(p => p.id === id)?.name ?? 'a player';
  const rows = state.trades.flatMap(trade => {
    if (controls(state, myPlayerId, trade.to)) return [{ trade, self: trade.to, incoming: true }];
    if (controls(state, myPlayerId, trade.from)) return [{ trade, self: trade.from, incoming: false }];
    return [];
  });
  if (rows.length === 0 && !onNewTrade) return null;

  return (
    <div className="panel trades-panel">
      <div className="trades-panel__head">
        <div className="panel__title">Trades</div>
        {onNewTrade && (
          // The tooltip sits on a wrapper because some browsers show none for a disabled button.
          <span title={canPickPartner ? 'Propose a trade' : 'There is no one to trade with'}>
            <button className="btn btn--small" onClick={onNewTrade} disabled={!canPickPartner}>Trade</button>
          </span>
        )}
      </div>
      {rows.length > 0 && <ul className="trades-panel__list">
        {rows.map(({ trade, self, incoming }) => {
          // Name the seat whenever it isn't mine, so a dummy's trade can't be mistaken for my own.
          const forSeat = self === myPlayerId ? '' : `${nameOf(self)}: `;
          return (
            <li key={trade.id} className={`trades-panel__row${incoming ? ' trades-panel__row--incoming' : ''}`}>
              <span className="trades-panel__text">
                {incoming
                  ? `${forSeat}${nameOf(trade.from)} sent you a trade`
                  : `${forSeat}Waiting for ${nameOf(trade.to)}`}
              </span>
              <button className="btn btn--small" onClick={() => onView(self, trade.id)}>View</button>
            </li>
          );
        })}
      </ul>}
    </div>
  );
}
