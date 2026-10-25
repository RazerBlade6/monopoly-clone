/**
 * RESOLVING_DEBT: blocking phase, one active Debt at a time (docs/ENGINE.md decisions 4–6, 13).
 *
 * A charge the player can't cover takes everything they hold at once and leaves their
 * balance negative by the remainder, so while in debt `cash === -(amount + queued)`. From
 * then on every dollar they receive goes straight to their creditors in queue order
 * (`payDebtFromIncome`) until the balance is back at 0. There is no auto-bankruptcy: a
 * hopeless debtor declares it themselves.
 *
 * Every Debt-creating path in this engine has debtor === the current player
 * (rent/tax/card charges and money_from_each all fire during that player's
 * own landing resolution) — openDebt asserts this so a future path that
 * violates it fails loudly instead of quietly letting a non-debtor mutate
 * assets. Voluntary concession (declare_bankruptcy outside RESOLVING_DEBT)
 * is the one place a non-current player can go bankrupt, and settleBankruptcy
 * handles that by only advancing the turn when the debtor IS the current
 * player.
 */
import type { Debt, GameEvent, GameMap, GameState, Phase, PlayerId } from '../shared/types';
import {
  activePlayers,
  addToVacationPot,
  currentPlayer,
  getPlayer,
  ownableTileIndices,
  updateBank,
  updatePlayer,
  updateTile,
} from './state';
import { dropTradesInvolving } from './trades';

/** What phase to land in once a roll's landing resolution (and any debt it caused) is fully done. */
export function phaseAfterLanding(state: GameState): Phase {
  const roll = state.lastRoll;
  const wasDouble = roll !== null && roll[0] === roll[1];
  return wasDouble && state.doublesCount < 3 ? 'AWAITING_ROLL' : 'AWAITING_END_TURN';
}

/**
 * Steps to the next non-bankrupt player, skipping (and decrementing) anyone
 * sitting out a Vacation penalty. If every active player is currently
 * skipping — including the degenerate case where the lap wraps back onto a
 * bankrupt outgoing player (settleBankruptcy's caller) instead of a live one
 * — this still terminates after one lap: it lands on the first active player
 * it saw rather than looping forever or parking the turn on a bankrupt id.
 * That player's own pending skip (if any) is still consumed, just not
 * reported as a turn_skipped — they're the one who actually gets the turn,
 * not someone passed over.
 */
export function advanceTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const n = state.turnOrder.length;
  let next = state;
  let idx = state.currentPlayerIndex;
  let firstActiveIdx = -1;
  let broke = false;
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const id = next.turnOrder[idx]!;
    const p = next.players.find((pl) => pl.id === id)!;
    if (p.bankrupt) continue;
    if (firstActiveIdx === -1) firstActiveIdx = idx;
    if (p.skipTurns === 0) {
      broke = true;
      break;
    }
    next = updatePlayer(next, id, { skipTurns: p.skipTurns - 1 });
    events.push({ type: 'turn_skipped', playerId: id });
  }
  if (!broke) {
    idx = firstActiveIdx;
    // firstActiveIdx is always the first active player visited, so if it was processed at
    // all its push is always events[0] — that player is the lander, not someone skipped.
    events.shift();
  }
  // Trade send limits are per turn; a doubles re-roll never comes through here.
  const tradeSendCounts = idx === state.currentPlayerIndex ? next.tradeSendCounts : {};
  return { state: { ...next, currentPlayerIndex: idx, doublesCount: 0, tradeSendCounts }, events };
}

/** Everything the debtor still owes, across the current creditor and the queue. */
export function totalOwed(debt: Debt): number {
  return debt.amount + debt.queued.reduce((sum, q) => sum + q.amount, 0);
}

/**
 * Opens a Debt for a charge the current player can't cover (docs/ENGINE.md decisions 4, 13). Their
 * balance drops by the whole charge, going negative, and whatever they held is then paid
 * over at once through the same routine as any later income.
 */
export function openDebt(
  state: GameState,
  debtorId: PlayerId,
  amount: number,
  creditor: PlayerId | null,
  queued: readonly { amount: number; creditor: PlayerId | null }[] = [],
): { state: GameState; events: GameEvent[] } {
  if (debtorId !== currentPlayer(state).id) {
    throw new Error('Engine invariant violated: debt debtor must be the current player');
  }
  const debt: Debt = { debtor: debtorId, amount, creditor, queued };
  const debtor = getPlayer(state, debtorId);
  let opened: GameState = { ...state, phase: 'RESOLVING_DEBT', debt };
  opened = updatePlayer(opened, debtorId, { cash: debtor.cash - totalOwed(debt) });
  return payDebtFromIncome(opened, [{ type: 'debt_opened', debt }]);
}

/**
 * The one pay-as-you-go routine. Call it after anything that may have raised the debtor's
 * balance (opening the debt, a building sale, an accepted trade); it is a no-op otherwise.
 *
 * Anything above `-owed` is money the debtor has received since the last call, and it goes
 * to the creditors in queue order. The debtor's own balance doesn't move here: it already
 * went negative by the full amount when the debt opened, so a payment only shrinks what is
 * owed. Once nothing is owed the debt clears and the turn carries on where landing left it.
 */
export function payDebtFromIncome(
  state: GameState,
  events: GameEvent[] = [],
): { state: GameState; events: GameEvent[] } {
  const debt = state.debt;
  if (!debt) return { state, events };
  const debtor = getPlayer(state, debt.debtor);
  let available = debtor.cash + totalOwed(debt);
  if (available <= 0) return { state, events };

  let next = state;
  const out = events.slice();
  const owed = [{ amount: debt.amount, creditor: debt.creditor }, ...debt.queued];
  while (owed.length > 0 && available > 0) {
    const head = owed[0]!;
    const pay = Math.min(available, head.amount);
    if (head.creditor) {
      const c = getPlayer(next, head.creditor);
      next = updatePlayer(next, head.creditor, { cash: c.cash + pay });
    } else {
      next = addToVacationPot(next, pay);
    }
    out.push({ type: 'paid', from: debtor.id, to: head.creditor, amount: pay, reason: 'debt' });
    available -= pay;
    if (pay === head.amount) owed.shift();
    else owed[0] = { amount: head.amount - pay, creditor: head.creditor };
  }

  const [head, ...rest] = owed;
  if (head) {
    return { state: { ...next, debt: { debtor: debtor.id, amount: head.amount, creditor: head.creditor, queued: rest } }, events: out };
  }
  out.push({ type: 'debt_cleared', playerId: debtor.id });
  return { state: { ...next, debt: null, phase: phaseAfterLanding(next) }, events: out };
}

/**
 * A creditor who goes bankrupt can no longer be paid, so whatever the debtor still owes
 * them is written off rather than paid into the void. The debtor's balance rises by the
 * same amount, which may clear the debt outright.
 */
function forgiveDebtsTo(state: GameState, creditorId: PlayerId, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  const debt = state.debt;
  if (!debt || debt.debtor === creditorId) return { state, events };
  const owed = [{ amount: debt.amount, creditor: debt.creditor }, ...debt.queued];
  const kept = owed.filter((o) => o.creditor !== creditorId);
  const forgiven = totalOwed(debt) - kept.reduce((sum, o) => sum + o.amount, 0);
  if (forgiven === 0) return { state, events };

  const debtor = getPlayer(state, debt.debtor);
  const next = updatePlayer(state, debtor.id, { cash: debtor.cash + forgiven });
  const [head, ...rest] = kept;
  if (head) {
    return { state: { ...next, debt: { debtor: debtor.id, amount: head.amount, creditor: head.creditor, queued: rest } }, events };
  }
  return {
    state: { ...next, debt: null, phase: phaseAfterLanding(next) },
    events: [...events, { type: 'debt_cleared', playerId: debtor.id }],
  };
}

/**
 * Bankruptcy, whether declared in debt or as a concession (docs/ENGINE.md decisions 5, 30). Every
 * building goes back to the bank supply and every property becomes unowned again, so the
 * market gets it all back and nobody can be handed a lead. A creditor keeps what was already
 * paid and gets nothing more; any positive cash goes to the bank.
 */
export function settleBankruptcy(
  map: GameMap,
  state: GameState,
  playerId: PlayerId,
  events: GameEvent[] = [],
): { state: GameState; events: GameEvent[] } {
  let out = events.slice();
  let next = state;
  const player = getPlayer(next, playerId);

  let housesFreed = 0;
  let hotelsFreed = 0;
  for (const index of ownableTileIndices(map)) {
    const ownership = next.tiles[index]!;
    if (ownership.owner !== playerId) continue;
    if (ownership.hotel) hotelsFreed += 1;
    else housesFreed += ownership.houses;
    next = updateTile(next, index, { owner: null, houses: 0, hotel: false, mortgaged: false });
  }
  if (!next.settings.unlimitedBuildings && (housesFreed > 0 || hotelsFreed > 0)) {
    next = updateBank(next, { houses: next.bank.houses + housesFreed, hotels: next.bank.hotels + hotelsFreed });
  }

  if (player.cash > 0) {
    out.push({ type: 'paid', from: playerId, to: null, amount: player.cash, reason: 'bankruptcy_settlement' });
  }
  // A negative balance is just the unpaid debt, which dies with the debt below.
  next = updatePlayer(next, playerId, { cash: 0, bankrupt: true });
  if (next.debt?.debtor === playerId) next = { ...next, debt: null };
  out.push({ type: 'bankrupt', playerId, creditor: null });

  ({ state: next, events: out } = dropTradesInvolving(next, playerId, out));
  ({ state: next, events: out } = forgiveDebtsTo(next, playerId, out));

  const remaining = activePlayers(next);
  if (remaining.length <= 1) {
    // Nobody left is reachable in a solo game (test mode) when the only player concedes.
    // The game is over either way and `advanceTurn` has no seat to move to, but there is
    // no winner to name, so the event is omitted rather than crowning the bankrupt.
    const winner = remaining[0]?.id ?? null;
    next = { ...next, phase: 'GAME_OVER', winner, debt: null, trades: [] };
    if (winner) out.push({ type: 'game_over', winner });
    return { state: next, events: out };
  }

  if (playerId === currentPlayer(next).id) {
    const advanced = advanceTurn(next);
    next = { ...advanced.state, phase: 'AWAITING_ROLL' };
    out.push(...advanced.events, { type: 'turn_ended', nextPlayerId: currentPlayer(next).id });
  }

  return { state: next, events: out };
}
