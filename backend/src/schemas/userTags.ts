import {
  MAX_USER_TAGS,
  slugifyTag,
  TAG_MAX_LENGTH,
  TAG_MIN_LENGTH,
  TAG_REGEX,
} from '@llm-app/shared';
import { z } from 'zod';

export function validateUserTags(
  rawTags: string[],
  llmTags: string[],
): { ok: true; userTags: string[] } | { ok: false; error: string } {
  if (rawTags.length > MAX_USER_TAGS) {
    return {
      ok: false,
      error: `Не больше ${MAX_USER_TAGS} пользовательских тегов`,
    };
  }

  const normalized: string[] = [];
  for (const raw of rawTags) {
    const tag = slugifyTag(raw);
    if (!tag) {
      return { ok: false, error: 'Некорректный формат тега' };
    }
    normalized.push(tag);
  }

  for (const tag of normalized) {
    if (tag.length < TAG_MIN_LENGTH || tag.length > TAG_MAX_LENGTH) {
      return {
        ok: false,
        error: `Длина тега — от ${TAG_MIN_LENGTH} до ${TAG_MAX_LENGTH} символов`,
      };
    }
    if (!TAG_REGEX.test(tag)) {
      return { ok: false, error: 'Тег может содержать только буквы, цифры и дефис' };
    }
  }

  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    return { ok: false, error: 'Теги должны быть уникальными' };
  }

  const llmLower = new Set(llmTags.map((tag) => tag.toLowerCase()));
  for (const tag of normalized) {
    if (llmLower.has(tag.toLowerCase())) {
      return { ok: false, error: `Тег «${tag}» уже есть среди тегов LLM` };
    }
  }

  return { ok: true, userTags: normalized };
}

export const updateUserTagsBodySchema = z.object({
  userTags: z.array(z.string()),
});
