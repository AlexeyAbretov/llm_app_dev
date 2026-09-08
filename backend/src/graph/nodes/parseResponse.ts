import { parseVisionResponse } from '../../services/llmParser.js';
import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createParseResponseNode(deps: PipelineDeps) {
  return async function parseResponse(
    state: PipelineGraphState,
  ): Promise<Partial<PipelineGraphState>> {
    const { itemId, rawVision } = state;

    try {
      if (!rawVision) {
        throw new Error('rawVision пуст');
      }

      const parsed = parseVisionResponse(rawVision);
      logNode(deps, itemId, 'parseResponse', 'ok', parsed.title);
      return {
        title: parsed.title,
        description: parsed.description,
        tags: parsed.tags,
        error: undefined,
        failedStep: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'parseResponse', 'error', message);
      return { error: message, failedStep: 'parseResponse' };
    }
  };
}
