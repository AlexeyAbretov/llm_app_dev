import { mkdir } from 'node:fs/promises';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config, uploadDir } from './config.js';
import { registerCors } from './plugins/cors.js';
import { healthRoutes } from './routes/health.js';

async function buildApp() {
  const app = Fastify({ logger: true });

  await registerCors(app);
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
