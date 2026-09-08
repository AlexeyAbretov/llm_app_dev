/**
 * Проверка REST API items/search (без MongoDB — inject + моки).
 * Запуск: npm run test:api -w @llm-app/backend
 */
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import type { CatalogItem } from '@llm-app/shared';
import { itemsRoutes } from '../src/routes/items.js';
import { searchRoutes } from '../src/routes/search.js';
import { CatalogRepository } from '../src/repositories/catalogRepository.js';

const sampleItem: CatalogItem = {
  _id: '507f1f77bcf86cd799439011',
  title: 'Тестовая ваза',
  description: 'Описание',
  tags: ['ваза'],
  image: {
    storage: 'disk',
    ref: 'abc.jpg',
    mime: 'image/jpeg',
    originalName: 'test.jpg',
  },
  embedding: [0.1, 0.2],
  status: 'ready',
  llm: {
    visionModel: 'qwen2.5vl:7b',
    embedModel: 'nomic-embed-text',
    promptVersion: 'v1',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function minimalJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  const enqueued: Array<{ itemId: string }> = [];

  const mockRepo = {
    create: async () => ({
      ...sampleItem,
      _id: '507f1f77bcf86cd799439011',
      status: 'pending' as const,
      title: '',
      description: '',
      tags: [],
      embedding: [],
      image: {
        storage: 'disk' as const,
        ref: 'pending/upload',
        mime: 'image/jpeg',
        originalName: 'test.jpg',
      },
    }),
    findById: async (id: string) => (id === sampleItem._id ? sampleItem : null),
    findAll: async (page: number, limit: number) => ({
      items: [sampleItem],
      total: 1,
    }),
  } as unknown as CatalogRepository;

  app.decorate('catalogRepository', mockRepo);
  app.decorate('pipelineRunner', {
    enqueue(input: { itemId: string }) {
      enqueued.push(input);
    },
    drain: async () => {},
    pendingCount: () => enqueued.length,
  });

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(itemsRoutes);
  await app.register(searchRoutes);

  return { app, enqueued };
}

async function main(): Promise<void> {
  const { app, enqueued } = await buildTestApp();

  const jpeg = minimalJpeg();
  const boundary = '----testboundary';

  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="image"; filename="test.jpg"',
    'Content-Type: image/jpeg',
    '',
    jpeg.toString('binary'),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const upload = await app.inject({
    method: 'POST',
    url: '/api/items',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.from(multipartBody, 'binary'),
  });

  if (upload.statusCode !== 202) {
    throw new Error(`POST /api/items: ожидался 202, получено ${upload.statusCode}: ${upload.body}`);
  }

  const uploadJson = JSON.parse(upload.body) as { id: string; status: string };
  if (uploadJson.status !== 'pending' || !uploadJson.id) {
    throw new Error(`POST /api/items: неверное тело: ${upload.body}`);
  }
  console.log('POST /api/items → 202', uploadJson);

  const getById = await app.inject({
    method: 'GET',
    url: `/api/items/${sampleItem._id}`,
  });

  if (getById.statusCode !== 200) {
    throw new Error(`GET /api/items/:id: ${getById.statusCode}`);
  }

  const itemJson = JSON.parse(getById.body) as Record<string, unknown>;
  if ('embedding' in itemJson) {
    throw new Error('GET /api/items/:id: embedding не должен быть в ответе');
  }
  if (itemJson.imageUrl !== '/uploads/abc.jpg') {
    throw new Error(`GET /api/items/:id: imageUrl=${String(itemJson.imageUrl)}`);
  }
  console.log('GET /api/items/:id → 200, imageUrl ok');

  const notFound = await app.inject({
    method: 'GET',
    url: '/api/items/000000000000000000000000',
  });
  if (notFound.statusCode !== 404) {
    throw new Error(`GET missing: ожидался 404, получено ${notFound.statusCode}`);
  }
  console.log('GET /api/items/:id (missing) → 404');

  const list = await app.inject({
    method: 'GET',
    url: '/api/items?page=1&limit=20',
  });

  if (list.statusCode !== 200) {
    throw new Error(`GET /api/items: ${list.statusCode}`);
  }

  const listJson = JSON.parse(list.body) as {
    items: unknown[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
  if (!listJson.meta || listJson.meta.page !== 1 || listJson.meta.totalPages !== 1) {
    throw new Error(`GET /api/items: meta=${JSON.stringify(listJson.meta)}`);
  }
  console.log('GET /api/items → pagination meta ok');

  const search = await app.inject({
    method: 'GET',
    url: '/api/search?q=ваза',
  });
  if (search.statusCode !== 200) {
    throw new Error(`GET /api/search: ${search.statusCode}`);
  }
  const searchJson = JSON.parse(search.body) as { query: string; results: unknown[] };
  if (searchJson.query !== 'ваза' || searchJson.results.length !== 0) {
    throw new Error(`GET /api/search: ${search.body}`);
  }
  console.log('GET /api/search → placeholder ok');

  const badUpload = await app.inject({
    method: 'POST',
    url: '/api/items',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.from(
      [
        `--${boundary}`,
        'Content-Disposition: form-data; name="image"; filename="bad.txt"',
        'Content-Type: text/plain',
        '',
        'not an image',
        `--${boundary}--`,
        '',
      ].join('\r\n'),
      'binary',
    ),
  });
  if (badUpload.statusCode !== 400) {
    throw new Error(`POST invalid: ожидался 400, получено ${badUpload.statusCode}`);
  }
  console.log('POST invalid file → 400');

  if (enqueued.length !== 1) {
    throw new Error(`pipelineRunner.enqueue: ожидался 1 вызов, получено ${enqueued.length}`);
  }
  console.log('pipelineRunner.enqueue вызван');

  await app.close();
  console.log('\nГотово.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
