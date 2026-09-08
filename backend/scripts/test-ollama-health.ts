/**
 * Unit-тест checkHealth() с моком fetch (без живого Ollama).
 * Запуск: npm run test:ollama-health -w @llm-app/backend
 */
import { checkHealth } from '../src/services/ollama.js';

type FetchFn = typeof fetch;

function mockTagsResponse(models: string[]): Response {
  return {
    ok: true,
    json: async () => ({ models: models.map((name) => ({ name })) }),
  } as Response;
}

async function withMockFetch(
  mock: FetchFn,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

async function assertCheckHealth(
  models: string[],
  expected: boolean,
  label: string,
): Promise<void> {
  await withMockFetch(
    async () => mockTagsResponse(models),
    async () => {
      const result = await checkHealth();
      if (result !== expected) {
        throw new Error(`${label}: ожидалось ${expected}, получено ${result}`);
      }
    },
  );
}

async function main(): Promise<void> {
  await assertCheckHealth(
    ['qwen2.5vl:7b', 'nomic-embed-text', 'qwen2.5:0.5b'],
    true,
    'три модели в tags',
  );

  await assertCheckHealth(
    ['qwen2.5vl:7b', 'nomic-embed-text'],
    false,
    'нет translate-модели',
  );

  await withMockFetch(
    async () => ({ ok: false }) as Response,
    async () => {
      if (await checkHealth()) {
        throw new Error('Ollama недоступен: ожидалось false');
      }
    },
  );

  console.log('test:ollama-health ok');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
