import { ObjectId, type GridFSBucket } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { uploadDir } from '../config.js';
import { createGridFSBucket } from './gridfs.js';

export interface SaveImageInput {
  buffer: Buffer;
  mime: string;
  originalName: string;
}

export interface SavedImage {
  /** GridFS file id (ObjectId string) */
  ref: string;
  mime: string;
  originalName: string;
}

let bucket: GridFSBucket | null = null;

export function initImageStorage(db: Parameters<typeof createGridFSBucket>[0]): void {
  bucket = createGridFSBucket(db);
}

function requireBucket(): GridFSBucket {
  if (!bucket) {
    throw new Error('imageStorage не инициализирован (вызовите initImageStorage)');
  }
  return bucket;
}

function parseObjectId(ref: string): ObjectId {
  if (!ObjectId.isValid(ref)) {
    throw new Error(`Некорректный GridFS ref: ${ref}`);
  }
  return new ObjectId(ref);
}

/** Сохраняет изображение в GridFS, возвращает id файла. */
export async function save(input: SaveImageInput): Promise<SavedImage> {
  const gfs = requireBucket();
  const uploadStream = gfs.openUploadStream(input.originalName, {
    metadata: {
      mime: input.mime,
      originalName: input.originalName,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve());
    uploadStream.end(input.buffer);
  });

  return {
    ref: uploadStream.id.toString(),
    mime: input.mime,
    originalName: input.originalName,
  };
}

export function openDownloadStream(ref: string): Readable {
  return requireBucket().openDownloadStream(parseObjectId(ref));
}

export async function readBuffer(ref: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = openDownloadStream(ref);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return Buffer.concat(chunks);
}

/** Legacy disk: чтение файла из uploadDir (миграция и старые записи). */
export async function readLegacyDiskBuffer(ref: string): Promise<Buffer> {
  return readFile(join(uploadDir, ref));
}

/** URL для frontend — stream через API. */
export function getUrl(itemId: string): string {
  return `/api/items/${itemId}/image`;
}
