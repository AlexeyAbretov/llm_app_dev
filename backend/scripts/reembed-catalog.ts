/**
 * Пересчитать embedding ready-объектов из скрытого английского embedText.
 * Старые карточки без embedText пропускаются — нужен повторный vision (перезагрузка фото).
 * Нужны MongoDB и ollama serve.
 * Запуск: npm run reembed-catalog -w @llm-app/backend
 */
import { MongoClient } from 'mongodb';
import { config } from '../src/config.js';
import { CatalogRepository } from '../src/repositories/catalogRepository.js';
import { nomicEmbedInput } from '../src/services/nomic.js';
import { generateEmbedding } from '../src/services/ollama.js';

async function main(): Promise<void> {
  const client = new MongoClient(config.MONGO_URI);
  await client.connect();

  const repo = new CatalogRepository(client.db());
  const items = await repo.findAllWithEmbeddings();

  console.log(`Каталог: ${items.length} объектов с embedding`);

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.embedText?.trim()) {
      skipped += 1;
      console.warn(
        `skip ${item._id} (${item.title || 'без title'}): нет embedText — перезалейте фото`,
      );
      continue;
    }

    const embedding = await generateEmbedding(nomicEmbedInput(item.embedText, 'document'));
    const saved = await repo.update(item._id, { embedding });
    if (!saved) {
      throw new Error(`Не удалось обновить ${item._id}`);
    }
    updated += 1;
    console.log(`${updated}/${items.length} ${item.title || item._id} dims=${embedding.length}`);
  }

  await client.close();
  console.log(`Готово: переэмбеддено ${updated}, пропущено ${skipped}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
