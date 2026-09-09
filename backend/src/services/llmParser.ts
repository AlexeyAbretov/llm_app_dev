import { z } from 'zod';

export const visionResponseSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1),
  tags: z
    .array(z.string().regex(/^[a-zа-яё0-9-]+$/u, 'тег в нижнем регистре'))
    .min(3)
    .max(7),
  embedText: z.string().min(8).max(600),
});

export type VisionParseResult = z.infer<typeof visionResponseSchema>;

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObject(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('JSON-объект не найден в ответе LLM');
  }
  return match[0];
}

export function slugifyTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTags(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || !('tags' in parsed)) {
    return parsed;
  }

  const record = parsed as { tags?: unknown };
  if (!Array.isArray(record.tags)) {
    return parsed;
  }

  return {
    ...record,
    tags: record.tags.map((tag) => slugifyTag(String(tag))).filter(Boolean),
  };
}

function parseAndValidate(jsonText: string): VisionParseResult {
  const parsed: unknown = JSON.parse(jsonText);
  const result = visionResponseSchema.parse(normalizeTags(parsed));
  return {
    ...result,
    embedText: result.embedText.trim().replace(/\s+/g, ' '),
  };
}

/**
 * Разбирает сырой текст vision LLM в { title, description, tags, embedText }.
 * Поддерживает markdown-обёртку и regex-fallback.
 */
export function parseVisionResponse(raw: string): VisionParseResult {
  const withoutFence = stripMarkdownFence(raw);

  try {
    return parseAndValidate(withoutFence);
  } catch {
    // fallback: извлечь первый JSON-объект из текста
  }

  try {
    return parseAndValidate(extractJsonObject(withoutFence));
  } catch (error) {
    const preview = raw.slice(0, 200).replace(/\s+/g, ' ');
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Не удалось разобрать ответ vision LLM: ${message}. Фрагмент: ${preview}`);
  }
}
