/** Допустимый формат тега после нормализации (LLM и пользовательские). */
export const TAG_REGEX = /^[a-zа-яё0-9-]+$/u;

export const TAG_MIN_LENGTH = 1;
export const TAG_MAX_LENGTH = 40;
export const MAX_USER_TAGS = 15;

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
