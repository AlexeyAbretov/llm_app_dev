import type { Db } from 'mongodb';

const COLLECTION = 'catalog_items';

export async function ensureCatalogIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION);

  try {
    await collection.dropIndex('text_search');
  } catch {
    // индекс ещё не создан или другое имя
  }

  await collection.createIndexes([
    {
      key: {
        title: 'text',
        description: 'text',
        tags: 'text',
        userTags: 'text',
        embedText: 'text',
      },
      name: 'text_search',
      default_language: 'none',
    },
    { key: { status: 1, createdAt: -1 } },
    { key: { status: 1, tags: 1 } },
    { key: { status: 1, userTags: 1 } },
    { key: { createdAt: -1 } },
  ]);
}
