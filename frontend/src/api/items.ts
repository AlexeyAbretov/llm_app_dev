import type {
  CreateItemResponse,
  GetItemResponse,
  ListItemsResponse,
  TagsListResponse,
  UpdateUserTagsRequest,
  UpdateUserTagsResponse,
} from '../types';
import { apiGet, apiPatch, apiPost } from './client';

export function getHealth() {
  return apiGet<import('../types').HealthResponse>('/health');
}

export function getItem(id: string) {
  return apiGet<GetItemResponse>(`/items/${id}`);
}

export function listItems(page = 1, limit = 20, tags?: string[]) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (tags?.length) {
    params.set('tags', tags.join(','));
  }
  return apiGet<ListItemsResponse>(`/items?${params}`);
}

export function listTags() {
  return apiGet<TagsListResponse>('/tags');
}

export function createItem(image: File) {
  const formData = new FormData();
  formData.append('image', image);
  return apiPost<CreateItemResponse>('/items', formData);
}

export function updateUserTags(id: string, userTags: UpdateUserTagsRequest['userTags']) {
  return apiPatch<UpdateUserTagsResponse>(`/items/${id}/user-tags`, { userTags });
}
