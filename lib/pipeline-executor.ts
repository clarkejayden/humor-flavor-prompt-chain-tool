import type {
  MatrixFlavorRecord,
  MatrixImageRecord,
  PipelineExecutionResult,
  PipelineStepExecution
} from "@/lib/matrix/types";

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

function buildMockStepOutput(
  flavor: MatrixFlavorRecord,
  image: MatrixImageRecord,
  stepTitle: string
) {
  const description =
    image.loadedValues.image_description ??
    `${image.title} with no stored description`;
  const celebrity = image.loadedValues.celebrity_recognition ?? "unknown subject";

  return [
    `[mock:${stepTitle}]`,
    `Flavor: ${flavor.name}`,
    `Image: ${image.title}`,
    `Description: ${description}`,
    `Subject: ${celebrity}`
  ].join("\n");
}

function normalizeApiBaseUrl(endpoint: string) {
  return endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
}

function inferContentType(image: MatrixImageRecord) {
  const raw = image.raw;
  const candidates = [
    typeof raw.content_type === "string" ? raw.content_type : null,
    typeof raw.mime_type === "string" ? raw.mime_type : null,
    image.publicUrl,
    typeof raw.object_path === "string" ? raw.object_path : null,
    typeof raw.storage_path === "string" ? raw.storage_path : null
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower.includes(".png")) return "image/png";
    if (lower.includes(".webp")) return "image/webp";
    if (lower.includes(".gif")) return "image/gif";
    if (lower.includes(".heic")) return "image/heic";
    if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
    if (lower.startsWith("image/")) return lower;
  }

  return "image/jpeg";
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractCaptionText(captionsPayload: unknown) {
  if (!Array.isArray(captionsPayload)) {
    return extractOutput(captionsPayload, "string");
  }

  const values = captionsPayload
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (entry && typeof entry === "object") {
        return extractOutput(entry, "string");
      }

      return null;
    })
    .filter((entry): entry is string => Boolean(entry));

  return values.join("\n\n");
}

async function executeCaptionApiFlow(
  flavor: MatrixFlavorRecord,
  image: MatrixImageRecord,
  endpoint: string,
  fetchImpl: typeof fetch,
  apiKey?: string,
  onStatus?: (status: "queued" | "uploading" | "registering" | "captioning" | "complete" | "failed") => void
): Promise<PipelineExecutionResult> {
  const stepTitle = "Caption API";
  const startedAt = Date.now();

  if (!apiKey) {
    onStatus?.("complete");
    const outputText = buildMockStepOutput(flavor, image, stepTitle);

    return {
      imageId: image.id,
      imageTitle: image.title,
      finalCaption: outputText,
      steps: [
        {
          stepId: `mock-${image.id}`,
          title: stepTitle,
          resolvedPrompt: `Mock caption output for ${flavor.name}`,
          outputText,
          skippedWithLoadedValue: false,
          modelId: "mock-local",
          temperature: null,
          processingTimeSeconds: 0,
          inputType: "image+text",
          outputType: "string",
          rawResponse: { source: "mock_executor", reason: "Missing ALMOSTCRACKD_API_KEY" }
        }
      ],
      modelId: "mock-local",
      temperature: null,
      processingTimeSeconds: 0
    };
  }

  if (!image.publicUrl) {
    onStatus?.("failed");
    throw new Error(`Image ${image.title} is missing a public URL.`);
  }

  const baseUrl = normalizeApiBaseUrl(endpoint);
  const contentType = inferContentType(image);

  onStatus?.("uploading");
  const presignResponse = await fetchImpl(`${baseUrl}/pipeline/generate-presigned-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ contentType })
  });

  if (!presignResponse.ok) {
    onStatus?.("failed");
    const errorBody = await presignResponse.text();
    throw new Error(
      `Failed to generate upload URL (${presignResponse.status}). ${errorBody || "No response body."}`
    );
  }

  const presignPayload = (await presignResponse.json()) as {
    presignedUrl?: string;
    cdnUrl?: string;
  };

  if (!presignPayload.presignedUrl || !presignPayload.cdnUrl) {
    throw new Error("Upload URL response did not include both presignedUrl and cdnUrl.");
  }

  const sourceImageResponse = await fetchImpl(image.publicUrl);
  if (!sourceImageResponse.ok) {
    onStatus?.("failed");
    const errorBody = await sourceImageResponse.text();
    throw new Error(
      `Failed to fetch source image (${sourceImageResponse.status}). ${errorBody || "No response body."}`
    );
  }

  const imageBytes = await sourceImageResponse.arrayBuffer();
  const uploadResponse = await fetchImpl(presignPayload.presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType
    },
    body: imageBytes
  });

  if (!uploadResponse.ok) {
    onStatus?.("failed");
    const errorBody = await uploadResponse.text();
    throw new Error(
      `Failed to upload image bytes (${uploadResponse.status}). ${errorBody || "No response body."}`
    );
  }

  onStatus?.("registering");
  const registerResponse = await fetchImpl(`${baseUrl}/pipeline/upload-image-from-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      imageUrl: presignPayload.cdnUrl,
      isCommonUse: false
    })
  });

  if (!registerResponse.ok) {
    onStatus?.("failed");
    const errorBody = await registerResponse.text();
    throw new Error(
      `Failed to register uploaded image (${registerResponse.status}). ${errorBody || "No response body."}`
    );
  }

  const registerPayload = (await registerResponse.json()) as {
    imageId?: string;
  };

  if (!registerPayload.imageId) {
    onStatus?.("failed");
    throw new Error("Image registration response did not include imageId.");
  }

  onStatus?.("captioning");
  const generateResponse = await fetchImpl(`${baseUrl}/pipeline/generate-captions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      imageId: registerPayload.imageId,
      humorFlavorId: flavor.id
    })
  });

  if (!generateResponse.ok) {
    onStatus?.("failed");
    const errorBody = await generateResponse.text();
    throw new Error(
      `Failed to generate captions (${generateResponse.status}). ${errorBody || "No response body."}`
    );
  }

  const captionsPayload = await parseJsonResponse(generateResponse);
  const outputText = extractCaptionText(captionsPayload);
  const processingTimeSeconds = (Date.now() - startedAt) / 1000;
  onStatus?.("complete");

  return {
    imageId: image.id,
    imageTitle: image.title,
    finalCaption: outputText,
    steps: [
      {
        stepId: registerPayload.imageId,
        title: stepTitle,
        resolvedPrompt: `POST ${baseUrl}/pipeline/generate-captions`,
        outputText,
        skippedWithLoadedValue: false,
        modelId: null,
        temperature: null,
        processingTimeSeconds,
        inputType: "image+text",
        outputType: "string",
        rawResponse: {
          upload: {
            contentType,
            cdnUrl: presignPayload.cdnUrl
          },
          register: registerPayload,
          captions: captionsPayload
        }
      }
    ],
    modelId: null,
    temperature: null,
    processingTimeSeconds
  };
}

export async function executePipelineForImage(
  flavor: MatrixFlavorRecord,
  image: MatrixImageRecord,
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    onStatus?: (image: MatrixImageRecord, status: "queued" | "uploading" | "registering" | "captioning" | "complete" | "failed") => void;
  }
): Promise<PipelineExecutionResult> {
  const endpoint = options?.endpoint ?? "https://api.almostcrackd.ai/";
  const apiKey = process.env.ALMOSTCRACKD_API_KEY;
  const fetchImpl = options?.fetchImpl ?? fetch;
  options?.onStatus?.(image, "queued");
  return executeCaptionApiFlow(flavor, image, endpoint, fetchImpl, apiKey, (status) =>
    options?.onStatus?.(image, status)
  );
}

export async function executeImageSetStudy(
  flavor: MatrixFlavorRecord,
  images: MatrixImageRecord[],
  options?: {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    concurrency?: number;
    onProgress?: (completed: number, total: number, result: PipelineExecutionResult) => void;
    onStatus?: (image: MatrixImageRecord, status: "queued" | "uploading" | "registering" | "captioning" | "complete" | "failed") => void;
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
