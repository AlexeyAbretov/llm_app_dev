import { slugifyTag } from '@llm-app/shared';

const TAG_REGEX = /^[a-zа-яё0-9-]+$/u;

export function parseTagsQueryParam(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const parts = Array.isArray(value) ? value : [value];
  return parts
    .flatMap((part) => String(part).split(','))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Нормализует теги фильтра; пустой массив — без фильтра; null — невалидный тег. */
export function normalizeFilterTags(raw: string[]): string[] | null {
  const normalized: string[] = [];

  for (const part of raw) {
    const tag = slugifyTag(part);
    if (!tag || !TAG_REGEX.test(tag)) {
      return null;
    }
    normalized.push(tag);
  }

  return [...new Set(normalized)];
}
