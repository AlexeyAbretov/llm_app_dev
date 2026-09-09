import type { FastifyInstance, FastifyReply } from 'fastify';
import type {
  ApiError,
  CreateItemResponse,
  GetItemResponse,
  ListItemsResponse,
  TagsListResponse,
  UpdateUserTagsRequest,
  UpdateUserTagsResponse,
} from '@llm-app/shared';
import {
  normalizeFilterTags,
  parseTagsQueryParam,
} from '../utils/tagFilter.js';
import {
  ALLOWED_MIMES,
  MAX_FILE_SIZE_BYTES,
} from '../graph/deps.js';
import { detectImageMime } from '../graph/nodes/validate.js';
import {
  openDownloadStream,
  readLegacyDiskBuffer,
} from '../services/imageStorage.js';
import {
  updateUserTagsBodySchema,
  validateUserTags,
} from '../schemas/userTags.js';
import { toPublicItem } from '../utils/toPublicItem.js';

function sendError(
  reply: FastifyReply,
  status: 400 | 404 | 409 | 500,
  message: string,
) {
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
          storage: 'gridfs',
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

  app.get('/api/tags', async (request, reply) => {
    try {
      const tags = await app.catalogRepository.findDistinctTags();
      const body: TagsListResponse = { tags };
      return reply.send(body);
    } catch (error) {
      request.log.error(error);
      return sendError(reply, 500, 'Ошибка получения списка тегов');
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/items/:id/image',
    async (request, reply) => {
      try {
        const item = await app.catalogRepository.findById(request.params.id);
        if (!item) {
          return sendError(reply, 404, 'Объект не найден');
        }

        const { storage, ref, mime } = item.image;
        if (!ref || ref.startsWith('pending/')) {
          return sendError(reply, 404, 'Изображение ещё не готово');
        }

        if (storage === 'gridfs') {
          try {
            const stream = openDownloadStream(ref);
            return reply.type(mime).send(stream);
          } catch {
            return sendError(reply, 404, 'Файл изображения не найден');
          }
        }

        if (storage === 'disk') {
          try {
            const buffer = await readLegacyDiskBuffer(ref);
            return reply.type(mime).send(buffer);
          } catch {
            return sendError(reply, 404, 'Файл изображения не найден');
          }
        }

        return sendError(reply, 404, 'Изображение не найдено');
      } catch (error) {
        request.log.error(error);
        return sendError(reply, 500, 'Ошибка получения изображения');
      }
    },
  );

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

  app.patch<{ Params: { id: string }; Body: UpdateUserTagsRequest }>(
    '/api/items/:id/user-tags',
    async (request, reply) => {
      const parsed = updateUserTagsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'Некорректное тело запроса');
      }

      try {
        const item = await app.catalogRepository.findById(request.params.id);
        if (!item) {
          return sendError(reply, 404, 'Объект не найден');
        }

        if (item.status !== 'ready') {
          return sendError(
            reply,
            409,
            'Пользовательские теги доступны только после обработки объекта',
          );
        }

        const validation = validateUserTags(parsed.data.userTags, item.tags);
        if (!validation.ok) {
          return sendError(reply, 400, validation.error);
        }

        const updated = await app.catalogRepository.update(request.params.id, {
          userTags: validation.userTags,
        });

        if (!updated) {
          return sendError(reply, 404, 'Объект не найден');
        }

        return reply.send(toPublicItem(updated) satisfies UpdateUserTagsResponse);
      } catch (error) {
        request.log.error(error);
        return sendError(reply, 500, 'Ошибка обновления тегов');
      }
    },
  );

  app.get<{
    Querystring: { page?: string; limit?: string; tags?: string | string[] };
  }>('/api/items', async (request, reply) => {
      const page = parsePositiveInt(request.query.page, 1);
      const limit = parsePositiveInt(request.query.limit, 20);

      if (page === null || limit === null) {
        return sendError(reply, 400, 'Параметры page и limit должны быть положительными числами');
      }

      const rawTags = parseTagsQueryParam(request.query.tags);
      const filterTags = normalizeFilterTags(rawTags);
      if (filterTags === null) {
        return sendError(reply, 400, 'Некорректный формат тега в параметре tags');
      }

      const cappedLimit = Math.min(limit, 100);

      try {
        const { items, total } = await app.catalogRepository.findAll(
          page,
          cappedLimit,
          filterTags.length ? filterTags : undefined,
        );
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
