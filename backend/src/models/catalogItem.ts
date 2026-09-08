import type { ObjectId } from 'mongodb';
import type {
  CatalogItem,
  CatalogItemImage,
  CatalogItemLlm,
  ProcessingStatus,
} from '@llm-app/shared';

/** Документ MongoDB (ObjectId и Date в нативном виде) */
export interface CatalogItemDocument {
  _id: ObjectId;
  title: string;
  description: string;
  tags: string[];
  image: CatalogItemImage;
  embedding: number[];
  status: ProcessingStatus;
  error?: string;
  llm: CatalogItemLlm;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCatalogItemData {
  image: CatalogItemImage;
  llm?: Partial<CatalogItemLlm>;
}

export type UpdateCatalogItemData = Partial<
  Omit<CatalogItemDocument, '_id' | 'createdAt'>
>;

export function toCatalogItem(doc: CatalogItemDocument): CatalogItem {
  return {
    _id: doc._id.toHexString(),
    title: doc.title,
    description: doc.description,
    tags: doc.tags,
    image: doc.image,
    embedding: doc.embedding,
    status: doc.status,
    error: doc.error,
    llm: doc.llm,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
