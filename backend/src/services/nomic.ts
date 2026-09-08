/** Префиксы nomic-embed-text для retrieval (task: search). */
export type NomicEmbedTask = 'document' | 'query';

export function nomicEmbedInput(text: string, task: NomicEmbedTask): string {
  const prefix = task === 'query' ? 'search_query:' : 'search_document:';
  return `${prefix} ${text.trim()}`;
}
