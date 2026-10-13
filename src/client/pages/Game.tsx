import { useCallback, useState } from 'react';
import type { GameAction, GameEvent, GameMap, GameState, PlayerId } from '../../shared/types';
import { actingPlayerId } from '../acting';
import { Board } from '../components/Board';
import { Sidebar } from '../components/Sidebar';
import { SettingsPanel } from '../components/SettingsPanel';
import { ShareLink } from '../components/ShareLink';
import { TradeModal, type TradeModalMode } from '../components/TradeModal';
import { PropertyCard } from '../components/PropertyCard';

export function Game({
  map, state, myPlayerId, events, onAction, code, error = null, onClearError = () => {},
}: {
  map: GameMap;
  state: GameState;
  myPlayerId: PlayerId;
  events: readonly GameEvent[];
  onAction: (action: GameAction, asPlayerId?: PlayerId) => void;
  code: string;
  /** The latest server refusal, surfaced inside the trade modal and the property card. */
  error?: string | null;
  onClearError?: () => void;
}) {
  // One tab can be driving several seats (see `actingPlayerId`); the server is told which
  // one an action is for, and refuses any id that is not one of this player's dummies.
  const acting = actingPlayerId(state, myPlayerId);
  const asSeat = (seat: PlayerId) => (seat === myPlayerId ? undefined : seat);
  const act = (action: GameAction) => onAction(action, asSeat(acting));
  const actAs = (action: GameAction, seat: PlayerId) => onAction(action, asSeat(seat));

  const [tradeMode, setTradeMode] = useState<TradeModalMode | null>(null);
  // Bumped on every open so the modal's draft starts fresh, even for the same partner.
  const [tradeKey, setTradeKey] = useState(0);
  const openTrade = (mode: TradeModalMode) => {
    // An error left over from some earlier action must not greet the new modal.
    onClearError();
    setTradeMode(mode);
    setTradeKey(k => k + 1);
  };
  const closeTrade = useCallback(() => setTradeMode(null), []);

  const [card, setCard] = useState<{ tileIndex: number; rect: DOMRect } | null>(null);
  const openCard = (tileIndex: number, rect: DOMRect) => {
    onClearError();
    setCard({ tileIndex, rect });
  };
  const closeCard = useCallback(() => setCard(null), []);

  return (
    <div className="game">
      <div className="rail rail--left">
        <div className="brand">Board Night</div>
        <ShareLink code={code} />
        {/* Read-only once the game is running: everyone can check which rules are in
            force, nobody can change them. The host sets them in the lobby, before the
            engine has snapshotted them into the game state. */}
        <div className="panel">
          <div className="panel__title">Game settings</div>
          <SettingsPanel settings={state.settings} editable={false} onChange={() => {}} />
        </div>
      </div>
      <div className="game__board-wrap">
        <Board map={map} state={state} events={events} />
      </div>
      <Sidebar
        map={map} state={state} myPlayerId={myPlayerId} actingPlayerId={acting} onAction={act} onActAs={actAs}
        onTrade={() => openTrade({ kind: 'pick', self: acting })}
        onViewTrade={(self, tradeId) => openTrade({ kind: 'view', self, tradeId })}
        onOpenProperty={openCard}
      />
      {tradeMode && (
        <TradeModal
          key={tradeKey}
          map={map} state={state} mode={tradeMode} error={error}
          onAction={actAs}
          onModeChange={openTrade}
          onClose={closeTrade}
        />
      )}
      {card && (
        <PropertyCard
          key={card.tileIndex}
          map={map} state={state} tileIndex={card.tileIndex} anchor={card.rect} myPlayerId={myPlayerId} error={error}
          onAction={actAs} onClose={closeCard}
        />
      )}
    </div>
  );
}
