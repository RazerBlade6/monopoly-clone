import type { Tile } from '../../shared/types';
import { displayName } from '../colors';
import { flagUrl, tileIcon } from '../tileArt';

/**
 * A tile's round badge outside the board: its country's flag for a city, its icon for
 * anything else. The wrapper owns the size and the circle (`className`); the flag fills it.
 */
export function TileBadge({ tile, className }: { tile: Tile; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {tile.type === 'city'
        ? <img className="flag-img" src={flagUrl(tile.countryId)} alt="" draggable={false} />
        : tileIcon(tile)}
    </span>
  );
}

/** The flag alone, for places that draw their own badge (the board tile). */
export function FlagImage({ tile }: { tile: Extract<Tile, { type: 'city' }> }) {
  return <img className="flag-img" src={flagUrl(tile.countryId)} alt={displayName(tile.countryId)} draggable={false} />;
}
