import type {
  CreateItemResponse,
  GetItemResponse,
  ListItemsResponse,
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

export function listItems(page = 1, limit = 20) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiGet<ListItemsResponse>(`/items?${params}`);
}

export function createItem(image: File) {
  const formData = new FormData();
  formData.append('image', image);
  return apiPost<CreateItemResponse>('/items', formData);
}

export function updateUserTags(id: string, userTags: UpdateUserTagsRequest['userTags']) {
  return apiPatch<UpdateUserTagsResponse>(`/items/${id}/user-tags`, { userTags });
}
