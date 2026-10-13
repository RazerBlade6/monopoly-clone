import type { GameMap, GameState, OwnableTile, Player } from '../../shared/types';
import { legalActions } from '../../engine/legal';
import { propertySaleValue } from '../../engine/state';
import { assetBlockedReason } from '../assetGate';
import { countryColor } from '../colors';
import { groupProperties } from '../propertyOrder';
import { countryFlag, tileIcon } from '../tileArt';

function development(houses: number, hotel: boolean): string | null {
  if (hotel) return 'Hotel';
  if (houses > 0) return `${houses} ${houses === 1 ? 'house' : 'houses'}`;
  return null;
}

export function PropertiesPanel({
  map, state, player, isMe, controlled, onOpen, onSell,
}: {
  map: GameMap;
  state: GameState;
  player: Player;
  isMe: boolean;
  /** Whether this tab drives `player`, which is what puts a Sell button on each row. */
  controlled: boolean;
  onOpen: (tileIndex: number, rect: DOMRect) => void;
  onSell: (tileIndex: number) => void;
}) {
  const owned = player.bankrupt
    ? []
    : map.tiles.filter((t): t is OwnableTile =>
        (t.type === 'city' || t.type === 'airport' || t.type === 'company') && state.tiles[t.index]?.owner === player.id);
  const groups = groupProperties(owned);
  const legal = controlled ? legalActions(map, state, player.id) : [];

  return (
    <div className="properties-panel">
      <div className="panel__title">{isMe ? 'Your properties' : `${player.name}'s properties`}</div>
      <div className="properties-panel__list">
        {groups.length === 0 && <p className="properties-panel__empty">No properties yet</p>}
        {groups.map(group => (
          <div key={group.key} className="properties-group">
            {group.tiles.map(tile => {
              const own = state.tiles[tile.index];
              const dev = tile.type === 'city' && own ? development(own.houses, own.hotel) : null;
              return (
                <div
                  key={tile.index}
                  className="properties-row"
                  style={{ borderLeftColor: tile.type === 'city' ? countryColor(tile.countryId) : 'var(--muted)' }}
                >
                  {/* The row and its Sell button are siblings, so a click on Sell can't open the card. */}
                  <button type="button" className="properties-row__open" onClick={e => onOpen(tile.index, e.currentTarget.getBoundingClientRect())}>
                    <span className="trade-tile__badge">{tile.type === 'city' ? countryFlag(tile.countryId) : tileIcon(tile)}</span>
                    <span className="properties-row__text">
                      <span className="properties-row__name">{tile.name}</span>
                      {dev && <span className="properties-row__dev">{dev}</span>}
                    </span>
                    <span className="properties-row__price">${tile.price}</span>
                  </button>
                  {controlled && (
                    <SellButton
                      amount={propertySaleValue(tile)}
                      blocked={assetBlockedReason(map, state, player.id, legal, { type: 'sell_property', tileIndex: tile.index })}
                      onSell={() => onSell(tile.index)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SellButton({ amount, blocked, onSell }: { amount: number; blocked: string | null; onSell: () => void }) {
  return (
    // The tooltip sits on a wrapper because some browsers show none for a disabled button.
    <span className="properties-row__sell" title={blocked ?? `Sell to the bank for $${amount}`}>
      <button type="button" className="btn btn--small" onClick={onSell} disabled={blocked !== null}>Sell</button>
    </span>
  );
}
