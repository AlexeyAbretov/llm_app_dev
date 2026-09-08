import type { PipelineDeps } from '../deps.js';
import { logNode } from '../log.js';
import type { PipelineGraphState } from '../state.js';

export function createSaveDBNode(deps: PipelineDeps) {
  return async function saveDB(state: PipelineGraphState): Promise<Partial<PipelineGraphState>> {
    const { itemId, title, description, tags, embedding, savedImage } = state;

    try {
      if (!title || !description || !tags || !embedding?.length || !savedImage) {
        throw new Error('Неполные данные для сохранения');
      }

      const updated = await deps.repository.markReady(itemId, {
        title,
        description,
        tags,
        embedding,
        image: {
          storage: 'disk',
          ref: savedImage.ref,
          mime: savedImage.mime,
          originalName: savedImage.originalName,
        },
      });

      if (!updated) {
        throw new Error(`Документ ${itemId} не найден`);
      }

      logNode(deps, itemId, 'saveDB', 'ok');
      return { error: undefined, failedStep: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logNode(deps, itemId, 'saveDB', 'error', message);
      return { error: message, failedStep: 'saveDB' };
    }
  };
}
