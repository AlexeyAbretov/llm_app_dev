import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { VISION_PROMPT_V1 } from '../prompts/visionV1.js';

const VISION_TIMEOUT_MS = 120_000;
const EMBED_TIMEOUT_MS = 30_000;

/** Mutex: только одна vision-задача одновременно (P6). */
let visionMutex: Promise<unknown> = Promise.resolve();

async function withVisionMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = visionMutex.then(fn);
  visionMutex = run.catch(() => undefined);
  return run;
}

async function ollamaFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const response = await fetch(`${config.OLLAMA_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama ${path} → ${response.status}: ${body || response.statusText}`);
  }

  return response;
}

/** Ping Ollama через GET /api/tags. */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface ChatResponse {
  message?: {
    content?: string;
  };
}

/** Vision LLM: POST /api/chat с base64-изображением. */
export async function generateFromImage(
  imagePath: string,
  prompt: string = VISION_PROMPT_V1,
): Promise<string> {
  return withVisionMutex(async () => {
    const imageBuffer = await readFile(imagePath);
    const base64 = imageBuffer.toString('base64');

    const response = await ollamaFetch(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.OLLAMA_VISION_MODEL,
          stream: false,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: [base64],
            },
          ],
        }),
      },
      VISION_TIMEOUT_MS,
    );

    const data = (await response.json()) as ChatResponse;
    const content = data.message?.content?.trim();

    if (!content) {
      throw new Error('Ollama vision вернул пустой ответ');
    }

    return content;
  });
}

interface EmbeddingsResponse {
  embedding?: number[];
}

interface EmbedResponse {
  embeddings?: number[][];
}

async function requestEmbedding(text: string): Promise<number[]> {
  // /api/embeddings — основной endpoint (MVP_PLAN)
  try {
    const response = await ollamaFetch(
      '/api/embeddings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.OLLAMA_EMBED_MODEL,
          prompt: text,
        }),
      },
      EMBED_TIMEOUT_MS,
    );

    const data = (await response.json()) as EmbeddingsResponse;
    if (data.embedding?.length) {
      return data.embedding;
    }
  } catch {
    // fallback на /api/embed (новые версии Ollama)
  }

  const response = await ollamaFetch(
    '/api/embed',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.OLLAMA_EMBED_MODEL,
        input: text,
      }),
    },
    EMBED_TIMEOUT_MS,
  );

  const data = (await response.json()) as EmbedResponse;
  const embedding = data.embeddings?.[0];

  if (!embedding?.length) {
    throw new Error('Ollama embed вернул пустой embedding');
  }

  return embedding;
}

/** Embedding через nomic-embed-text (~768 dims). */
export async function generateEmbedding(text: string): Promise<number[]> {
  return requestEmbedding(text);
}

/** Только для тестов: сброс mutex между прогонами. */
export function resetVisionMutexForTests(): void {
  visionMutex = Promise.resolve();
}

/** @internal Проверка mutex: две задачи не выполняются параллельно. */
export async function assertVisionMutexSequential(): Promise<boolean> {
  resetVisionMutexForTests();

  let concurrent = 0;
  let maxConcurrent = 0;

  const task = async (): Promise<void> => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((resolve) => setTimeout(resolve, 30));
    concurrent -= 1;
  };

  await Promise.all([withVisionMutex(task), withVisionMutex(task)]);

  return maxConcurrent === 1;
}
