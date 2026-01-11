import { useMemo } from 'react';
import { resolveImageSrc } from '../lib/images';
import type { Item } from '../types';
import { timeAgo } from '../utils/format';

interface Props {
  item: Item;
  onClick?: () => void;
}

export const ItemCard = ({ item, onClick }: Props) => {
  const rawImagePath =
    item.item_images?.[0]?.thumbnail_path ?? item.item_images?.[0]?.path ?? null;
  const imageSrc = useMemo(() => resolveImageSrc(rawImagePath), [rawImagePath]);
  const tags =
    Array.isArray(item.metadata?.tags) && item.metadata?.tags.length
      ? item.metadata?.tags.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

  return (
    <div className="item-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="item-image blurred">
        {imageSrc ? (
          <img src={imageSrc} alt={item.vague_description || 'Lost item'} />
        ) : (
          <div className="image-placeholder">Blurred for safety</div>
        )}
      </div>
      <div className="item-body">
        <div className="item-title">
          {item.vague_description || item.title || 'Unlabeled item'}
        </div>
        <div className="item-meta">
          <span>Found at: {item.location_hint || 'Location pending'}</span>
          <span>-</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
        <div className="chips">
          {tags.length === 0 && (
            <span className="hint">No tags yet</span>
          )}
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="chip chip-soft">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
