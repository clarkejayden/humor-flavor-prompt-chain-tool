const PLACEHOLDER_REGEX = /\{\{\s*step_(\d+)\s*\}\}/gi;

export interface ChainRunnerInput {
  imageUrl: string;
  steps: Array<{
    id: string;
    llmUserPrompt: string;
    title?: string;
  }>;
  systemPrompt?: string | null;
}

export interface ChainStepResult {
  stepId: string;
  title?: string;
  prompt: string;
  rawResponse: unknown;
  outputText: string;
}

export interface ChainRunnerOptions {
  endpoint?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export class ChainRunnerError extends Error {
  stepId: string;

  constructor(message: string, stepId: string) {
    super(message);
    this.name = "ChainRunnerError";
    this.stepId = stepId;
  }
}

export function resolvePromptPlaceholders(
  template: string,
  previousOutputs: string[]
) {
  return template.replace(PLACEHOLDER_REGEX, (match, rawIndex) => {
    const index = Number(rawIndex) - 1;
    const value = previousOutputs[index];
    return typeof value === "string" ? value : match;
  });
}

function extractTextResponse(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const candidateKeys = ["output", "text", "response", "content", "message"] as const;

    for (const key of candidateKeys) {
      const value = (payload as Record<string, unknown>)[key];

      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return JSON.stringify(payload);
}

export async function runFlavorChain(
  input: ChainRunnerInput,
  options: ChainRunnerOptions = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? "https://api.almostcrackd.ai/";
  const outputs: string[] = [];
  const results: ChainStepResult[] = [];

  for (const step of input.steps) {
    const resolvedPrompt = resolvePromptPlaceholders(step.llmUserPrompt, outputs);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      signal: options.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: input.imageUrl,
        prompt: resolvedPrompt,
        system_prompt: input.systemPrompt ?? undefined
      })
    });

    if (!response.ok) {
      throw new ChainRunnerError(`Chain execution failed with ${response.status}.`, step.id);
    }

    const payload = await response.json();
    const outputText = extractTextResponse(payload);

    outputs.push(outputText);
    results.push({
      stepId: step.id,
      title: step.title,
      prompt: resolvedPrompt,
      rawResponse: payload,
      outputText
    });
  }

  return results;
}
