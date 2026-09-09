export type {
  ProcessingStatus,
  ImageStorage,
  CatalogItemImage,
  CatalogItemLlm,
  CatalogItem,
  CatalogItemPublic,
} from './catalog.js';

export type {
  ApiError,
  HealthResponse,
  CreateItemResponse,
  GetItemResponse,
  PaginationMeta,
  ListItemsQuery,
  ListItemsResponse,
  TagsListResponse,
  SearchResultItem,
  SearchResponse,
  UpdateUserTagsRequest,
  UpdateUserTagsResponse,
} from './api.js';

export {
  slugifyTag,
  dedupeTags,
  TAG_REGEX,
  TAG_MIN_LENGTH,
  TAG_MAX_LENGTH,
  MAX_USER_TAGS,
} from '../utils/tagNormalize.js';
