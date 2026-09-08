import type { PipelineDeps, PipelineInput } from './deps.js';
import { runCatalogPipeline } from './catalogPipeline.js';

export interface PipelineRunner {
  enqueue(input: PipelineInput): void;
  /** Дождаться опустошения очереди (для тестов). */
  drain(): Promise<void>;
  /** Количество задач в очереди (не включая текущую). */
  pendingCount(): number;
}

export function createPipelineRunner(deps: PipelineDeps): PipelineRunner {
  const queue: PipelineInput[] = [];
  let processing = false;
  let chain: Promise<void> = Promise.resolve();

  async function runOne(input: PipelineInput): Promise<void> {
    await deps.repository.update(input.itemId, { status: 'processing' });

    try {
      await runCatalogPipeline(deps, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.repository.update(input.itemId, {
        status: 'failed',
        error: message,
      });
      deps.log?.error(`[pipeline] itemId=${input.itemId} node=runner → error (${message})`);
    }
  }

  function processNext(): Promise<void> {
    if (processing || queue.length === 0) {
      return chain;
    }

    processing = true;
    const input = queue.shift()!;

    chain = chain
      .then(() => runOne(input))
      .finally(() => {
        processing = false;
      })
      .then(() => processNext());

    return chain;
  }

  return {
    enqueue(input: PipelineInput) {
      queue.push(input);
      void processNext();
    },
    drain() {
      return chain;
    },
    pendingCount() {
      return queue.length;
    },
  };
}
