import type { GameAction, GameMap, GameState, PlayerId } from '../../shared/types';
import { PlayerCard } from './PlayerCard';
import { ActionBar } from './ActionBar';
import { TradesPanel } from './TradesPanel';

export function Sidebar({
  map, state, myPlayerId, actingPlayerId, onAction, onTrade, onViewTrade,
}: {
  map: GameMap;
  state: GameState;
  myPlayerId: PlayerId;
  actingPlayerId: PlayerId;
  onAction: (action: GameAction) => void;
  /** Opens the player picker for a new trade from the acting seat. */
  onTrade: () => void;
  onViewTrade: (self: PlayerId, tradeId: string) => void;
}) {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const acting = state.players.find(p => p.id === actingPlayerId);
  const canTrade = state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' && !!acting && !acting.bankrupt;

  const hasPartner = state.players.some(p => p.id !== actingPlayerId && !p.bankrupt);

  return (
    <div className="rail rail--right">
      <div className="sidebar__players">
        {state.players.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            map={map}
            state={state}
            isCurrentTurn={player.id === currentPlayerId}
            isMe={player.id === myPlayerId}
          />
        ))}
      </div>
      <TradesPanel
        state={state} myPlayerId={myPlayerId} onView={onViewTrade}
        onNewTrade={canTrade ? onTrade : undefined} canPickPartner={hasPartner}
      />
      <ActionBar
        map={map} state={state} myPlayerId={myPlayerId}
        actingPlayerId={actingPlayerId} onAction={onAction}
      />
    </div>
  );
}
