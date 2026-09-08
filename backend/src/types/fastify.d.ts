import type { Db, MongoClient } from 'mongodb';
import type { PipelineRunner } from '../graph/runner.js';
import type { CatalogRepository } from '../repositories/catalogRepository.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
    catalogRepository: CatalogRepository;
    pipelineRunner: PipelineRunner;
    embedQuery: (englishQuery: string) => Promise<number[]>;
    translateQuery: (query: string) => Promise<string>;
  }
}
