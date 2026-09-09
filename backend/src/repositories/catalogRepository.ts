import { ObjectId, type Collection, type Db } from 'mongodb';
import type { CatalogItem } from '@llm-app/shared';
import { config } from '../config.js';
import {
  toCatalogItem,
  type CatalogItemDocument,
  type CreateCatalogItemData,
  type UpdateCatalogItemData,
} from '../models/catalogItem.js';
import { PROMPT_VERSION } from '../prompts/visionV1.js';

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
      userTags: [],
      embedText: '',
      image: data.image,
      embedding: [],
      status: 'pending',
      llm: {
        visionModel: config.OLLAMA_VISION_MODEL,
        embedModel: config.OLLAMA_EMBED_MODEL,
        promptVersion: PROMPT_VERSION,
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
    filterTags?: string[],
  ): Promise<{ items: CatalogItem[]; total: number }> {
    const filter: {
      status: 'ready';
      $or?: Array<{ tags: { $in: string[] } } | { userTags: { $in: string[] } }>;
    } = {
      status: 'ready',
    };

    if (filterTags?.length) {
      filter.$or = [
        { tags: { $in: filterTags } },
        { userTags: { $in: filterTags } },
      ];
    }
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

  /** Уникальные теги ready-объектов: LLM (`tags`) + пользовательские (`userTags`). */
  async findDistinctTags(): Promise<string[]> {
    const docs = await this.collection
      .aggregate<{ _id: string }>([
        { $match: { status: 'ready' } },
        {
          $project: {
            allTags: {
              $concatArrays: ['$tags', { $ifNull: ['$userTags', []] }],
            },
          },
        },
        { $unwind: '$allTags' },
        { $group: { _id: '$allTags' } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    return docs.map((doc) => doc._id);
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

  /** Успешное завершение пайплайна: ready + сброс error. */
  async markReady(
    id: string,
    partial: Omit<UpdateCatalogItemData, 'status' | 'error'>,
  ): Promise<CatalogItem | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: { ...partial, status: 'ready', updatedAt: new Date() },
        $unset: { error: '' },
      },
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

  /** Keyword-поиск через MongoDB $text (только ready). */
  async textSearch(
    query: string,
  ): Promise<Array<{ id: string; textScore: number }>> {
    const docs = await this.collection
      .find(
        {
          $text: { $search: query },
          status: 'ready' as const,
        },
        {
          projection: {
            score: { $meta: 'textScore' },
          },
        },
      )
      .toArray();

    return docs.map((doc) => {
      const withScore = doc as typeof doc & { score?: number };
      return {
        id: doc._id.toString(),
        textScore: typeof withScore.score === 'number' ? withScore.score : 0,
      };
    });
  }
}
