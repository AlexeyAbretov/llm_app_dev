/**
 * Ручная проверка CatalogRepository: insert → find → update → pagination.
 * Запуск: npm run test:catalog-repo -w @llm-app/backend
 */
import { MongoClient } from 'mongodb';
import { config } from '../src/config.js';
import { CatalogRepository } from '../src/repositories/catalogRepository.js';
import { ensureCatalogIndexes } from '../src/repositories/indexes.js';

async function main() {
  const client = new MongoClient(config.MONGO_URI);
  await client.connect();

  const db = client.db();
  await ensureCatalogIndexes(db);

  const repo = new CatalogRepository(db);

  const created = await repo.create({
    image: {
      storage: 'gridfs',
      ref: 'test/sample.jpg',
      mime: 'image/jpeg',
      originalName: 'sample.jpg',
    },
  });

  console.log('create:', created._id, created.status);

  const found = await repo.findById(created._id);
  if (!found || found._id !== created._id) {
    throw new Error('findById не вернул созданный документ');
  }
  console.log('findById: ok');

  const updated = await repo.update(created._id, {
    title: 'Тестовая ваза',
    description: 'Керамическая ваза для проверки репозитория',
    tags: ['ваза', 'керамика'],
    status: 'ready',
    embedding: Array.from({ length: 768 }, (_, i) => i / 768),
  });

  if (!updated || updated.status !== 'ready') {
    throw new Error('update не обновил документ');
  }
  console.log('update:', updated.title, updated.status);

  const withUserTags = await repo.update(created._id, {
    userTags: ['коллекция', 'любимое'],
  });
  if (!withUserTags || withUserTags.userTags.length !== 2) {
    throw new Error('update userTags не сохранил теги');
  }
  console.log('update userTags:', withUserTags.userTags.join(', '));

  for (let i = 0; i < 3; i++) {
    const item = await repo.create({
      image: {
        storage: 'gridfs',
        ref: `test/page-${i}.jpg`,
        mime: 'image/jpeg',
        originalName: `page-${i}.jpg`,
      },
    });
    await repo.update(item._id, {
      title: `Объект ${i + 1}`,
      status: 'ready',
    });
  }

  const page1 = await repo.findAll(1, 2);
  const page2 = await repo.findAll(2, 2);

  if (page1.items.length !== 2 || page1.total < 4) {
    throw new Error(`pagination page1: items=${page1.items.length}, total=${page1.total}`);
  }
  if (page2.items.length < 1) {
    throw new Error(`pagination page2: items=${page2.items.length}`);
  }
  console.log('pagination: page1=', page1.items.length, 'total=', page1.total);
  console.log('pagination: page2=', page2.items.length);

  const withEmbeddings = await repo.findAllWithEmbeddings();
  if (!withEmbeddings.some((item) => item._id === created._id)) {
    throw new Error('findAllWithEmbeddings не вернул документ с embedding');
  }
  console.log('findAllWithEmbeddings:', withEmbeddings.length, 'items');

  const indexes = await db.collection('catalog_items').indexes();
  const hasTextIndex = indexes.some((idx) =>
    Object.values(idx.key ?? {}).includes('text'),
  );
  if (!hasTextIndex) {
    throw new Error('text index не найден');
  }
  console.log('text index: ok');

  await client.close();
  console.log('Все проверки пройдены');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
