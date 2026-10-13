import type { Tile } from '../../shared/types';
import { displayName } from '../colors';
import { flagUrl, iconUrl, isDarkIcon, tileIcon, tileIconName, type IconName } from '../tileArt';

/**
 * A tile's round badge outside the board: its country's flag for a city, its icon for
 * anything else. The wrapper owns the size and the circle (`className`); the image fills it.
 */
export function TileBadge({ tile, className }: { tile: Tile; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {tile.type === 'city'
        ? <img className="flag-img" src={flagUrl(tile.countryId)} alt="" draggable={false} />
        : <TileIcon tile={tile} />}
    </span>
  );
}

/** The flag alone, for places that draw their own badge (the board tile). */
export function FlagImage({ tile }: { tile: Extract<Tile, { type: 'city' }> }) {
  return <img className="flag-img" src={flagUrl(tile.countryId)} alt={displayName(tile.countryId)} draggable={false} />;
}

/** A non-city tile's icon, or its emoji while the art for it hasn't been added. */
export function TileIcon({ tile }: { tile: Tile }) {
  const name = tileIconName(tile);
  if (name && iconUrl(name)) return <Icon name={name} />;
  return <>{tileIcon(tile)}</>;
}

/** One bundled icon, sized by its container's font size (`1em` square). */
export function Icon({ name }: { name: IconName }) {
  const url = iconUrl(name);
  if (!url) return null;
  return (
    <img
      className={`icon-img${isDarkIcon(name) ? ' icon-img--dark' : ''}`}
      src={url} alt="" draggable={false}
    />
  );
}
