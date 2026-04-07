"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  Filter,
  GraduationCap,
  GripVertical,
  History,
  Pencil,
  Plus,
  Search,
  Save,
  Trash2
} from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MatrixFlavorRecord, MatrixStepRecord } from "@/lib/matrix/types";
import { cn } from "@/lib/utils";

interface SimpleFlavorManagerProps {
  initialFlavors: MatrixFlavorRecord[];
}

type FlavorFormState = {
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
};

type StepFormState = {
  title: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  temperature: number;
  inputType: "image+text" | "text";
  outputType: "string" | "array";
  stepKind: string;
  reuseCachedAdminValues: boolean;
};

type SaveResult = { error: { message: string } | null; data?: unknown };
type AwaitableSaveResult = PromiseLike<SaveResult> | SaveResult;
type SavePayload = Record<string, string | number | boolean | null | undefined>;
type TutorialStep = {
  selector: string;
  title: string;
  description: string;
  example: string;
};

type FlavorRevisionSnapshot = {
  id: string;
  savedAt: string;
  source: string;
  flavorId: string | null;
  flavorName: string;
  form: FlavorFormState;
};

type StepRevisionSnapshot = {
  id: string;
  savedAt: string;
  source: string;
  flavorId: string;
  stepId: string | null;
  stepTitle: string;
  form: StepFormState;
};

type FlavorSortMode = "recent" | "name" | "step-count";
type FlavorFilterMode = "all" | "with-steps" | "without-steps";

const FLAVOR_HISTORY_STORAGE_KEY = "matrix-flavor-history";
const STEP_HISTORY_STORAGE_KEY = "matrix-step-history";
const MAX_HISTORY_ENTRIES = 12;

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyFlavorForm(): FlavorFormState {
  return {
    name: "",
    slug: "",
    description: "",
    systemPrompt: ""
  };
}

function emptyStepForm(): StepFormState {
  return {
    title: "",
    description: "",
    systemPrompt: "",
    userPrompt: "",
    modelId: "",
    temperature: 0.7,
    inputType: "text",
    outputType: "string",
    stepKind: "",
    reuseCachedAdminValues: false
  };
}

function buildFlavorPayloadCandidates(
  form: FlavorFormState,
  sampleRaw?: Record<string, unknown>
) {
  const normalized = {
    name: form.name,
    slug: form.slug || toSlug(form.name),
    description: form.description || null,
    systemPrompt: form.systemPrompt || null
  };
  const raw = sampleRaw ?? {};
  const preferredNameKey =
    "name" in raw ? "name" : "title" in raw ? "title" : "flavor_name" in raw ? "flavor_name" : null;
  const preferredDescriptionKey =
    "description" in raw
      ? "description"
      : "summary" in raw
        ? "summary"
        : "subtitle" in raw
          ? "subtitle"
          : null;
  const preferredPromptKey =
    "llm_system_prompt" in raw
      ? "llm_system_prompt"
      : "system_prompt" in raw
        ? "system_prompt"
        : "prompt" in raw
          ? "prompt"
          : null;

  const candidates: SavePayload[] = [];

  if (preferredNameKey) {
    candidates.push({
      [preferredNameKey]: normalized.name,
      slug: normalized.slug,
      [preferredDescriptionKey ?? "description"]: normalized.description,
      [preferredPromptKey ?? "llm_system_prompt"]: normalized.systemPrompt
    });
  }

  candidates.push(
    {
      title: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      llm_system_prompt: normalized.systemPrompt
    },
    {
      flavor_name: normalized.name,
      slug: normalized.slug,
      summary: normalized.description,
      system_prompt: normalized.systemPrompt
    },
    {
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      llm_system_prompt: normalized.systemPrompt
    }
  );

  return candidates.filter(
    (candidate, index, array) =>
      array.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(candidate)) === index
  );
}

function buildStepPayloadCandidates(
  form: StepFormState,
  flavorId: string,
  executionOrder: number,
  sampleRaw?: Record<string, unknown>
) {
  const raw = sampleRaw ?? {};
  const base = {
    title: form.title,
    description: form.description || null,
    systemPrompt: form.systemPrompt || null,
    userPrompt: form.userPrompt,
    modelId: form.modelId || null,
    temperature: form.temperature,
    inputType: form.inputType,
    outputType: form.outputType,
    stepKind: form.stepKind || null,
    reuseCachedAdminValues: form.reuseCachedAdminValues
  };
  const relationKey =
    "humor_flavor_id" in raw ? "humor_flavor_id" : "flavor_id" in raw ? "flavor_id" : "flavor_id";
  const orderKey =
    "order_by" in raw ? "order_by" : "execution_order" in raw ? "execution_order" : "order_by";

  const candidates: SavePayload[] = [
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      step_description: base.description,
      system_prompt: base.systemPrompt,
      user_prompt: base.userPrompt,
      model_id: base.modelId,
      temperature: base.temperature,
      input_type: base.inputType,
      output_type: base.outputType,
      step_type: base.stepKind,
      reuse_cached_admin_values: base.reuseCachedAdminValues,
      title: base.title
    },
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      description: base.description,
      llm_system_prompt: base.systemPrompt,
      llm_user_prompt: base.userPrompt,
      llm_model_id: base.modelId,
      temperature: base.temperature,
      input_type: base.inputType,
      output_type: base.outputType,
      kind: base.stepKind,
      use_cached_values: base.reuseCachedAdminValues,
      step_name: base.title
    },
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      step_description: base.description,
      system_prompt: base.systemPrompt,
      prompt: base.userPrompt,
      model_id: base.modelId,
      temperature: base.temperature,
      input_type: base.inputType,
      output_type: base.outputType,
      step_type: base.stepKind,
      reuse_cached_admin_values: base.reuseCachedAdminValues,
      name: base.title
    },
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      step_description: base.description,
      system_prompt: base.systemPrompt,
      user_prompt: base.userPrompt,
      title: base.title
    },
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      description: base.description,
      llm_system_prompt: base.systemPrompt,
      llm_user_prompt: base.userPrompt,
      step_name: base.title
    },
    {
      [relationKey]: flavorId,
      [orderKey]: executionOrder,
      description: base.description,
      prompt: base.userPrompt,
      name: base.title
    }
  ];

  return candidates.filter(
    (candidate, index, array) =>
      array.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(candidate)) === index
  );
}

async function saveWithFallbacks(
  operation: (payload: SavePayload) => AwaitableSaveResult,
  payloads: SavePayload[]
) {
  let lastError: string | null = null;

  for (const payload of payloads) {
    const result = await operation(payload);
    if (!result.error) {
      return result;
    }
    lastError = result.error.message;
  }

  return {
    error: { message: lastError ?? "Unknown save error." },
    data: null
  };
}

function normalizeSavedStep(data: Record<string, unknown>, fallback: StepFormState, flavorId: string, orderBy: number): MatrixStepRecord {
  return {
    id: String(data.id),
    flavorId: String(data.humor_flavor_id ?? data.flavor_id ?? flavorId),
    title: String(data.title ?? data.step_name ?? data.name ?? fallback.title),
    description: (data.step_description ?? data.description ?? fallback.description) as string | null,
    systemPrompt: (data.system_prompt ?? data.llm_system_prompt ?? fallback.systemPrompt) as string | null,
    userPrompt: String(data.user_prompt ?? data.llm_user_prompt ?? data.prompt ?? fallback.userPrompt),
    prompt: String(data.user_prompt ?? data.llm_user_prompt ?? data.prompt ?? fallback.userPrompt),
    orderBy: Number(data.order_by ?? data.execution_order ?? data.position ?? orderBy),
    inputType: (data.input_type === "image+text" ? "image+text" : "text"),
    outputType: (data.output_type === "array" ? "array" : "string"),
    modelId: ((data.model_id ?? data.llm_model_id ?? fallback.modelId) || null) as string | null,
    temperature: typeof data.temperature === "number" ? data.temperature : fallback.temperature,
    stepKind: ((data.step_type ?? data.kind ?? data.step_kind ?? fallback.stepKind) || null) as string | null,
    reuseCachedAdminValues: Boolean(
      data.reuse_cached_admin_values ?? data.use_cached_values ?? fallback.reuseCachedAdminValues
    ),
    imageId: (data.image_id ?? data.images_id ?? null) as string | null,
    raw: data
  };
}

function toStepForm(step: MatrixStepRecord): StepFormState {
  return {
    title: step.title,
    description: step.description ?? "",
    systemPrompt: step.systemPrompt ?? "",
    userPrompt: step.userPrompt,
    modelId: step.modelId ?? "",
    temperature: step.temperature ?? 0.7,
    inputType: step.inputType,
    outputType: step.outputType,
    stepKind: step.stepKind ?? "",
    reuseCachedAdminValues: step.reuseCachedAdminValues
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toIsoTimestamp(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : new Date(0).toISOString();
}

function readFlavorUpdatedAt(flavor: MatrixFlavorRecord) {
  return toIsoTimestamp(
    flavor.raw.updated_at ?? flavor.raw.created_at ?? flavor.raw.inserted_at ?? flavor.raw.saved_at
  );
}

function persistLocalSnapshots<T>(storageKey: string, entries: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(entries));
}

function readLocalSnapshots<T>(storageKey: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushHistoryEntry<T extends { id: string }>(entries: T[], nextEntry: T) {
  return [nextEntry, ...entries.filter((entry) => entry.id !== nextEntry.id)].slice(0, MAX_HISTORY_ENTRIES);
}

function TutorialOverlay({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onClose,
  onNext,
  onPrevious
}: {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const cardWidth = 320;
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const cardLeft = clamp(
    targetRect ? targetRect.left : viewportWidth / 2 - cardWidth / 2,
    20,
    viewportWidth - cardWidth - 20
  );
  const preferredTop = targetRect ? targetRect.bottom + 16 : viewportHeight / 2 - 120;
  const fallbackTop = targetRect ? targetRect.top - 220 : preferredTop;
  const cardTop = clamp(
    preferredTop > viewportHeight - 240 ? fallbackTop : preferredTop,
    20,
    viewportHeight - 220
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/72 backdrop-blur-[2px]" onClick={onClose} />
      {targetRect ? (
        <div
          className="pointer-events-none fixed z-50 rounded-[1.15rem] border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.72)] transition-all"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16
          }}
        />
      ) : null}
      <div
        className="fixed z-50 w-[320px] rounded-[1.4rem] border border-cyan-400/35 bg-slate-950/96 p-5 shadow-[0_22px_80px_-28px_rgba(34,211,238,0.55)]"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
              Tutorial {stepIndex + 1}/{totalSteps}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
        <div className="mt-4 rounded-[1rem] border border-slate-800 bg-[#020817] p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Example Input</p>
          <p className="mt-2 whitespace-pre-wrap font-mono text-sm text-cyan-100">{step.example}</p>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrevious}
            disabled={stepIndex === 0}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-full border border-cyan-400/35 bg-cyan-400/12 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/18"
          >
            {stepIndex === totalSteps - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

function SortableStepCard({
  step,
  expanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete
}: {
  step: MatrixStepRecord;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id
  });

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-[1.15rem] border border-slate-800 bg-slate-950/50",
        isDragging && "ring-2 ring-sky-500/50"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          className="mt-1 rounded-full border border-slate-800 p-2 text-slate-500"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <button type="button" onClick={onToggle} className="min-w-0 text-left">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Step {step.orderBy}</p>
              <div className="mt-1 flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-slate-100">{step.title}</h3>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", expanded && "rotate-180")} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                {step.description || step.userPrompt || "No step details yet."}
              </p>
            </button>
            <div className="flex flex-wrap gap-2">
              <AnimatedButton glow={false} className="px-3 py-2 text-xs" onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </AnimatedButton>
              <AnimatedButton glow={false} className="px-3 py-2 text-xs" onClick={onDuplicate}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Duplicate
              </AnimatedButton>
              <AnimatedButton
                glow={false}
                className="border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
                onClick={onDelete}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </AnimatedButton>
            </div>
          </div>

          {expanded ? (
            <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 text-sm text-slate-300 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{step.description || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model / Temp</p>
                <p className="mt-1">{step.modelId || "Default model"} / {step.temperature ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Input / Output</p>
                <p className="mt-1">{step.inputType} → {step.outputType}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step Type</p>
                <p className="mt-1">{step.stepKind || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">System Prompt</p>
                <p className="mt-1 whitespace-pre-wrap font-mono text-slate-400">{step.systemPrompt || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User Prompt</p>
                <p className="mt-1 whitespace-pre-wrap font-mono text-slate-400">{step.userPrompt}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function SimpleFlavorManager({ initialFlavors }: SimpleFlavorManagerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [flavors, setFlavors] = useState(initialFlavors);
  const [flavorQuery, setFlavorQuery] = useState("");
  const [flavorSortMode, setFlavorSortMode] = useState<FlavorSortMode>("recent");
  const [flavorFilterMode, setFlavorFilterMode] = useState<FlavorFilterMode>("all");
  const [selectedFlavorId, setSelectedFlavorId] = useState<string | null>(
    initialFlavors[0]?.id ?? null
  );
  const [editingFlavorId, setEditingFlavorId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [expandedStepIds, setExpandedStepIds] = useState<string[]>([]);
  const [flavorForm, setFlavorForm] = useState<FlavorFormState>(emptyFlavorForm);
  const [stepForm, setStepForm] = useState<StepFormState>(emptyStepForm);
  const [flavorHistory, setFlavorHistory] = useState<FlavorRevisionSnapshot[]>([]);
  const [stepHistory, setStepHistory] = useState<StepRevisionSnapshot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [tutorialTargetRect, setTutorialTargetRect] = useState<DOMRect | null>(null);
  const [pending, startTransition] = useTransition();
  const deferredFlavorQuery = useDeferredValue(flavorQuery);

  const selectedFlavor = flavors.find((flavor) => flavor.id === selectedFlavorId) ?? null;
  const flavorSampleRaw = selectedFlavor?.raw ?? flavors[0]?.raw;
  const stepSampleRaw = selectedFlavor?.steps[0]?.raw;
  const selectedFlavorHistory = useMemo(
    () => flavorHistory.filter((entry) => entry.flavorId === selectedFlavorId || entry.flavorId === null).slice(0, 5),
    [flavorHistory, selectedFlavorId]
  );
  const selectedStepHistory = useMemo(
    () =>
      stepHistory
        .filter((entry) => entry.flavorId === selectedFlavorId && (editingStepId ? entry.stepId === editingStepId : true))
        .slice(0, 5),
    [editingStepId, selectedFlavorId, stepHistory]
  );
  const visibleFlavors = useMemo(() => {
    const query = deferredFlavorQuery.trim().toLowerCase();

    return [...flavors]
      .filter((flavor) => {
        if (flavorFilterMode === "with-steps" && flavor.steps.length === 0) {
          return false;
        }

        if (flavorFilterMode === "without-steps" && flavor.steps.length > 0) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [flavor.name, flavor.slug, flavor.description ?? ""].some((value) =>
          value.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        if (flavorSortMode === "name") {
          return left.name.localeCompare(right.name);
        }

        if (flavorSortMode === "step-count") {
          return right.steps.length - left.steps.length || left.name.localeCompare(right.name);
        }

        return readFlavorUpdatedAt(right).localeCompare(readFlavorUpdatedAt(left));
      });
  }, [deferredFlavorQuery, flavorFilterMode, flavorSortMode, flavors]);
  const tutorialSteps: TutorialStep[] = [
    {
      selector: '[data-tour="flavor-list"]',
      title: "Flavor Library",
      description:
        "Use the left rail to browse humor flavors. Selecting one loads its details and step pipeline into the workspace.",
      example: "Example action: click 'Dry Sarcasm' to inspect the current prompt chain."
    },
    {
      selector: '[data-tour="new-flavor-button"]',
      title: "Create a Flavor",
      description:
        "This starts a fresh flavor definition. The form resets so you can define a new style without overwriting the selected one.",
      example: "Example input: make a flavor called 'Overconfident Wildlife Narrator'."
    },
    {
      selector: '[data-tour="flavor-name"]',
      title: "Flavor Name",
      description:
        "Give the flavor a clear, memorable name. This is the label editors use when choosing a caption style.",
      example: "Example input: Deadpan Disaster Commentary"
    },
    {
      selector: '[data-tour="flavor-description"]',
      title: "Flavor Description",
      description:
        "Summarize the comedic voice in plain English so the team knows the intended tone before reading prompts.",
      example:
        "Example input: Calm, clinical narration for images that are obviously chaotic or embarrassing."
    },
    {
      selector: '[data-tour="flavor-system-prompt"]',
      title: "Flavor System Prompt",
      description:
        "This instruction sets the overall behavior for the flavor. It should describe the voice every downstream step supports.",
      example:
        "Example input: Write with dry understatement, precise phrasing, and zero theatrical excitement."
    },
    {
      selector: '[data-tour="save-flavor-button"]',
      title: "Save Flavor",
      description:
        "Persist your flavor changes after editing the name, slug, description, or system prompt.",
      example: "Example action: save after renaming a flavor to 'Petty Historian'."
    },
    {
      selector: '[data-tour="add-step-button"]',
      title: "Add Step",
      description:
        "Build the pipeline one stage at a time. Each step can classify, describe, or transform the captioning workflow.",
      example: "Example action: add step 1 as 'Image Description'."
    },
    {
      selector: '[data-tour="step-title"]',
      title: "Step Title",
      description:
        "Name the current step so the pipeline reads like an ordered workflow rather than a list of anonymous prompts.",
      example: "Example input: Celebrity Recognition"
    },
    {
      selector: '[data-tour="step-user-prompt"]',
      title: "Step User Prompt",
      description:
        "This is the operational instruction for the current step. Be explicit about what the model should extract or rewrite.",
      example:
        "Example input: Identify the person in the image. If uncertain, return 'unknown'."
    },
    {
      selector: '[data-tour="step-list"]',
      title: "Step Pipeline",
      description:
        "Review saved steps here. You can expand, edit, delete, and drag them to change execution order.",
      example: "Example action: drag 'Punchline Rewrite' after 'Caption Draft'."
    }
  ];
  const activeTutorialStep = tutorialSteps[tutorialIndex] ?? null;

  useEffect(() => {
    setFlavorHistory(readLocalSnapshots<FlavorRevisionSnapshot>(FLAVOR_HISTORY_STORAGE_KEY));
    setStepHistory(readLocalSnapshots<StepRevisionSnapshot>(STEP_HISTORY_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!tutorialOpen || !activeTutorialStep) {
      setTutorialTargetRect(null);
      return;
    }

    const target = document.querySelector(activeTutorialStep.selector);
    if (!(target instanceof HTMLElement)) {
      setTutorialTargetRect(null);
      return;
    }

    target.scrollIntoView({ block: "center", behavior: "smooth" });

    const updateRect = () => setTutorialTargetRect(target.getBoundingClientRect());
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeTutorialStep, tutorialOpen]);

  function recordFlavorRevision(source: string, form: FlavorFormState, flavorId: string | null) {
    const entry: FlavorRevisionSnapshot = {
      id: `${flavorId ?? "draft"}:${Date.now()}`,
      savedAt: new Date().toISOString(),
      source,
      flavorId,
      flavorName: form.name || "Untitled Flavor",
      form
    };

    setFlavorHistory((current) => {
      const next = pushHistoryEntry(current, entry);
      persistLocalSnapshots(FLAVOR_HISTORY_STORAGE_KEY, next);
      return next;
    });
  }

  function recordStepRevision(source: string, form: StepFormState, flavorId: string, stepId: string | null) {
    const entry: StepRevisionSnapshot = {
      id: `${stepId ?? "draft"}:${Date.now()}`,
      savedAt: new Date().toISOString(),
      source,
      flavorId,
      stepId,
      stepTitle: form.title || "Untitled Step",
      form
    };

    setStepHistory((current) => {
      const next = pushHistoryEntry(current, entry);
      persistLocalSnapshots(STEP_HISTORY_STORAGE_KEY, next);
      return next;
    });
  }

  function startCreateFlavor() {
    setEditingFlavorId(null);
    setFlavorForm(emptyFlavorForm());
    setMessage(null);
  }

  function startEditFlavor(flavor: MatrixFlavorRecord) {
    setEditingFlavorId(flavor.id);
    setSelectedFlavorId(flavor.id);
    setFlavorForm({
      name: flavor.name,
      slug: flavor.slug,
      description: flavor.description ?? "",
      systemPrompt: flavor.systemPrompt ?? ""
    });
    setMessage(null);
  }

  function startCreateStep() {
    setEditingStepId(null);
    setStepForm(emptyStepForm());
    setMessage(null);
  }

  function startEditStep(step: MatrixStepRecord) {
    setEditingStepId(step.id);
    setStepForm(toStepForm(step));
    setExpandedStepIds((current) => Array.from(new Set([...current, step.id])));
    setMessage(null);
  }

  function saveFlavor() {
    startTransition(() => {
      void (async () => {
        setMessage(null);

        const payloads = buildFlavorPayloadCandidates(
          {
            ...flavorForm,
            slug: flavorForm.slug || toSlug(flavorForm.name)
          },
          flavorSampleRaw
        );

        if (editingFlavorId) {
          const { error } = await saveWithFallbacks(
            (payload) => supabase.from("humor_flavors").update(payload).eq("id", editingFlavorId),
            payloads
          );

          if (error) {
            setMessage(error.message);
            return;
          }

          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === editingFlavorId
                ? {
                    ...flavor,
                    name: flavorForm.name,
                    slug: flavorForm.slug || toSlug(flavorForm.name),
                    description: flavorForm.description || null,
                    systemPrompt: flavorForm.systemPrompt || null
                  }
                : flavor
            )
          );
          recordFlavorRevision("updated", flavorForm, editingFlavorId);
          setMessage("Flavor updated.");
          return;
        }

        const { data, error } = await saveWithFallbacks(
          (payload) => supabase.from("humor_flavors").insert(payload).select("*").single(),
          payloads
        );

        if (error) {
          setMessage(error.message);
          return;
        }

        const createdFlavor: MatrixFlavorRecord = {
          id: String((data as Record<string, unknown>).id),
          name: flavorForm.name,
          slug: flavorForm.slug || toSlug(flavorForm.name),
          description: flavorForm.description || null,
          systemPrompt: flavorForm.systemPrompt || null,
          steps: [],
          raw: data as Record<string, unknown>
        };

        setFlavors((current) => [createdFlavor, ...current]);
        setSelectedFlavorId(createdFlavor.id);
        setEditingFlavorId(createdFlavor.id);
        recordFlavorRevision("created", flavorForm, createdFlavor.id);
        setMessage("Flavor created.");
      })();
    });
  }

  function deleteFlavor(flavorId: string) {
    startTransition(() => {
      void (async () => {
        setMessage(null);
        const { error } = await supabase.from("humor_flavors").delete().eq("id", flavorId);

        if (error) {
          setMessage(error.message);
          return;
        }

        const nextFlavors = flavors.filter((flavor) => flavor.id !== flavorId);
        setFlavors(nextFlavors);
        setSelectedFlavorId(nextFlavors[0]?.id ?? null);
        if (editingFlavorId === flavorId) {
          setEditingFlavorId(null);
          setFlavorForm(emptyFlavorForm());
        }
        setMessage("Flavor deleted.");
      })();
    });
  }

  function saveStep() {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage(null);
        const orderBy =
          editingStepId == null
            ? selectedFlavor.steps.length + 1
            : selectedFlavor.steps.find((step) => step.id === editingStepId)?.orderBy ?? 1;
        const payloads = buildStepPayloadCandidates(stepForm, selectedFlavor.id, orderBy, stepSampleRaw);

        if (editingStepId) {
          const { data, error } = await saveWithFallbacks(
            (payload) =>
              supabase.from("humor_flavor_steps").update(payload).eq("id", editingStepId).select("*").single(),
            payloads
          );

          if (error) {
            setMessage(error.message);
            return;
          }

          const updatedStep = normalizeSavedStep(data as Record<string, unknown>, stepForm, selectedFlavor.id, orderBy);
          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === selectedFlavor.id
                ? {
                    ...flavor,
                    steps: flavor.steps.map((step) => (step.id === editingStepId ? updatedStep : step))
                  }
                : flavor
            )
          );
          recordStepRevision("updated", stepForm, selectedFlavor.id, editingStepId);
          setMessage("Step updated.");
        } else {
          const { data, error } = await saveWithFallbacks(
            (payload) => supabase.from("humor_flavor_steps").insert(payload).select("*").single(),
            payloads
          );

          if (error) {
            setMessage(error.message);
            return;
          }

          const createdStep = normalizeSavedStep(data as Record<string, unknown>, stepForm, selectedFlavor.id, orderBy);
          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === selectedFlavor.id
                ? {
                    ...flavor,
                    steps: [...flavor.steps, createdStep].sort((left, right) => left.orderBy - right.orderBy)
                  }
                : flavor
            )
          );
          setExpandedStepIds((current) => Array.from(new Set([...current, createdStep.id])));
          recordStepRevision("created", stepForm, selectedFlavor.id, createdStep.id);
          setMessage("Step created.");
        }

        setEditingStepId(null);
        setStepForm(emptyStepForm());
      })();
    });
  }

  function deleteStep(stepId: string) {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage(null);
        const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", stepId);

        if (error) {
          setMessage(error.message);
          return;
        }

        const nextSteps = selectedFlavor.steps
          .filter((step) => step.id !== stepId)
          .map((step, index) => ({ ...step, orderBy: index + 1 }));
        setFlavors((current) =>
          current.map((flavor) =>
            flavor.id === selectedFlavor.id ? { ...flavor, steps: nextSteps } : flavor
          )
        );
        setExpandedStepIds((current) => current.filter((id) => id !== stepId));
        await persistStepOrder(selectedFlavor.id, nextSteps);
        setMessage("Step deleted.");
      })();
    });
  }

  async function persistStepOrder(flavorId: string, steps: MatrixStepRecord[]) {
    for (const [index, step] of steps.entries()) {
      const payloads = [
        {
          humor_flavor_id: flavorId,
          order_by: index + 1
        },
        {
          flavor_id: flavorId,
          execution_order: index + 1
        },
        {
          flavor_id: flavorId,
          order_by: index + 1
        }
      ];

      const { error } = await saveWithFallbacks(
        (payload) => supabase.from("humor_flavor_steps").update(payload).eq("id", step.id),
        payloads
      );

      if (error) {
        setMessage(error.message);
        return;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!selectedFlavor || !event.over || event.active.id === event.over.id) {
      return;
    }

    const overId = event.over.id;
    const oldIndex = selectedFlavor.steps.findIndex((step) => step.id === event.active.id);
    const newIndex = selectedFlavor.steps.findIndex((step) => step.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(selectedFlavor.steps, oldIndex, newIndex).map((step, index) => ({
      ...step,
      orderBy: index + 1
    }));

    setFlavors((current) =>
      current.map((flavor) =>
        flavor.id === selectedFlavor.id ? { ...flavor, steps: reordered } : flavor
      )
    );
    void persistStepOrder(selectedFlavor.id, reordered);
  }

  function toggleStepExpanded(stepId: string) {
    setExpandedStepIds((current) =>
      current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId]
    );
  }

  function duplicateFlavor(flavor: MatrixFlavorRecord) {
    startTransition(() => {
      void (async () => {
        setMessage(null);

        const baseSlug = `${flavor.slug || toSlug(flavor.name)}-copy`;
        let nextSlug = baseSlug;
        let suffix = 2;
        const existingSlugs = new Set(flavors.map((entry) => entry.slug));
        while (existingSlugs.has(nextSlug)) {
          nextSlug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }

        const flavorPayloads = buildFlavorPayloadCandidates(
          {
            name: `${flavor.name} Copy`,
            slug: nextSlug,
            description: flavor.description ?? "",
            systemPrompt: flavor.systemPrompt ?? ""
          },
          flavor.raw
        );

        const { data, error } = await saveWithFallbacks(
          (payload) => supabase.from("humor_flavors").insert(payload).select("*").single(),
          flavorPayloads
        );

        if (error) {
          setMessage(error.message);
          return;
        }

        const createdFlavorId = String((data as Record<string, unknown>).id);
        const copiedSteps: MatrixStepRecord[] = [];

        for (const step of [...flavor.steps].sort((left, right) => left.orderBy - right.orderBy)) {
          const stepPayloads = buildStepPayloadCandidates(toStepForm(step), createdFlavorId, step.orderBy, step.raw);
          const result = await saveWithFallbacks(
            (payload) => supabase.from("humor_flavor_steps").insert(payload).select("*").single(),
            stepPayloads
          );

          if (result.error) {
            setMessage(`Flavor duplicated, but a step copy failed: ${result.error.message}`);
            break;
          }

          copiedSteps.push(
            normalizeSavedStep(result.data as Record<string, unknown>, toStepForm(step), createdFlavorId, step.orderBy)
          );
        }

        const duplicatedFlavor: MatrixFlavorRecord = {
          id: createdFlavorId,
          name: `${flavor.name} Copy`,
          slug: nextSlug,
          description: flavor.description,
          systemPrompt: flavor.systemPrompt,
          steps: copiedSteps,
          raw: data as Record<string, unknown>
        };

        setFlavors((current) => [duplicatedFlavor, ...current]);
        setSelectedFlavorId(duplicatedFlavor.id);
        recordFlavorRevision(
          "duplicated",
          {
            name: duplicatedFlavor.name,
            slug: duplicatedFlavor.slug,
            description: duplicatedFlavor.description ?? "",
            systemPrompt: duplicatedFlavor.systemPrompt ?? ""
          },
          duplicatedFlavor.id
        );
        setMessage("Flavor duplicated.");
      })();
    });
  }

  function duplicateStep(step: MatrixStepRecord) {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage(null);
        const nextOrder = selectedFlavor.steps.length + 1;
        const duplicatedForm = {
          ...toStepForm(step),
          title: `${step.title} Copy`
        };
        const stepPayloads = buildStepPayloadCandidates(duplicatedForm, selectedFlavor.id, nextOrder, step.raw);
        const result = await saveWithFallbacks(
          (payload) => supabase.from("humor_flavor_steps").insert(payload).select("*").single(),
          stepPayloads
        );

        if (result.error) {
          setMessage(result.error.message);
          return;
        }

        const duplicatedStep = normalizeSavedStep(
          result.data as Record<string, unknown>,
          duplicatedForm,
          selectedFlavor.id,
          nextOrder
        );
        setFlavors((current) =>
          current.map((flavor) =>
            flavor.id === selectedFlavor.id
              ? {
                  ...flavor,
                  steps: [...flavor.steps, duplicatedStep].sort((left, right) => left.orderBy - right.orderBy)
                }
              : flavor
          )
        );
        setExpandedStepIds((current) => Array.from(new Set([...current, duplicatedStep.id])));
        recordStepRevision("duplicated", duplicatedForm, selectedFlavor.id, duplicatedStep.id);
        setMessage("Step duplicated.");
      })();
    });
  }

  function openTutorial() {
    setTutorialIndex(0);
    setTutorialOpen(true);
  }

  function closeTutorial() {
    setTutorialOpen(false);
    setTutorialTargetRect(null);
  }

  function goToNextTutorialStep() {
    if (tutorialIndex === tutorialSteps.length - 1) {
      closeTutorial();
      return;
    }

    setTutorialIndex((current) => current + 1);
  }

  function goToPreviousTutorialStep() {
    setTutorialIndex((current) => Math.max(0, current - 1));
  }

  return (
    <main className="min-h-screen bg-[#020617] px-6 py-10 text-slate-100">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[300px,1fr]">
        <aside className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Humor Flavors</p>
              <h1 className="mt-2 text-2xl font-semibold">Flavors and steps</h1>
            </div>
            <AnimatedButton onClick={startCreateFlavor} data-tour="new-flavor-button">
              <Plus className="mr-2 h-4 w-4" />
              New
            </AnimatedButton>
          </div>

          <div className="mt-5 space-y-3 rounded-[1.25rem] border border-slate-800 bg-slate-950/55 p-3">
            <label className="flex items-center gap-3 rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={flavorQuery}
                onChange={(event) => setFlavorQuery(event.target.value)}
                placeholder="Search flavor name, slug, or tone"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid min-w-0 gap-2">
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                </span>
                <select
                  value={flavorFilterMode}
                  onChange={(event) => setFlavorFilterMode(event.target.value as FlavorFilterMode)}
                  className="min-w-0 w-full rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 pr-10 text-sm text-slate-100 outline-none"
                >
                  <option value="all">All flavors</option>
                  <option value="with-steps">With steps</option>
                  <option value="without-steps">Without steps</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sort</span>
                <select
                  value={flavorSortMode}
                  onChange={(event) => setFlavorSortMode(event.target.value as FlavorSortMode)}
                  className="min-w-0 w-full rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 pr-10 text-sm text-slate-100 outline-none"
                >
                  <option value="recent">Recently updated</option>
                  <option value="name">Name A-Z</option>
                  <option value="step-count">Most steps</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 space-y-3" data-tour="flavor-list">
            {visibleFlavors.map((flavor, index) => (
              <motion.button
                key={flavor.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedFlavorId(flavor.id)}
                className={cn(
                  "w-full rounded-[1.25rem] border p-4 text-left",
                  selectedFlavorId === flavor.id
                    ? "border-sky-500/60 bg-sky-500/10"
                    : "border-slate-800 bg-slate-950/50"
                )}
              >
                <p className="font-medium text-slate-100">{flavor.name}</p>
                <p className="mt-1 text-sm text-slate-500">{flavor.slug}</p>
                <p className="mt-2 text-xs text-slate-500">{flavor.steps.length} steps</p>
              </motion.button>
            ))}
            {flavors.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-800 p-5 text-sm text-slate-400">
                No flavors yet. Create your first flavor, add a system prompt, then duplicate it when you want a fast variant.
              </div>
            ) : null}
            {flavors.length > 0 && visibleFlavors.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-800 p-5 text-sm text-slate-400">
                No flavors match the current search or filter. Clear the query or switch back to <span className="font-medium text-slate-200">All flavors</span>.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-6">
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                  {editingFlavorId ? "Edit Flavor" : "New Flavor"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {editingFlavorId ? selectedFlavor?.name ?? "Update flavor" : "Create a new humor flavor"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Define the top-level flavor, then configure the execution steps below.
                </p>
              </div>

              {selectedFlavor ? (
                <div className="flex flex-wrap gap-3">
                  <AnimatedButton glow={false} onClick={() => startEditFlavor(selectedFlavor)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Selected
                  </AnimatedButton>
                  <AnimatedButton glow={false} onClick={() => duplicateFlavor(selectedFlavor)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate Flavor
                  </AnimatedButton>
                  <AnimatedButton
                    glow={false}
                    className="border-rose-500/30 bg-rose-500/10 text-rose-100"
                    onClick={() => deleteFlavor(selectedFlavor.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </AnimatedButton>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Name</span>
                <input
                  value={flavorForm.name}
                  onChange={(event) =>
                    setFlavorForm((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.slug || toSlug(event.target.value)
                    }))
                  }
                  className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                  placeholder="Dry Sarcasm"
                  data-tour="flavor-name"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Slug</span>
                <input
                  value={flavorForm.slug}
                  onChange={(event) =>
                    setFlavorForm((current) => ({
                      ...current,
                      slug: event.target.value
                    }))
                  }
                  className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                  placeholder="dry-sarcasm"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-slate-300">Description</span>
                <textarea
                  rows={3}
                  value={flavorForm.description}
                  onChange={(event) =>
                    setFlavorForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                  className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                  placeholder="What makes this humor flavor distinct?"
                  data-tour="flavor-description"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-slate-300">System Prompt</span>
                <textarea
                  rows={5}
                  value={flavorForm.systemPrompt}
                  onChange={(event) =>
                    setFlavorForm((current) => ({
                      ...current,
                      systemPrompt: event.target.value
                    }))
                  }
                  className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none"
                  placeholder="Define the overall flavor behavior here."
                  data-tour="flavor-system-prompt"
                />
              </label>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{message ?? " "}</p>
                <AnimatedButton
                  onClick={saveFlavor}
                  disabled={pending || flavorForm.name.trim().length === 0}
                  data-tour="save-flavor-button"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {pending ? "Saving..." : editingFlavorId ? "Save Flavor" : "Create Flavor"}
                </AnimatedButton>
              </div>

              <div className="rounded-[1.15rem] border border-slate-800 bg-[#020817] p-4">
                <div className="flex items-center gap-2 text-sm text-cyan-300">
                  <History className="h-4 w-4" />
                  Flavor revision history
                </div>
                <div className="mt-4 space-y-3">
                  {selectedFlavorHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-800 bg-slate-950/55 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{entry.flavorName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {entry.source} • {new Date(entry.savedAt).toLocaleString()}
                        </p>
                      </div>
                      <AnimatedButton
                        glow={false}
                        className="px-3 py-2 text-xs"
                        onClick={() => {
                          setEditingFlavorId(entry.flavorId);
                          setSelectedFlavorId(entry.flavorId);
                          setFlavorForm(entry.form);
                          setMessage(`Loaded flavor revision from ${new Date(entry.savedAt).toLocaleString()}. Save to restore it.`);
                        }}
                      >
                        Restore
                      </AnimatedButton>
                    </div>
                  ))}
                  {selectedFlavorHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Save a flavor once and its recent revisions will appear here for quick rollback.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-6">
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Flavor Steps</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {selectedFlavor ? `${selectedFlavor.name} pipeline` : "Select a flavor"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Outputs from earlier steps can be referenced with <span className="font-mono text-cyan-300">{"{{step_1_output}}"}</span>.
                </p>
              </div>

              <AnimatedButton
                onClick={startCreateStep}
                disabled={!selectedFlavor}
                data-tour="add-step-button"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </AnimatedButton>
            </div>

            {selectedFlavor ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[380px,1fr]">
                <div className="space-y-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-slate-300">Step Title</span>
                    <input
                      value={stepForm.title}
                      onChange={(event) => setStepForm((current) => ({ ...current, title: event.target.value }))}
                      className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                      placeholder="Celebrity Recognition"
                      data-tour="step-title"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-slate-300">Step Description</span>
                    <textarea
                      rows={3}
                      value={stepForm.description}
                      onChange={(event) => setStepForm((current) => ({ ...current, description: event.target.value }))}
                      className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                      placeholder="What this step is responsible for."
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-slate-300">Model</span>
                      <input
                        value={stepForm.modelId}
                        onChange={(event) => setStepForm((current) => ({ ...current, modelId: event.target.value }))}
                        className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                        placeholder="gpt-4.1-mini"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-slate-300">Temperature: {stepForm.temperature.toFixed(1)}</span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={stepForm.temperature}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            temperature: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-slate-300">Input Type</span>
                      <select
                        value={stepForm.inputType}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            inputType: event.target.value as "image+text" | "text"
                          }))
                        }
                        className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                      >
                        <option value="text">Text only</option>
                        <option value="image+text">Image + text</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-slate-300">Output Type</span>
                      <select
                        value={stepForm.outputType}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            outputType: event.target.value as "string" | "array"
                          }))
                        }
                        className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                      >
                        <option value="string">String</option>
                        <option value="array">Array</option>
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm text-slate-300">Step Type</span>
                    <input
                      value={stepForm.stepKind}
                      onChange={(event) =>
                        setStepForm((current) => {
                          const nextKind = event.target.value;
                          const isCachedType =
                            nextKind === "celebrity_recognition" || nextKind === "image_description";
                          return {
                            ...current,
                            stepKind: nextKind,
                            reuseCachedAdminValues: isCachedType ? current.reuseCachedAdminValues : false
                          };
                        })
                      }
                      className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                      placeholder="celebrity_recognition"
                    />
                  </label>

                  {stepForm.stepKind === "celebrity_recognition" || stepForm.stepKind === "image_description" ? (
                    <label className="flex items-center gap-3 rounded-[1rem] border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={stepForm.reuseCachedAdminValues}
                        onChange={(event) =>
                          setStepForm((current) => ({
                            ...current,
                            reuseCachedAdminValues: event.target.checked
                          }))
                        }
                      />
                      Reuse cached admin values for this step
                    </label>
                  ) : null}

                  <label className="grid gap-2">
                    <span className="text-sm text-slate-300">System Prompt</span>
                    <textarea
                      rows={4}
                      value={stepForm.systemPrompt}
                      onChange={(event) =>
                        setStepForm((current) => ({ ...current, systemPrompt: event.target.value }))
                      }
                      className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-slate-300">User Prompt</span>
                    <textarea
                      rows={7}
                      value={stepForm.userPrompt}
                      onChange={(event) =>
                        setStepForm((current) => ({ ...current, userPrompt: event.target.value }))
                      }
                      className="rounded-[1rem] border border-slate-800 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none"
                      placeholder="Use {{step_1_output}} to reference earlier outputs."
                      data-tour="step-user-prompt"
                    />
                  </label>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Placeholder syntax: <span className="font-mono text-cyan-300">{"{{step_1_output}}"}</span>
                    </p>
                    <AnimatedButton onClick={saveStep} disabled={pending || stepForm.title.trim().length === 0}>
                      <Save className="mr-2 h-4 w-4" />
                      {editingStepId ? "Save Step" : "Create Step"}
                    </AnimatedButton>
                  </div>

                  <div className="rounded-[1.15rem] border border-slate-800 bg-[#020817] p-4">
                    <div className="flex items-center gap-2 text-sm text-cyan-300">
                      <History className="h-4 w-4" />
                      Step revision history
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedStepHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-800 bg-slate-950/55 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">{entry.stepTitle}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                              {entry.source} • {new Date(entry.savedAt).toLocaleString()}
                            </p>
                          </div>
                          <AnimatedButton
                            glow={false}
                            className="px-3 py-2 text-xs"
                            onClick={() => {
                              setEditingStepId(entry.stepId);
                              setStepForm(entry.form);
                              setMessage(`Loaded step revision from ${new Date(entry.savedAt).toLocaleString()}. Save to restore it.`);
                            }}
                          >
                            Restore
                          </AnimatedButton>
                        </div>
                      ))}
                      {selectedStepHistory.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Save or duplicate a step to create a revision trail you can restore into the editor.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={selectedFlavor.steps.map((step) => step.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3" data-tour="step-list">
                        {selectedFlavor.steps.map((step) => (
                          <SortableStepCard
                            key={step.id}
                            step={step}
                            expanded={expandedStepIds.includes(step.id)}
                            onToggle={() => toggleStepExpanded(step.id)}
                            onEdit={() => startEditStep(step)}
                            onDuplicate={() => duplicateStep(step)}
                            onDelete={() => deleteStep(step.id)}
                          />
                        ))}
                        {selectedFlavor.steps.length === 0 ? (
                          <div className="rounded-[1.15rem] border border-dashed border-slate-800 p-6 text-sm text-slate-400">
                            No steps yet. Start with an image description or classification step, then duplicate it to branch into alternate caption variants.
                          </div>
                        ) : null}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.15rem] border border-dashed border-slate-800 p-6 text-sm text-slate-400">
                Create a flavor first, then add one or two foundational steps before tuning the rest of the chain.
              </div>
            )}
          </section>
        </div>
      </div>
      <button
        type="button"
        onClick={openTutorial}
        className="fixed bottom-5 left-5 z-30 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-slate-950/88 px-4 py-3 text-sm font-medium text-cyan-100 shadow-[0_18px_60px_-24px_rgba(34,211,238,0.65)] transition hover:border-cyan-300 hover:bg-slate-950"
      >
        <GraduationCap className="h-4 w-4" />
        App Tutorial
      </button>
      {tutorialOpen && activeTutorialStep ? (
        <TutorialOverlay
          step={activeTutorialStep}
          stepIndex={tutorialIndex}
          totalSteps={tutorialSteps.length}
          targetRect={tutorialTargetRect}
          onClose={closeTutorial}
          onNext={goToNextTutorialStep}
          onPrevious={goToPreviousTutorialStep}
        />
      ) : null}
    </main>
  );
}
