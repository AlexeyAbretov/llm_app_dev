import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv();

const envSchema = z.object({
  MONGO_URI: z.string().default('mongodb://localhost:27017/catalog'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_VISION_MODEL: z.string().default('qwen2.5vl:7b'),
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
