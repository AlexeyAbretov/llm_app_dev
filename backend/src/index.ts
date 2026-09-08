import { mkdir } from 'node:fs/promises';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config, uploadDir } from './config.js';
import { createPipelineRunner } from './graph/runner.js';
import { registerCors } from './plugins/cors.js';
import { registerMongo } from './plugins/mongo.js';
import { healthRoutes } from './routes/health.js';
import { itemsRoutes } from './routes/items.js';
import { searchRoutes } from './routes/search.js';
import { generateEmbedding, translateSearchQuery } from './services/ollama.js';
import { nomicEmbedInput } from './services/nomic.js';

async function buildApp() {
  const app = Fastify({ logger: true });

  await registerCors(app);
  await registerMongo(app);

  app.decorate(
    'pipelineRunner',
    createPipelineRunner({
      repository: app.catalogRepository,
      log: app.log,
    }),
  );
  app.decorate('embedQuery', (englishQuery: string) =>
    generateEmbedding(nomicEmbedInput(englishQuery, 'query')),
  );
  app.decorate('translateQuery', translateSearchQuery);

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });
  await app.register(healthRoutes);
  await app.register(itemsRoutes);
  await app.register(searchRoutes);

  return app;
}

async function start() {
  await mkdir(uploadDir, { recursive: true });

  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
