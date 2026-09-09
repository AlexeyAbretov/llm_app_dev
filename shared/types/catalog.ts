export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type ImageStorage = 'gridfs' | 'disk';

export interface CatalogItemImage {
  storage: ImageStorage;
  /** GridFS id или относительный path */
  ref: string;
  mime: string;
  originalName: string;
}

export interface CatalogItemLlm {
  visionModel: string;
  embedModel: string;
  promptVersion: string;
}

/** Полная модель объекта каталога (MongoDB) */
export interface CatalogItem {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  /** Пользовательские теги (редактируются на detail после ready). */
  userTags: string[];
  /** Английский текст для nomic / $text; в API не отдаём. */
  embedText: string;
  image: CatalogItemImage;
  /** 768 dims (nomic-embed-text) */
  embedding: number[];
  status: ProcessingStatus;
  error?: string;
  llm: CatalogItemLlm;
  createdAt: string;
  updatedAt: string;
}

/** Объект для API-ответов (без embedding) */
export type CatalogItemPublic = Omit<CatalogItem, 'embedding' | 'embedText'> & {
  imageUrl?: string;
};
