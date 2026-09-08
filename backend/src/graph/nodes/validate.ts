import {
  ALLOWED_MIMES,
  MAX_FILE_SIZE_BYTES,
  type PipelineDeps,
} from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

function hasJpegMagic(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasPngMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function hasWebpMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

function matchesMagicBytes(buffer: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
      return hasJpegMagic(buffer);
    case 'image/png':
      return hasPngMagic(buffer);
    case 'image/webp':
      return hasWebpMagic(buffer);
    default:
      return false;
  }
}

export function createValidateNode(deps: PipelineDeps) {
  return async function validate(state: PipelineGraphState): Promise<Partial<PipelineGraphState>> {
    const { itemId, fileBuffer, mime } = state;

    try {
      if (!ALLOWED_MIMES.has(mime)) {
        throw new Error(`Недопустимый MIME: ${mime}`);
      }

      if (fileBuffer.length === 0) {
        throw new Error('Пустой файл');
      }

      if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
        throw new Error('Файл больше 10 MB');
      }

      if (!matchesMagicBytes(fileBuffer, mime)) {
        throw new Error('Содержимое файла не соответствует заявленному формату');
      }

      logNode(deps, itemId, 'validate', 'ok');
      return { error: undefined, failedStep: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'validate', 'error', message);
      return { error: message, failedStep: 'validate' };
    }
  };
}
