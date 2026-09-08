import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertVisionMutexSequential,
  checkHealth,
  generateEmbedding,
  generateFromImage,
} from '../src/services/ollama.js';
import { getUrl, save } from '../src/services/imageStorage.js';
import { parseVisionResponse } from '../src/services/llmParser.js';

const monorepoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function logSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function testParserMarkdown(): void {
  logSection('Parser: JSON в markdown-обёртке');

  const raw = `\`\`\`json
{
  "title": "Керамическая ваза",
  "description": "Высокая ваза с синим орнаментом. Подходит для интерьера.",
  "tags": ["ваза", "керамика", "орнамент"]
}
\`\`\``;

  const result = parseVisionResponse(raw);
  console.log('title:', result.title);
  console.log('description:', result.description);
  console.log('tags:', result.tags.join(', '));
}

async function testMutex(): Promise<void> {
  logSection('Mutex: последовательный вызов vision');

  const sequential = await assertVisionMutexSequential();
  if (!sequential) {
    throw new Error('Mutex не сериализовал параллельные vision-задачи');
  }

  console.log('OK: maxConcurrent === 1');
}

async function testE2E(imagePath: string): Promise<void> {
  logSection('E2E: vision + embed');

  const healthy = await checkHealth();
  if (!healthy) {
    console.log('Ollama недоступен — пропуск E2E (нужен локальный ollama serve + модели)');
    return;
  }

  const buffer = await readFile(imagePath);
  const saved = await save({
    buffer,
    mime: 'image/jpeg',
    originalName: 'test.jpg',
  });

  console.log('Сохранено:', saved.ref);
  console.log('URL:', getUrl(saved.ref));

  const absoluteImagePath = resolve(monorepoRoot, 'uploads', saved.ref);
  const rawVision = await generateFromImage(absoluteImagePath);
  console.log('\nСырой ответ vision:\n', rawVision.slice(0, 300));

  const parsed = parseVisionResponse(rawVision);
  console.log('\ntitle:', parsed.title);
  console.log('description:', parsed.description);
  console.log('tags:', parsed.tags.join(', '));

  const embedText = `${parsed.title}. ${parsed.description}. ${parsed.tags.join(', ')}`;
  const embedding = await generateEmbedding(embedText);
  console.log('\nembedding.length:', embedding.length);
  console.log('embedding[0..2]:', embedding.slice(0, 3));

  if (embedding.length < 700 || embedding.length > 800) {
    throw new Error(`Ожидался embedding ~768 dims, получено: ${embedding.length}`);
  }
}

async function main(): Promise<void> {
  const imageArg = process.argv[2] ?? 'test.jpg';
  const imagePath = resolve(process.cwd(), imageArg);

  testParserMarkdown();
  await testMutex();

  try {
    await readFile(imagePath);
    await testE2E(imagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`\nФайл ${imageArg} не найден — E2E пропущен (положите test.jpg для полной проверки)`);
    } else {
      throw error;
    }
  }

  console.log('\nГотово.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
