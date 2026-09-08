import type { CatalogRepository } from '../repositories/catalogRepository.js';
import type {
  generateEmbedding,
  generateFromImage,
} from '../services/ollama.js';
import type { save } from '../services/imageStorage.js';

export interface PipelineLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface PipelineOllama {
  generateFromImage: typeof generateFromImage;
  generateEmbedding: typeof generateEmbedding;
}

export interface PipelineImageStorage {
  save: typeof save;
}

export interface PipelineDeps {
  repository: CatalogRepository;
  log?: PipelineLogger;
  ollama?: PipelineOllama;
  imageStorage?: PipelineImageStorage;
}

export interface PipelineInput {
  itemId: string;
  buffer: Buffer;
  mime: string;
  originalName: string;
}

export const MAX_VISION_RETRIES = 2;
export const MAX_PARSE_RETRIES = 1;
export const MAX_EMBED_RETRIES = 2;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
