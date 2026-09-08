import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { config } from '../config.js';
import { VISION_PROMPT_V1 } from '../prompts/visionV1.js';

const VISION_TIMEOUT_MS = 120_000;
const EMBED_TIMEOUT_MS = 30_000;
const TRANSLATE_TIMEOUT_MS = 20_000;
/** Длинная сторона для vision: иначе qwen2.5vl:7b (ctx 4096) падает на фото 12 Мп. */
const VISION_MAX_EDGE = 1024;

async function encodeImageForVision(imageBuffer: Buffer): Promise<string> {
  const resized = await sharp(imageBuffer)
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return resized.toString('base64');
}

/** Mutex: vision и перевод запроса не параллелить (P6, 8 GB). */
let gpuMutex: Promise<unknown> = Promise.resolve();

async function withGpuMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = gpuMutex.then(fn);
  gpuMutex = run.catch(() => undefined);
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

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

/** Совпадение по конкретному тегу; `:latest` — явный alias без других тегов семейства. */
function modelIsAvailable(available: string[], required: string): boolean {
  if (required.endsWith(':latest')) {
    const base = required.slice(0, -':latest'.length);
    return available.some((name) => name === required || name === base);
  }

  if (required.includes(':')) {
    return available.includes(required);
  }

  return available.some((name) => name === required || name === `${required}:latest`);
}

/** Ping Ollama и проверка наличия vision/embed/translate моделей (GET /api/tags). */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as OllamaTagsResponse;
    const names = data.models?.map((model) => model.name) ?? [];

    return (
      modelIsAvailable(names, config.OLLAMA_VISION_MODEL) &&
      modelIsAvailable(names, config.OLLAMA_EMBED_MODEL) &&
      modelIsAvailable(names, config.OLLAMA_TRANSLATE_MODEL)
    );
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
  return withGpuMutex(async () => {
    const imageBuffer = await readFile(imagePath);
    const base64 = await encodeImageForVision(imageBuffer);

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

const TRANSLATE_PROMPT = `Translate the search query into English. Reply with only the English words, no quotes, no explanation.

Query:`;

function looksEnglish(query: string): boolean {
  return !/[а-яё]/i.test(query);
}

/** RU→EN для nomic search_query. Уже английский запрос не трогаем. */
export async function translateSearchQuery(query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed || looksEnglish(trimmed)) {
    return trimmed;
  }

  return withGpuMutex(async () => {
    const response = await ollamaFetch(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.OLLAMA_TRANSLATE_MODEL,
          stream: false,
          messages: [
            {
              role: 'user',
              content: `${TRANSLATE_PROMPT} ${trimmed}`,
            },
          ],
        }),
      },
      TRANSLATE_TIMEOUT_MS,
    );

    const data = (await response.json()) as ChatResponse;
    const translated = data.message?.content
      ?.trim()
      .split('\n')[0]
      ?.replace(/^["'«»]+|["'«»]+$/g, '')
      .trim();

    if (!translated) {
      throw new Error('Ollama translate вернул пустой ответ');
    }

    return translated;
  });
}

/** Только для тестов: сброс mutex между прогонами. */
export function resetVisionMutexForTests(): void {
  gpuMutex = Promise.resolve();
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

  await Promise.all([withGpuMutex(task), withGpuMutex(task)]);

  return maxConcurrent === 1;
}
