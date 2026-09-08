import type { SearchResponse } from '../types';
import { apiGet } from './client';

export function searchItems(query: string, limit = 20) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return apiGet<SearchResponse>(`/search?${params}`);
}
