import type { CatalogItem, CatalogItemPublic } from '@llm-app/shared';
import { getUrl } from '../services/imageStorage.js';

/** API-ответ без embedding и embedText, с imageUrl для сохранённых файлов. */
export function toPublicItem(item: CatalogItem): CatalogItemPublic {
  const { embedding: _embedding, embedText: _embedText, ...rest } = item;
  const imageUrl =
    item.image.storage === 'disk' &&
    item.image.ref &&
    !item.image.ref.startsWith('pending/')
      ? getUrl(item.image.ref)
      : undefined;

  return imageUrl ? { ...rest, imageUrl } : rest;
}
