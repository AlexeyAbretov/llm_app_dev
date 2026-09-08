import { MongoClient } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { CatalogRepository } from '../repositories/catalogRepository.js';
import { ensureCatalogIndexes } from '../repositories/indexes.js';

export async function registerMongo(app: FastifyInstance): Promise<void> {
  const client = new MongoClient(config.MONGO_URI);
  await client.connect();

  const db = client.db();

  app.decorate('mongo', { client, db });
  app.decorate('catalogRepository', new CatalogRepository(db));

  await ensureCatalogIndexes(db);

  app.addHook('onClose', async () => {
    await client.close();
  });
}
