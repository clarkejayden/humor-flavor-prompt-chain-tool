import type {
  MatrixFlavorRecord,
  MatrixImageRecord,
  MatrixStepRecord,
  PipelineExecutionResult,
  PipelineStepExecution
} from "@/lib/matrix/types";

const PLACEHOLDER_REGEX = /\{\{\s*step_(\d+)\s*\}\}/gi;

function resolvePlaceholders(template: string, previousOutputs: string[]) {
  return template.replace(PLACEHOLDER_REGEX, (match, rawIndex) => {
    const value = previousOutputs[Number(rawIndex) - 1];
    return typeof value === "string" ? value : match;
  });
}

function detectLoadedValue(step: MatrixStepRecord, image: MatrixImageRecord) {
  if (!step.reuseCachedAdminValues) {
    return null;
  }

  const key = `${step.title} ${step.stepKind ?? ""}`.toLowerCase();

  if (key.includes("celebrity")) {
    return image.loadedValues.celebrity_recognition ?? null;
  }

  if (key.includes("image description") || key.includes("description")) {
    return image.loadedValues.image_description ?? null;
  }

  return null;
}

function extractOutput(payload: unknown, outputType: "string" | "array") {
  if (outputType === "array") {
    if (Array.isArray(payload)) {
      return payload.map((entry) => String(entry)).join("\n");
    }

    if (payload && typeof payload === "object") {
      const arrayValue = (payload as Record<string, unknown>).output;
      if (Array.isArray(arrayValue)) {
        return arrayValue.map((entry) => String(entry)).join("\n");
      }
    }
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["output", "text", "response", "content", "message"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }

  return JSON.stringify(payload);
}

async function executeStep(
  step: MatrixStepRecord,
  flavor: MatrixFlavorRecord,
  image: MatrixImageRecord,
  previousOutputs: string[],
  endpoint: string,
  fetchImpl: typeof fetch,
  apiKey?: string
): Promise<PipelineStepExecution> {
  const loadedValue = detectLoadedValue(step, image);
  const resolvedPrompt = resolvePlaceholders(step.prompt, previousOutputs);

  if (loadedValue) {
    return {
      stepId: step.id,
      title: step.title,
      resolvedPrompt,
      outputText: loadedValue,
      skippedWithLoadedValue: true,
      modelId: step.modelId,
      temperature: step.temperature,
      processingTimeSeconds: 0,
      inputType: step.inputType,
      outputType: step.outputType,
      rawResponse: { source: "loaded_value", value: loadedValue }
    };
  }

  const startedAt = Date.now();
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      input_type: step.inputType,
      output_type: step.outputType,
      image_url: step.inputType === "image+text" ? image.publicUrl : undefined,
      prompt: resolvedPrompt,
      system_prompt: step.systemPrompt ?? flavor.systemPrompt ?? undefined,
      model_id: step.modelId ?? undefined,
      temperature: step.temperature ?? undefined
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Pipeline step failed with ${response.status} for ${step.title}. Response: ${errorBody || "No response body."}`
    );
  }

  const payload = await response.json();
  const payloadRecord = payload as Record<string, unknown>;

  return {
    stepId: step.id,
    title: step.title,
    resolvedPrompt,
    outputText: extractOutput(payload, step.outputType),
    skippedWithLoadedValue: false,
    modelId:
      (typeof payloadRecord.model_id === "string" ? payloadRecord.model_id : null) ??
      step.modelId,
    temperature:
      typeof payloadRecord.temperature === "number"
        ? (payloadRecord.temperature as number)
        : step.temperature,
    processingTimeSeconds:
      typeof payloadRecord.processing_time_seconds === "number"
        ? (payloadRecord.processing_time_seconds as number)
        : (Date.now() - startedAt) / 1000,
    inputType: step.inputType,
    outputType: step.outputType,
    rawResponse: payload
  };
}

export async function executePipelineForImage(
  flavor: MatrixFlavorRecord,
  image: MatrixImageRecord,
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<PipelineExecutionResult> {
  const endpoint = options?.endpoint ?? "https://api.almostcrackd.ai/";
  const apiKey = process.env.ALMOSTCRACKD_API_KEY;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const steps = [...flavor.steps].sort((left, right) => left.orderBy - right.orderBy);
  const results: PipelineStepExecution[] = [];
  const outputs: string[] = [];

  for (const step of steps) {
    const result = await executeStep(step, flavor, image, outputs, endpoint, fetchImpl, apiKey);
    results.push(result);
    outputs.push(result.outputText);
  }

  const last = results.at(-1) ?? null;

  return {
    imageId: image.id,
    imageTitle: image.title,
    finalCaption: last?.outputText ?? "",
    steps: results,
    modelId: last?.modelId ?? null,
    temperature: last?.temperature ?? null,
    processingTimeSeconds: results.reduce(
      (total, step) => total + (step.processingTimeSeconds ?? 0),
      0
    )
  };
}

export async function executeImageSetStudy(
  flavor: MatrixFlavorRecord,
  images: MatrixImageRecord[],
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    concurrency?: number;
    onProgress?: (completed: number, total: number, result: PipelineExecutionResult) => void;
  }
) {
  const concurrency = Math.max(1, options?.concurrency ?? 4);
  const queue = [...images];
  const results: PipelineExecutionResult[] = [];
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const image = queue.shift();
      if (!image) {
        return;
      }

      const result = await executePipelineForImage(flavor, image, options);
      results.push(result);
      completed += 1;
      options?.onProgress?.(completed, images.length, result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker));

  return results.sort((left, right) => left.imageTitle.localeCompare(right.imageTitle));
}
