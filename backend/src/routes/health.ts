import { MongoClient } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@llm-app/shared';
import { config } from '../config.js';

async function checkMongo(): Promise<boolean> {
  const client = new MongoClient(config.MONGO_URI, {
    serverSelectionTimeoutMS: 2000,
  });

  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => undefined);
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
    const [mongo, ollama] = await Promise.all([checkMongo(), checkOllama()]);

    return {
      status: mongo && ollama ? 'ok' : 'degraded',
      mongo,
      ollama,
    };
  });
}
