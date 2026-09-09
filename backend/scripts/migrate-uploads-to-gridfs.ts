/**
 * Перенос legacy disk-изображений из uploads/ в GridFS.
 * Запуск: npm run migrate-uploads-to-gridfs -w @llm-app/backend [--dry-run] [--delete-local]
 */
import { access, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { config, uploadDir } from '../src/config.js';
import { initImageStorage, save } from '../src/services/imageStorage.js';

interface CatalogImageDoc {
  storage: 'disk' | 'gridfs';
  ref: string;
  mime: string;
  originalName: string;
}

interface CatalogDoc {
  _id: { toString(): string };
  image: CatalogImageDoc;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const deleteLocal = process.argv.includes('--delete-local');

  const client = new MongoClient(config.MONGO_URI);
  await client.connect();
  const db = client.db();
  initImageStorage(db);

  const collection = db.collection<CatalogDoc>('catalog_items');
  const diskItems = await collection
    .find({ 'image.storage': 'disk', 'image.ref': { $not: /^pending\// } })
    .toArray();

  console.log(`Найдено disk-записей: ${diskItems.length}${dryRun ? ' (dry-run)' : ''}`);

  let migrated = 0;
  let failed = 0;

  for (const doc of diskItems) {
    const { ref, mime, originalName } = doc.image;
    const filePath = join(uploadDir, ref);

    try {
      await access(filePath);
    } catch {
      console.warn(`  SKIP ${doc._id}: файл не найден — ${ref}`);
      failed += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  DRY-RUN ${doc._id}: ${ref} → gridfs`);
      migrated += 1;
      continue;
    }

    const buffer = await readFile(filePath);
    const saved = await save({ buffer, mime, originalName });

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          'image.storage': 'gridfs',
          'image.ref': saved.ref,
        },
      },
    );

    console.log(`  OK ${doc._id}: ${ref} → ${saved.ref}`);
    migrated += 1;

    if (deleteLocal) {
      await unlink(filePath);
    }
  }

  let orphanCount = 0;
  try {
    const files = await readdir(uploadDir);
    const refsInDb = new Set(
      (await collection.find({ 'image.storage': 'disk' }).toArray()).map((d) => d.image.ref),
    );

    for (const file of files) {
      if (!refsInDb.has(file)) {
        console.warn(`  ORPHAN: ${file}`);
        orphanCount += 1;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await client.close();

  console.log(`\nМигрировано: ${migrated}, ошибок: ${failed}, orphan в uploads/: ${orphanCount}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
