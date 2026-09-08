import type { Db } from 'mongodb';

const COLLECTION = 'catalog_items';

export async function ensureCatalogIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION);

  await collection.createIndexes([
    {
      key: { title: 'text', description: 'text', tags: 'text' },
      name: 'text_search',
    },
    { key: { status: 1, createdAt: -1 } },
    { key: { createdAt: -1 } },
  ]);
}
