import type { Card, GameEvent, GameMap, Player, PlayerId, Trade, TradeSide } from '../../shared/types';
import { getCard } from '../../data/cards';

function nameOf(players: readonly Player[], id: PlayerId | null): string {
  if (!id) return 'the bank';
  return players.find(p => p.id === id)?.name ?? 'a player';
}

/** `getCard` throws on an id it doesn't recognise — some fixture decks carry
 * placeholder ids, so both the log and the board-centre popup go through
 * this instead of calling it directly. */
export function getCardSafe(cardId: string): Card | null {
  try {
    return getCard(cardId);
  } catch {
    return null;
  }
}

function describeSide(side: TradeSide, map: GameMap | undefined): string {
  const parts = side.tiles.map(i => map?.tiles[i]?.name ?? `tile ${i}`);
  if (side.cash > 0) parts.push(`$${side.cash}`);
  if (side.pardonCards > 0) parts.push(`${side.pardonCards} pardon card${side.pardonCards === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' + ') : 'nothing';
}

/**
 * One line per event, or null for the few that would only repeat a neighbouring line (a
 * countered trade is reported by the counter itself, and a bankrupt player's trades by the
 * bankruptcy). `trades` maps a trade id to the trade as proposed, so a cancellation, which
 * carries only the id, can still say whose trade it was.
 */
function formatEvent(
  event: GameEvent,
  players: readonly Player[],
  map: GameMap | undefined,
  trades: ReadonlyMap<string, Trade>,
): string | null {
  switch (event.type) {
    case 'game_started':
      return 'The game has started.';
    case 'rolled':
      return `${nameOf(players, event.playerId)} rolled ${event.dice[0]} + ${event.dice[1]}${event.isDouble ? ' (doubles!)' : ''}.`;
    case 'moved':
      return `${nameOf(players, event.playerId)} moved to tile ${event.to}${event.passedStart ? ', passing START' : ''}.`;
    case 'paid':
      return `${nameOf(players, event.from)} paid $${event.amount} to ${nameOf(players, event.to)} (${event.reason}).`;
    case 'bought':
      return `${nameOf(players, event.playerId)} bought tile ${event.tileIndex} for $${event.price}.`;
    case 'built':
      return `${nameOf(players, event.playerId)} built on tile ${event.tileIndex} (${event.hotel ? 'hotel' : `${event.houses} house(s)`}).`;
    case 'property_sold':
      return `${nameOf(players, event.playerId)} sold ${map?.tiles[event.tileIndex]?.name ?? `tile ${event.tileIndex}`} to the bank for $${event.amount}.`;
    case 'card_drawn': {
      const card = getCardSafe(event.cardId);
      return card
        ? `${nameOf(players, event.playerId)} drew a ${event.deck} card: "${card.text}"`
        : `${nameOf(players, event.playerId)} drew a ${event.deck} card.`;
    }
    case 'jailed':
      return `${nameOf(players, event.playerId)} was sent to prison (${event.reason}).`;
    case 'left_jail':
      return `${nameOf(players, event.playerId)} left prison (${event.how}).`;
    case 'debt_opened':
      return `${nameOf(players, event.debt.debtor)} owes $${event.debt.amount} to ${nameOf(players, event.debt.creditor)}.`;
    case 'debt_cleared':
      return `${nameOf(players, event.playerId)} cleared their debt.`;
    case 'bankrupt':
      return `${nameOf(players, event.playerId)} went bankrupt.`;
    case 'turn_skipped':
      return `${nameOf(players, event.playerId)} is on vacation and skips this turn.`;
    case 'turn_ended':
      return `Turn passed to ${nameOf(players, event.nextPlayerId)}.`;
    case 'game_over':
      return `${nameOf(players, event.winner)} won the game!`;
    case 'trade_proposed': {
      const { from, to } = event.trade;
      return event.counterOf
        ? `${nameOf(players, from)} countered ${nameOf(players, to)}'s trade.`
        : `${nameOf(players, from)} offered ${nameOf(players, to)} a trade.`;
    }
    case 'trade_accepted': {
      const { from, to, offer, request } = event.trade;
      const fromName = nameOf(players, from);
      const toName = nameOf(players, to);
      return `${toName} accepted ${fromName}'s trade: ${fromName} gave ${describeSide(offer, map)} · ${toName} gave ${describeSide(request, map)}.`;
    }
    case 'trade_declined':
      return `${nameOf(players, event.to)} declined ${nameOf(players, event.from)}'s trade.`;
    case 'trade_cancelled': {
      const trade = trades.get(event.tradeId);
      if (event.reason === 'withdrawn') {
        return trade ? `${nameOf(players, trade.from)} withdrew a trade.` : 'A trade was withdrawn.';
      }
      if (event.reason === 'invalid') {
        return trade
          ? `${nameOf(players, trade.from)}'s trade to ${nameOf(players, trade.to)} no longer works and was dropped.`
          : 'A trade no longer works and was dropped.';
      }
      return null;
    }
  }
}

export function EventLog({
  events, players, map, limit = 100,
}: {
  events: readonly GameEvent[];
  players: readonly Player[];
  /** For property names in trade lines; without it they read as tile numbers. */
  map?: GameMap;
  /** How many of the most recent entries to render. The board's centre shows only a
   * handful, big enough to read across the table, rather than a scrollable wall. */
  limit?: number;
}) {
  const trades = new Map<string, Trade>();
  for (const e of events) if (e.type === 'trade_proposed') trades.set(e.trade.id, e.trade);
  const recent = events
    .map(e => formatEvent(e, players, map, trades))
    .filter((line): line is string => line !== null)
    .slice(-limit)
    .reverse();
  return (
    <div className="event-log">
      <h3 className="event-log__title">Log</h3>
      <ul className="event-log__list">
        {recent.map((line, i) => (
          <li key={i} className="event-log__item">{line}</li>
        ))}
        {recent.length === 0 && <li className="event-log__empty">Nothing has happened yet.</li>}
      </ul>
    </div>
  );
}
