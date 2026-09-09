import type { CatalogItemPublic, ProcessingStatus } from './catalog.js';

export interface ApiError {
  error: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  mongo: boolean;
  ollama: boolean;
}

export interface CreateItemResponse {
  id: string;
  status: ProcessingStatus;
}

export interface GetItemResponse extends CatalogItemPublic {}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListItemsQuery {
  page?: number;
  limit?: number;
  /** Фильтр по тегам (OR): comma-separated или повтор param. */
  tags?: string | string[];
}

export interface ListItemsResponse {
  items: CatalogItemPublic[];
  meta: PaginationMeta;
}

export interface TagsListResponse {
  tags: string[];
}

export interface SearchResultItem {
  item: CatalogItemPublic;
  score: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  query: string;
}

export interface UpdateUserTagsRequest {
  userTags: string[];
}

export interface UpdateUserTagsResponse extends GetItemResponse {}
