import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createMarkFailedNode(deps: PipelineDeps) {
  return async function markFailed(
    state: PipelineGraphState,
  ): Promise<Partial<PipelineGraphState>> {
    const { itemId, error, failedStep } = state;
    const message = error ?? 'Неизвестная ошибка пайплайна';

    await deps.repository.update(itemId, {
      status: 'failed',
      error: message,
    });

    logNode(deps, itemId, 'markFailed', 'error', failedStep ?? message);
    return {};
  };
}
