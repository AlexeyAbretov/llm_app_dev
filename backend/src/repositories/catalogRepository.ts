import { ObjectId, type Collection, type Db } from 'mongodb';
import type { CatalogItem } from '@llm-app/shared';
import { config } from '../config.js';
import {
  toCatalogItem,
  type CatalogItemDocument,
  type CreateCatalogItemData,
  type UpdateCatalogItemData,
} from '../models/catalogItem.js';

const COLLECTION = 'catalog_items';

export class CatalogRepository {
  private readonly collection: Collection<CatalogItemDocument>;

  constructor(db: Db) {
    this.collection = db.collection<CatalogItemDocument>(COLLECTION);
  }

  async create(data: CreateCatalogItemData): Promise<CatalogItem> {
    const now = new Date();

    const doc: Omit<CatalogItemDocument, '_id'> = {
      title: '',
      description: '',
      tags: [],
      image: data.image,
      embedding: [],
      status: 'pending',
      llm: {
        visionModel: config.OLLAMA_VISION_MODEL,
        embedModel: config.OLLAMA_EMBED_MODEL,
        promptVersion: 'v1',
        ...data.llm,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(doc as CatalogItemDocument);
    return toCatalogItem({ _id: result.insertedId, ...doc });
  }

  async findById(id: string): Promise<CatalogItem | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? toCatalogItem(doc) : null;
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ items: CatalogItem[]; total: number }> {
    const filter = { status: 'ready' as const };
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return {
      items: docs.map(toCatalogItem),
      total,
    };
  }

  async update(
    id: string,
    partial: UpdateCatalogItemData,
  ): Promise<CatalogItem | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...partial, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return doc ? toCatalogItem(doc) : null;
  }

  async findAllWithEmbeddings(): Promise<CatalogItem[]> {
    const docs = await this.collection
      .find({
        status: 'ready',
        embedding: { $exists: true, $not: { $size: 0 } },
      })
      .toArray();

    return docs.map(toCatalogItem);
  }
}
