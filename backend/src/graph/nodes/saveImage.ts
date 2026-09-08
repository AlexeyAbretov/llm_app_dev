import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';
import { save as defaultSave } from '../../services/imageStorage.js';

export function createSaveImageNode(deps: PipelineDeps) {
  const saveImage = deps.imageStorage?.save ?? defaultSave;

  return async function saveImageNode(
    state: PipelineGraphState,
  ): Promise<Partial<PipelineGraphState>> {
    const { itemId, fileBuffer, mime, originalName } = state;

    try {
      const savedImage = await saveImage({ buffer: fileBuffer, mime, originalName });
      logNode(deps, itemId, 'saveImage', 'ok', savedImage.ref);
      return {
        savedImage,
        imagePath: savedImage.ref,
        error: undefined,
        failedStep: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'saveImage', 'error', message);
      return { error: message, failedStep: 'saveImage' };
    }
  };
}
