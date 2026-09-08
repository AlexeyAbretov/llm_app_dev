import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, SearchResponse } from '@llm-app/shared';
import { hybridSearch } from '../services/search.js';
import { toPublicItem } from '../utils/toPublicItem.js';

function sendError(reply: FastifyReply, status: 400 | 500 | 503, message: string) {
  return reply.code(status).send({ error: message } satisfies ApiError);
}

function parseLimit(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string; limit?: string } }>(
    '/api/search',
    async (request, reply) => {
      const q = request.query.q?.trim() ?? '';

      if (!q) {
        return sendError(reply, 400, 'Параметр q обязателен');
      }

      const limitRaw = parseLimit(request.query.limit, 20);
      if (limitRaw === null) {
        return sendError(reply, 400, 'Параметр limit должен быть положительным числом');
      }

      const limit = Math.min(limitRaw, 100);

      try {
        const hits = await hybridSearch(q, {
          repository: app.catalogRepository,
          embedQuery: app.embedQuery,
          translateQuery: app.translateQuery,
          limit,
        });

        const body: SearchResponse = {
          query: q,
          results: hits.map(({ item, score }) => ({
            item: toPublicItem(item),
            score,
          })),
        };

        return reply.send(body);
      } catch (error) {
        request.log.error(error);
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('Ollama') ||
          message.includes('embed') ||
          message.includes('translate')
        ) {
          return sendError(reply, 503, 'Сервис embeddings недоступен');
        }
        return sendError(reply, 500, 'Ошибка поиска');
      }
    },
  );
}
