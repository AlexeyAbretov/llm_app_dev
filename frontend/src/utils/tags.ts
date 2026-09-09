/** Объединённые теги для read-only отображения (LLM + пользовательские). */
export function mergeDisplayTags(tags: string[], userTags: string[] = []): string[] {
  return [...tags, ...userTags];
}
