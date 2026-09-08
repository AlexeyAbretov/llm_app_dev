import type { Db, MongoClient } from 'mongodb';
import type { CatalogRepository } from '../repositories/catalogRepository.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
    catalogRepository: CatalogRepository;
  }
}
