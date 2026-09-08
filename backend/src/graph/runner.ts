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
  const drainWaiters: Array<() => void> = [];

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

  function notifyIdle(): void {
    if (processing || queue.length > 0) {
      return;
    }
    const waiters = drainWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }

  function processNext(): void {
    if (processing) {
      return;
    }
    const input = queue.shift();
    if (!input) {
      notifyIdle();
      return;
    }

    processing = true;
    void runOne(input).finally(() => {
      processing = false;
      processNext();
    });
  }

  return {
    enqueue(input: PipelineInput) {
      queue.push(input);
      processNext();
    },
    drain() {
      if (!processing && queue.length === 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        drainWaiters.push(resolve);
      });
    },
    pendingCount() {
      return queue.length;
    },
  };
}
