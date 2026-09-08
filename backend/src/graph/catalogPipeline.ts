import { END, START, StateGraph } from '@langchain/langgraph';
import type { PipelineDeps, PipelineInput } from './deps.js';
import { createEmbedNode } from './nodes/embed.js';
import { createMarkFailedNode } from './nodes/markFailed.js';
import { createParseResponseNode } from './nodes/parseResponse.js';
import { createSaveDBNode } from './nodes/saveDB.js';
import { createSaveImageNode } from './nodes/saveImage.js';
import { createValidateNode } from './nodes/validate.js';
import { createVisionLLMNode } from './nodes/visionLLM.js';
import {
  embedRetryPatch,
  parseRetryPatch,
  routeAfterEmbedWithRetry,
  routeAfterParseResponseWithRetry,
  routeAfterSaveDB,
  routeAfterSaveImage,
  routeAfterValidate,
  routeAfterVisionLLMWithRetry,
  visionRetryPatch,
} from './routing.js';
import { PipelineStateAnnotation, type PipelineGraphState } from './state.js';

function createInitialState(input: PipelineInput): PipelineGraphState {
  return {
    itemId: input.itemId,
    imagePath: '',
    fileBuffer: input.buffer,
    mime: input.mime,
    originalName: input.originalName,
    title: undefined,
    description: undefined,
    tags: undefined,
    embedText: undefined,
    embedding: undefined,
    rawVision: undefined,
    savedImage: undefined,
    error: undefined,
    retries: 0,
    visionAttempts: 0,
    parseAttempts: 0,
    embedAttempts: 0,
    failedStep: undefined,
  };
}

export function buildCatalogGraph(deps: PipelineDeps) {
  const graph = new StateGraph(PipelineStateAnnotation)
    .addNode('validate', createValidateNode(deps))
    .addNode('saveImage', createSaveImageNode(deps))
    .addNode('visionLLM', createVisionLLMNode(deps))
    .addNode('parseResponse', createParseResponseNode(deps))
    .addNode('embed', createEmbedNode(deps))
    .addNode('saveDB', createSaveDBNode(deps))
    .addNode('markFailed', createMarkFailedNode(deps))
    .addNode('retryVision', async (state) => visionRetryPatch(state))
    .addNode('retryParse', async (state) => parseRetryPatch(state))
    .addNode('retryEmbed', async (state) => embedRetryPatch(state))
    .addEdge(START, 'validate')
    .addConditionalEdges('validate', routeAfterValidate, {
      saveImage: 'saveImage',
      markFailed: 'markFailed',
    })
    .addConditionalEdges('saveImage', routeAfterSaveImage, {
      visionLLM: 'visionLLM',
      markFailed: 'markFailed',
    })
    .addConditionalEdges('visionLLM', routeAfterVisionLLMWithRetry, {
      parseResponse: 'parseResponse',
      retryVision: 'retryVision',
      markFailed: 'markFailed',
    })
    .addEdge('retryVision', 'visionLLM')
    .addConditionalEdges('parseResponse', routeAfterParseResponseWithRetry, {
      embed: 'embed',
      retryParse: 'retryParse',
      markFailed: 'markFailed',
    })
    .addEdge('retryParse', 'visionLLM')
    .addConditionalEdges('embed', routeAfterEmbedWithRetry, {
      saveDB: 'saveDB',
      retryEmbed: 'retryEmbed',
      markFailed: 'markFailed',
    })
    .addEdge('retryEmbed', 'embed')
    .addConditionalEdges('saveDB', routeAfterSaveDB, {
      __end__: END,
      markFailed: 'markFailed',
    })
    .addEdge('markFailed', END);

  return graph.compile();
}

export async function runCatalogPipeline(
  deps: PipelineDeps,
  input: PipelineInput,
): Promise<PipelineGraphState> {
  const graph = buildCatalogGraph(deps);
  const result = await graph.invoke(createInitialState(input));
  return result;
}
