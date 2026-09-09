import {
  generateFromImageBuffer as defaultGenerateFromImageBuffer,
} from '../../services/ollama.js';
import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createVisionLLMNode(deps: PipelineDeps) {
  const generateFromImageBuffer =
    deps.ollama?.generateFromImageBuffer ?? defaultGenerateFromImageBuffer;

  return async function visionLLM(state: PipelineGraphState): Promise<Partial<PipelineGraphState>> {
    const { itemId, fileBuffer } = state;

    try {
      if (!fileBuffer?.length) {
        throw new Error('fileBuffer не задан');
      }

      const rawVision = await generateFromImageBuffer(fileBuffer);
      logNode(deps, itemId, 'visionLLM', 'ok');
      return {
        rawVision,
        error: undefined,
        failedStep: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'visionLLM', 'error', message);
      return { error: message, failedStep: 'visionLLM' };
    }
  };
}
