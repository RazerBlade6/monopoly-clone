import { useState } from 'react';
import type { GameAction, GameMap, GameState, PlayerId } from '../../shared/types';
import { PlayerCard } from './PlayerCard';
import { BankruptButton } from './ActionBar';
import { TradesPanel } from './TradesPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { controls } from '../acting';

export function Sidebar({
  map, state, myPlayerId, actingPlayerId, onAction, onActAs, onTrade, onViewTrade, onOpenProperty,
}: {
  map: GameMap;
  state: GameState;
  myPlayerId: PlayerId;
  actingPlayerId: PlayerId;
  onAction: (action: GameAction) => void;
  /** For actions taken as a specific seat of mine, such as selling from that seat's list. */
  onActAs: (action: GameAction, seat: PlayerId) => void;
  /** Opens the player picker for a new trade from the acting seat. */
  onTrade: () => void;
  onViewTrade: (self: PlayerId, tradeId: string) => void;
  onOpenProperty: (tileIndex: number, rect: DOMRect) => void;
}) {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const acting = state.players.find(p => p.id === actingPlayerId);
  const canTrade = state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' && !!acting && !acting.bankrupt;

  // Falls back to the acting seat when the picked player is gone (a new game, a restart).
  const [selectedId, setSelectedId] = useState<PlayerId | null>(null);
  const shown = state.players.find(p => p.id === selectedId) ?? acting;

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
            selected={player.id === shown?.id}
            onSelect={() => setSelectedId(player.id)}
          />
        ))}
      </div>
      <TradesPanel
        state={state} myPlayerId={myPlayerId} onView={onViewTrade}
        onNewTrade={canTrade ? onTrade : undefined} canPickPartner={hasPartner}
      />
      {/* Kept out here, away from the turn buttons in the middle of the board, so a quick
          click there can never land on it. */}
      {canTrade && (
        <div className="sidebar__bankrupt">
          <BankruptButton onAction={onAction} />
        </div>
      )}
      {shown && (
        <PropertiesPanel
          map={map} state={state} player={shown} isMe={shown.id === myPlayerId}
          controlled={controls(state, myPlayerId, shown.id)}
          onOpen={onOpenProperty}
          onSell={tileIndex => onActAs({ type: 'sell_property', tileIndex }, shown.id)}
        />
      )}
    </div>
  );
}
