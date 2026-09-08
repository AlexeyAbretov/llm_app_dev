import {
  MAX_EMBED_RETRIES,
  MAX_PARSE_RETRIES,
  MAX_VISION_RETRIES,
} from './deps.js';
import type { PipelineGraphState } from './state.js';

type RouteResult =
  | 'saveImage'
  | 'visionLLM'
  | 'parseResponse'
  | 'embed'
  | 'saveDB'
  | 'markFailed'
  | 'retryVision'
  | 'retryParse'
  | 'retryEmbed'
  | '__end__';

function hasError(state: PipelineGraphState): boolean {
  return Boolean(state.error);
}

export function routeAfterValidate(state: PipelineGraphState): RouteResult {
  return hasError(state) ? 'markFailed' : 'saveImage';
}

export function routeAfterSaveImage(state: PipelineGraphState): RouteResult {
  return hasError(state) ? 'markFailed' : 'visionLLM';
}

export function routeAfterVisionLLM(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'parseResponse';
  }

  if (state.visionAttempts < MAX_VISION_RETRIES) {
    return 'visionLLM';
  }

  return 'markFailed';
}

export function routeAfterParseResponse(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'embed';
  }

  if (state.parseAttempts < MAX_PARSE_RETRIES) {
    return 'visionLLM';
  }

  return 'markFailed';
}

export function routeAfterEmbed(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'saveDB';
  }

  if (state.embedAttempts < MAX_EMBED_RETRIES) {
    return 'embed';
  }

  return 'markFailed';
}

export function routeAfterSaveDB(state: PipelineGraphState): RouteResult {
  return hasError(state) ? 'markFailed' : '__end__';
}

/** Инкремент счётчиков retry перед повторным входом в узел. */
export function applyRetryCounters(
  state: PipelineGraphState,
  targetNode: 'visionLLM' | 'embed',
): Partial<PipelineGraphState> {
  const patch: Partial<PipelineGraphState> = {
    error: undefined,
    failedStep: undefined,
    retries: state.retries + 1,
  };

  if (targetNode === 'visionLLM') {
    patch.visionAttempts = state.visionAttempts + 1;
    patch.rawVision = undefined;
    patch.title = undefined;
    patch.description = undefined;
    patch.tags = undefined;
    patch.embedding = undefined;
  }

  if (targetNode === 'embed') {
    patch.embedAttempts = state.embedAttempts + 1;
    patch.embedding = undefined;
  }

  return patch;
}

export function shouldRetryVision(state: PipelineGraphState): boolean {
  return hasError(state) && state.visionAttempts < MAX_VISION_RETRIES;
}

export function shouldRetryParse(state: PipelineGraphState): boolean {
  return hasError(state) && state.parseAttempts < MAX_PARSE_RETRIES;
}

export function shouldRetryEmbed(state: PipelineGraphState): boolean {
  return hasError(state) && state.embedAttempts < MAX_EMBED_RETRIES;
}

/** Узел-патч перед повтором vision после ошибки parse. */
export function parseRetryPatch(state: PipelineGraphState): Partial<PipelineGraphState> {
  return {
    ...applyRetryCounters(state, 'visionLLM'),
    parseAttempts: state.parseAttempts + 1,
  };
}

/** Узел-патч перед повтором vision после ошибки vision. */
export function visionRetryPatch(state: PipelineGraphState): Partial<PipelineGraphState> {
  return applyRetryCounters(state, 'visionLLM');
}

/** Узел-патч перед повтором embed. */
export function embedRetryPatch(state: PipelineGraphState): Partial<PipelineGraphState> {
  return applyRetryCounters(state, 'embed');
}

export function routeAfterVisionLLMWithRetry(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'parseResponse';
  }
  if (shouldRetryVision(state)) {
    return 'retryVision';
  }
  return 'markFailed';
}

export function routeAfterParseResponseWithRetry(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'embed';
  }
  if (shouldRetryParse(state)) {
    return 'retryParse';
  }
  return 'markFailed';
}

export function routeAfterEmbedWithRetry(state: PipelineGraphState): RouteResult {
  if (!hasError(state)) {
    return 'saveDB';
  }
  if (shouldRetryEmbed(state)) {
    return 'retryEmbed';
  }
  return 'markFailed';
}

export type ExtendedRouteResult = RouteResult;
