/**
 * Проверка LangGraph-пайплайна каталога.
 * Запуск: npm run test:pipeline -w @llm-app/backend
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { config } from '../src/config.js';
import { runCatalogPipeline } from '../src/graph/catalogPipeline.js';
import { createPipelineRunner } from '../src/graph/runner.js';
import { CatalogRepository } from '../src/repositories/catalogRepository.js';
import { ensureCatalogIndexes } from '../src/repositories/indexes.js';
import { checkHealth } from '../src/services/ollama.js';
import { detectImageMime } from '../src/graph/nodes/validate.js';
import { parseVisionResponse } from '../src/services/llmParser.js';

const monorepoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function logSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function pollUntilReady(
  repo: CatalogRepository,
  id: string,
  timeoutMs = 120_000,
): Promise<'ready' | 'failed'> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const item = await repo.findById(id);
    if (!item) {
      throw new Error(`Документ ${id} не найден`);
    }
    if (item.status === 'ready' || item.status === 'failed') {
      return item.status;
    }
    await sleep(500);
  }

  throw new Error(`Таймаут ожидания статуса для ${id}`);
}

async function testInvalidFile(repo: CatalogRepository): Promise<void> {
  logSection('Невалидный файл → failed');

  const created = await repo.create({
    image: {
      storage: 'disk',
      ref: 'pending/invalid.txt',
      mime: 'text/plain',
      originalName: 'invalid.txt',
    },
  });

  await runCatalogPipeline(
    { repository: repo },
    {
      itemId: created._id,
      buffer: Buffer.from('not an image'),
      mime: 'text/plain',
      originalName: 'invalid.txt',
    },
  );

  const item = await repo.findById(created._id);
  if (!item || item.status !== 'failed') {
    throw new Error(`Ожидался status failed, получено: ${item?.status}`);
  }
  if (!item.error) {
    throw new Error('Ожидалось сообщение error');
  }

  console.log('status:', item.status);
  console.log('error:', item.error);
}

async function testRetryWithMock(repo: CatalogRepository): Promise<void> {
  logSection('Retry: битый JSON → повтор vision → ready');

  let calls = 0;
  const validJson = JSON.stringify({
    title: 'Тестовая ваза',
    description: 'Керамическая ваза для проверки retry.',
    tags: ['ваза', 'керамика', 'тест'],
  });

  const created = await repo.create({
    image: {
      storage: 'disk',
      ref: 'pending/retry.jpg',
      mime: 'image/jpeg',
      originalName: 'retry.jpg',
    },
  });

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

  await runCatalogPipeline(
    {
      repository: repo,
      ollama: {
        generateFromImage: async () => {
          calls += 1;
          if (calls === 1) {
            return '{ broken json';
          }
          return validJson;
        },
        generateEmbedding: async () => Array.from({ length: 768 }, (_, i) => i / 768),
      },
    },
    {
      itemId: created._id,
      buffer: jpegHeader,
      mime: 'image/jpeg',
      originalName: 'retry.jpg',
    },
  );

  const item = await repo.findById(created._id);
  if (!item || item.status !== 'ready') {
    throw new Error(`Ожидался ready после retry, получено: ${item?.status} (${item?.error})`);
  }
  if (calls < 2) {
    throw new Error(`Ожидался повторный вызов vision, calls=${calls}`);
  }

  console.log('vision calls:', calls);
  console.log('title:', item.title);
}

async function testHappyPathE2E(
  repo: CatalogRepository,
  imagePath: string,
): Promise<void> {
  logSection('E2E: тестовое фото → ready');

  const healthy = await checkHealth();
  if (!healthy) {
    console.log('Ollama недоступен — пропуск E2E (нужен локальный ollama serve + модели)');
    return;
  }

  const buffer = await readFile(imagePath);
  const mime = detectImageMime(buffer);
  if (!mime) {
    throw new Error(
      `E2E: файл не jpeg/png/webp (часто .jpg оказывается webp). Путь: ${imagePath}`,
    );
  }

  const created = await repo.create({
    image: {
      storage: 'disk',
      ref: 'pending/e2e.jpg',
      mime,
      originalName: 'test.jpg',
    },
  });

  const runner = createPipelineRunner({ repository: repo });
  runner.enqueue({
    itemId: created._id,
    buffer,
    mime,
    originalName: 'test.jpg',
  });

  await runner.drain();
  const status = await pollUntilReady(repo, created._id);

  if (status !== 'ready') {
    const item = await repo.findById(created._id);
    throw new Error(`E2E: ожидался ready, получено ${status}: ${item?.error}`);
  }

  const item = await repo.findById(created._id);
  if (!item?.title || !item.description || !item.tags.length || !item.embedding.length) {
    throw new Error('E2E: не все поля заполнены');
  }

  console.log('status:', item.status);
  console.log('title:', item.title);
  console.log('tags:', item.tags.join(', '));
  console.log('embedding.length:', item.embedding.length);
}

async function testParserReference(): Promise<void> {
  logSection('Parser sanity (markdown JSON)');

  const parsed = parseVisionResponse(`\`\`\`json
{"title":"V","description":"D","tags":["a","b","c"]}
\`\`\``);
  console.log('parseVisionResponse ok:', parsed.title);

  const spaced = parseVisionResponse(
    '{"title":"V","description":"D","tags":["Красные губы","Обезьяна","портрет"]}',
  );
  if (spaced.tags.join(',') !== 'красные-губы,обезьяна,портрет') {
    throw new Error(`normalize tags: ${spaced.tags.join(',')}`);
  }
}

async function main(): Promise<void> {
  testParserReference();

  const client = new MongoClient(config.MONGO_URI);
  await client.connect();
  const db = client.db();
  await ensureCatalogIndexes(db);
  const repo = new CatalogRepository(db);

  try {
    await testInvalidFile(repo);
    await testRetryWithMock(repo);

    const imageArg = process.argv[2] ?? 'test.jpg';
    const imagePath = resolve(process.cwd(), imageArg);

    try {
      await readFile(imagePath);
      await testHappyPathE2E(repo, imagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`\nФайл ${imageArg} не найден — E2E пропущен (положите test.jpg для полной проверки)`);
      } else {
        throw error;
      }
    }
  } finally {
    await client.close();
  }

  console.log('\nГотово.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
