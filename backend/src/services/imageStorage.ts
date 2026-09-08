import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { uploadDir } from '../config.js';

export interface SaveImageInput {
  buffer: Buffer;
  mime: string;
  originalName: string;
}

export interface SavedImage {
  /** Относительное имя файла в uploadDir */
  ref: string;
  mime: string;
  originalName: string;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function resolveExtension(mime: string, originalName: string): string {
  const fromMime = MIME_EXTENSION[mime];
  if (fromMime) {
    return fromMime;
  }

  const fromName = extname(originalName).toLowerCase();
  if (fromName) {
    return fromName;
  }

  return '.jpg';
}

/** Сохраняет изображение на диск, возвращает относительный ref. */
export async function save(input: SaveImageInput): Promise<SavedImage> {
  const extension = resolveExtension(input.mime, input.originalName);
  const ref = `${randomUUID()}${extension}`;
  const absolutePath = join(uploadDir, ref);

  await writeFile(absolutePath, input.buffer);

  return {
    ref,
    mime: input.mime,
    originalName: input.originalName,
  };
}

/** URL для frontend (согласовано с @fastify/static prefix /uploads/). */
export function getUrl(ref: string): string {
  return `/uploads/${ref}`;
}
