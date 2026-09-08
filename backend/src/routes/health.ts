import type { MongoClient } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@llm-app/shared';
import { checkHealth } from '../services/ollama.js';

async function checkMongo(client: MongoClient): Promise<boolean> {
  try {
    await client.db().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (): Promise<HealthResponse> => {
    const [mongo, ollama] = await Promise.all([
      checkMongo(app.mongo.client),
      checkHealth(),
    ]);

    return {
      status: mongo && ollama ? 'ok' : 'degraded',
      mongo,
      ollama,
    };
  });
}
