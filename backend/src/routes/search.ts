import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ApiError, SearchResponse } from '@llm-app/shared';

function sendError(reply: FastifyReply, status: 400 | 500, message: string) {
  return reply.code(status).send({ error: message } satisfies ApiError);
}

/** Заглушка поиска — полная реализация на этапе 9. */
export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string; limit?: string } }>(
    '/api/search',
    async (request, reply) => {
      const q = request.query.q?.trim() ?? '';

      if (!q) {
        return sendError(reply, 400, 'Параметр q обязателен');
      }

      const limitRaw = request.query.limit;
      if (limitRaw !== undefined && limitRaw !== '') {
        const limit = Number.parseInt(limitRaw, 10);
        if (!Number.isFinite(limit) || limit < 1) {
          return sendError(reply, 400, 'Параметр limit должен быть положительным числом');
        }
      }

      const body: SearchResponse = {
        query: q,
        results: [],
      };

      return reply.send(body);
    },
  );
}
