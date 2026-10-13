import type { GameState, PlayerId } from '../shared/types';

/**
 * Which seat this tab is acting for right now.
 *
 * Normally your own. Dummy players added from the Developer panel have no socket of their
 * own, so the person who added them drives them from the same tab: whenever the game is
 * waiting on a seat they control, the action bar becomes that seat. Debt comes first —
 * a dummy of yours can owe money while it is somebody else's turn, and nothing else moves
 * until that clears.
 *
 * Bankrupt seats are skipped, including your own: going bankrupt while your dummies are
 * still playing must not leave you with no way to act.
 */
/** Whether this tab drives `id`: it is my own seat, or one of my dummies. */
export function controls(state: GameState, myPlayerId: PlayerId, id: PlayerId): boolean {
  return id === myPlayerId || state.players.find(p => p.id === id)?.dummyOf === myPlayerId;
}

export function actingPlayerId(state: GameState, myPlayerId: PlayerId): PlayerId {
  const mine = (id: PlayerId | undefined): id is PlayerId => !!id && controls(state, myPlayerId, id);
  const live = (id: PlayerId): boolean => !state.players.find(p => p.id === id)?.bankrupt;

  const debtor = state.debt?.debtor;
  if (state.phase === 'RESOLVING_DEBT' && mine(debtor)) return debtor;

  const current = state.turnOrder[state.currentPlayerIndex];
  if (mine(current) && live(current)) return current;

  if (live(myPlayerId)) return myPlayerId;
  return state.players.find(p => p.dummyOf === myPlayerId && !p.bankrupt)?.id ?? myPlayerId;
}
