import type { CatalogItem } from '@llm-app/shared';
import type { CatalogRepository } from '../repositories/catalogRepository.js';

const SEMANTIC_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/** Cosine similarity двух векторов; результат clamp 0..1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, cosine));
}

/** Min-max нормализация scores в диапазон 0..1. */
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  const normalized = new Map<string, number>();

  if (scores.size === 0) {
    return normalized;
  }

  const values = [...scores.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    for (const id of scores.keys()) {
      normalized.set(id, 1);
    }
    return normalized;
  }

  const range = max - min;
  for (const [id, value] of scores) {
    normalized.set(id, (value - min) / range);
  }

  return normalized;
}

export function mergeHybridScores(
  semantic: Map<string, number>,
  keyword: Map<string, number>,
): Map<string, number> {
  const semanticNorm = normalizeScores(semantic);
  const keywordNorm = normalizeScores(keyword);
  const ids = new Set([...semanticNorm.keys(), ...keywordNorm.keys()]);
  const combined = new Map<string, number>();

  for (const id of ids) {
    const score =
      SEMANTIC_WEIGHT * (semanticNorm.get(id) ?? 0) +
      KEYWORD_WEIGHT * (keywordNorm.get(id) ?? 0);
    combined.set(id, score);
  }

  return combined;
}

export interface HybridSearchDeps {
  repository: CatalogRepository;
  embedQuery: (query: string) => Promise<number[]>;
  limit: number;
}

export async function hybridSearch(
  query: string,
  deps: HybridSearchDeps,
): Promise<Array<{ item: CatalogItem; score: number }>> {
  const queryEmbedding = await deps.embedQuery(query);

  const [itemsWithEmbeddings, textHits] = await Promise.all([
    deps.repository.findAllWithEmbeddings(),
    deps.repository.textSearch(query),
  ]);

  const itemsById = new Map(itemsWithEmbeddings.map((item) => [item._id, item]));

  const semanticScores = new Map<string, number>();
  for (const item of itemsWithEmbeddings) {
    semanticScores.set(item._id, cosineSimilarity(queryEmbedding, item.embedding));
  }

  const keywordScores = new Map<string, number>();
  for (const hit of textHits) {
    keywordScores.set(hit.id, hit.textScore);
  }

  const combined = mergeHybridScores(semanticScores, keywordScores);

  const ranked = [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, deps.limit);

  const results: Array<{ item: CatalogItem; score: number }> = [];

  for (const [id, score] of ranked) {
    let item = itemsById.get(id);
    if (!item) {
      item = (await deps.repository.findById(id)) ?? undefined;
    }
    if (item && item.status === 'ready') {
      results.push({ item, score });
    }
  }

  return results;
}
