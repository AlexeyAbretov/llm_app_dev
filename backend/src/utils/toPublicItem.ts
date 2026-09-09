import type { CatalogItem, CatalogItemPublic } from '@llm-app/shared';
import { getUrl } from '../services/imageStorage.js';

/** API-ответ без embedding и embedText, с imageUrl для сохранённых файлов. */
export function toPublicItem(item: CatalogItem): CatalogItemPublic {
  const { embedding: _embedding, embedText: _embedText, ...rest } = item;
  const hasImage =
    item.image.ref &&
    !item.image.ref.startsWith('pending/') &&
    (item.image.storage === 'gridfs' || item.image.storage === 'disk');

  const imageUrl = hasImage ? getUrl(item._id) : undefined;

  return imageUrl ? { ...rest, imageUrl } : rest;
}
