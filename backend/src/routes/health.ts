import type { MongoClient } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@llm-app/shared';
import { config } from '../config.js';

async function checkMongo(client: MongoClient): Promise<boolean> {
  try {
    await client.db().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

async function checkOllama(): Promise<boolean> {
  try {
    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (): Promise<HealthResponse> => {
    const [mongo, ollama] = await Promise.all([
      checkMongo(app.mongo.client),
      checkOllama(),
    ]);

    return {
      status: mongo && ollama ? 'ok' : 'degraded',
      mongo,
      ollama,
    };
  });
}
