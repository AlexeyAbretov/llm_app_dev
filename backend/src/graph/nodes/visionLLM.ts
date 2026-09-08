import { join } from 'node:path';
import { uploadDir } from '../../config.js';
import {
  generateFromImage as defaultGenerateFromImage,
} from '../../services/ollama.js';
import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createVisionLLMNode(deps: PipelineDeps) {
  const generateFromImage = deps.ollama?.generateFromImage ?? defaultGenerateFromImage;

  return async function visionLLM(state: PipelineGraphState): Promise<Partial<PipelineGraphState>> {
    const { itemId, imagePath } = state;

    try {
      if (!imagePath) {
        throw new Error('imagePath не задан');
      }

      const absolutePath = join(uploadDir, imagePath);
      const rawVision = await generateFromImage(absolutePath);
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
