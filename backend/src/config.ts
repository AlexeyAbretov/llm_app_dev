import { config as loadEnv } from 'dotenv';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const monorepoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

loadEnv({ path: resolve(monorepoRoot, '.env') });
loadEnv();

const envSchema = z.object({
  MONGO_URI: z.string().default('mongodb://localhost:27017/catalog'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_VISION_MODEL: z.string().default('qwen2.5vl:7b'),
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text'),
  OLLAMA_TRANSLATE_MODEL: z.string().default('qwen2.5:0.5b'),
  /** Только для migrate-uploads-to-gridfs (legacy disk). */
  UPLOAD_DIR: z.string().default('./uploads'),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);

/** Абсолютный путь к каталогу загрузок (относительный UPLOAD_DIR — от корня monorepo). */
export const uploadDir = isAbsolute(config.UPLOAD_DIR)
  ? config.UPLOAD_DIR
  : resolve(monorepoRoot, config.UPLOAD_DIR);
