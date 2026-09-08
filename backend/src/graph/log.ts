import type { PipelineDeps, PipelineLogger } from './deps.js';

const defaultLogger: PipelineLogger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
};

export function getLogger(deps: PipelineDeps): PipelineLogger {
  return deps.log ?? defaultLogger;
}

export function logNode(
  deps: PipelineDeps,
  itemId: string,
  node: string,
  outcome: 'ok' | 'error',
  detail?: string,
): void {
  const suffix = detail ? ` (${detail})` : '';
  const line = `[pipeline] itemId=${itemId} node=${node} → ${outcome}${suffix}`;
  if (outcome === 'error') {
    getLogger(deps).error(line);
  } else {
    getLogger(deps).info(line);
  }
}
