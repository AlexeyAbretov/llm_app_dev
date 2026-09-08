import { Annotation } from '@langchain/langgraph';
import type { SavedImage } from '../services/imageStorage.js';

/** Состояние LangGraph-пайплайна каталога (этап 4). */
export interface PipelineState {
  itemId: string;
  imagePath: string;
  fileBuffer: Buffer;
  mime: string;
  originalName: string;
  title?: string;
  description?: string;
  tags?: string[];
  embedText?: string;
  embedding?: number[];
  rawVision?: string;
  savedImage?: SavedImage;
  error?: string;
  /** Общий счётчик retry (issue). */
  retries: number;
  visionAttempts: number;
  parseAttempts: number;
  embedAttempts: number;
  failedStep?: string;
}

export const PipelineStateAnnotation = Annotation.Root({
  itemId: Annotation<string>,
  imagePath: Annotation<string>,
  fileBuffer: Annotation<Buffer>,
  mime: Annotation<string>,
  originalName: Annotation<string>,
  title: Annotation<string | undefined>,
  description: Annotation<string | undefined>,
  tags: Annotation<string[] | undefined>,
  embedText: Annotation<string | undefined>,
  embedding: Annotation<number[] | undefined>,
  rawVision: Annotation<string | undefined>,
  savedImage: Annotation<SavedImage | undefined>,
  error: Annotation<string | undefined>,
  retries: Annotation<number>,
  visionAttempts: Annotation<number>,
  parseAttempts: Annotation<number>,
  embedAttempts: Annotation<number>,
  failedStep: Annotation<string | undefined>,
});

export type PipelineGraphState = typeof PipelineStateAnnotation.State;
