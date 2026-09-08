import {
  generateEmbedding as defaultGenerateEmbedding,
} from '../../services/ollama.js';
import { nomicEmbedInput } from '../../services/nomic.js';
import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createEmbedNode(deps: PipelineDeps) {
  const generateEmbedding = deps.ollama?.generateEmbedding ?? defaultGenerateEmbedding;

  return async function embed(state: PipelineGraphState): Promise<Partial<PipelineGraphState>> {
    const { itemId, embedText } = state;

    try {
      if (!embedText?.trim()) {
        throw new Error('Нет embedText для embedding');
      }

      const text = nomicEmbedInput(embedText, 'document');
      const embedding = await generateEmbedding(text);
      logNode(deps, itemId, 'embed', 'ok', `dims=${embedding.length}`);
      return {
        embedding,
        error: undefined,
        failedStep: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'embed', 'error', message);
      return { error: message, failedStep: 'embed' };
    }
  };
}
