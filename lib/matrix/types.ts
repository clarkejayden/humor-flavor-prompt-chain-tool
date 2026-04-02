export interface MatrixAuthContext {
  userId: string | null;
  email: string | null;
  isSuperadmin: boolean;
  isMatrixAdmin: boolean;
  allowed: boolean;
}

export interface MatrixImageRecord {
  id: string;
  title: string;
  publicUrl: string | null;
  createdAt: string;
  loadedValues: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface MatrixStepRecord {
  id: string;
  flavorId: string;
  title: string;
  description: string | null;
  systemPrompt: string | null;
  userPrompt: string;
  prompt: string;
  orderBy: number;
  inputType: "image+text" | "text";
  outputType: "string" | "array";
  modelId: string | null;
  temperature: number | null;
  stepKind: string | null;
  reuseCachedAdminValues: boolean;
  imageId: string | null;
  raw: Record<string, unknown>;
}

export interface MatrixFlavorRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string | null;
  steps: MatrixStepRecord[];
  raw: Record<string, unknown>;
}

export interface MatrixCaptionRecord {
  id: string;
  imageId: string;
  flavorId: string;
  caption: string;
  createdAt: string;
  imageTitle: string | null;
  flavorName: string | null;
  processingTimeSeconds: number | null;
  modelId: string | null;
}

export interface MatrixResponseRecord {
  id: string;
  imageId: string | null;
  flavorId: string | null;
  stepId: string | null;
  outputText: string;
  modelId: string | null;
  temperature: number | null;
  processingTimeSeconds: number | null;
  createdAt: string;
}

export interface MatrixExperimentBootstrap {
  auth: MatrixAuthContext;
  flavors: MatrixFlavorRecord[];
  images: MatrixImageRecord[];
  captions: MatrixCaptionRecord[];
  responses: MatrixResponseRecord[];
}

export interface PipelineStepExecution {
  stepId: string;
  title: string;
  resolvedPrompt: string;
  outputText: string;
  skippedWithLoadedValue: boolean;
  modelId: string | null;
  temperature: number | null;
  processingTimeSeconds: number | null;
  inputType: "image+text" | "text";
  outputType: "string" | "array";
  rawResponse: unknown;
}

export interface PipelineExecutionResult {
  imageId: string;
  imageTitle: string;
  finalCaption: string;
  steps: PipelineStepExecution[];
  modelId: string | null;
  temperature: number | null;
  processingTimeSeconds: number | null;
}
