import type { FastifyInstance, FastifyReply } from 'fastify';
import type {
  ApiError,
  CreateItemResponse,
  GetItemResponse,
  ListItemsResponse,
} from '@llm-app/shared';
import {
  ALLOWED_MIMES,
  MAX_FILE_SIZE_BYTES,
} from '../graph/deps.js';
import { detectImageMime } from '../graph/nodes/validate.js';
import { toPublicItem } from '../utils/toPublicItem.js';

function sendError(reply: FastifyReply, status: 400 | 404 | 500, message: string) {
  return reply.code(status).send({ error: message } satisfies ApiError);
}

function parsePositiveInt(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export async function itemsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/items', async (request, reply) => {
    let data;
    try {
      data = await request.file();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('file too large') || message.includes('limit')) {
        return sendError(reply, 400, 'Файл больше 10 MB');
      }
      request.log.error(error);
      return sendError(reply, 500, 'Ошибка загрузки файла');
    }

    if (!data || data.fieldname !== 'image') {
      return sendError(reply, 400, 'Ожидается multipart-поле image');
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (error) {
      request.log.error(error);
      return sendError(reply, 500, 'Ошибка чтения файла');
    }

    if (buffer.length === 0) {
      return sendError(reply, 400, 'Пустой файл');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return sendError(reply, 400, 'Файл больше 10 MB');
    }

    const declaredMime = data.mimetype;
    const detectedMime = detectImageMime(buffer);
    const mime = detectedMime ?? declaredMime;

    if (!ALLOWED_MIMES.has(mime)) {
      return sendError(
        reply,
        400,
        'Допустимы только изображения JPEG, PNG или WebP',
      );
    }

    if (!detectedMime || detectedMime !== mime) {
      return sendError(
        reply,
        400,
        'Содержимое файла не соответствует заявленному формату',
      );
    }

    const originalName = data.filename || 'upload.jpg';

    try {
      const created = await app.catalogRepository.create({
        image: {
          storage: 'disk',
          ref: 'pending/upload',
          mime,
          originalName,
        },
      });

      app.pipelineRunner.enqueue({
        itemId: created._id,
        buffer,
        mime,
        originalName,
      });

      const body: CreateItemResponse = {
        id: created._id,
        status: created.status,
      };

      return reply.code(202).send(body);
    } catch (error) {
      request.log.error(error);
      return sendError(reply, 500, 'Не удалось создать объект');
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/items/:id',
    async (request, reply) => {
      try {
        const item = await app.catalogRepository.findById(request.params.id);
        if (!item) {
          return sendError(reply, 404, 'Объект не найден');
        }

        return reply.send(toPublicItem(item) satisfies GetItemResponse);
      } catch (error) {
        request.log.error(error);
        return sendError(reply, 500, 'Ошибка получения объекта');
      }
    },
  );

  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/api/items',
    async (request, reply) => {
      const page = parsePositiveInt(request.query.page, 1);
      const limit = parsePositiveInt(request.query.limit, 20);

      if (page === null || limit === null) {
        return sendError(reply, 400, 'Параметры page и limit должны быть положительными числами');
      }

      const cappedLimit = Math.min(limit, 100);

      try {
        const { items, total } = await app.catalogRepository.findAll(page, cappedLimit);
        const totalPages = total === 0 ? 0 : Math.ceil(total / cappedLimit);

        const body: ListItemsResponse = {
          items: items.map(toPublicItem),
          meta: {
            page,
            limit: cappedLimit,
            total,
            totalPages,
          },
        };

        return reply.send(body);
      } catch (error) {
        request.log.error(error);
        return sendError(reply, 500, 'Ошибка получения списка');
      }
    },
  );
}
