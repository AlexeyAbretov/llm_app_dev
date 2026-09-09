/** Допустимый формат тега после нормализации (LLM и пользовательские). */
export const TAG_REGEX = /^[a-zа-яё0-9-]+$/u;

export const TAG_MIN_LENGTH = 1;
export const TAG_MAX_LENGTH = 40;
/** Максимум тегов на карточке: LLM + пользовательские. */
export const MAX_TOTAL_TAGS = 15;

/** Сколько user-тегов можно добавить при заданном числе LLM-тегов. */
export function maxUserTagsForItem(llmTagsCount: number): number {
  return Math.max(0, MAX_TOTAL_TAGS - llmTagsCount);
}

/** Приводит ввод пользователя/LLM к slug: нижний регистр, пробелы → дефис. */
export function slugifyTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
