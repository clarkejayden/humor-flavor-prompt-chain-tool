import { getImagePublicUrl } from "@/lib/images";
import { getCurrentAdminProfile, requireAdminProfile } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  MatrixAuthContext,
  MatrixCaptionRecord,
  MatrixExperimentBootstrap,
  MatrixFlavorRecord,
  MatrixImageRecord,
  MatrixResponseRecord,
  MatrixStepRecord
} from "@/lib/matrix/types";

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toRawRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeAuth(
  adminContext: Awaited<ReturnType<typeof getCurrentAdminProfile>>
): MatrixAuthContext {
  return {
    userId: adminContext?.user.id ?? null,
    email: adminContext?.user.email ?? null,
    isSuperadmin: Boolean(adminContext?.profile.is_superadmin),
    isMatrixAdmin: Boolean(adminContext?.profile.is_matrix_admin),
    allowed: Boolean(adminContext?.allowed)
  };
}

function normalizeFlavor(row: Record<string, unknown>): MatrixFlavorRecord {
  const name =
    readString(row.name) ||
    readString(row.title) ||
    readString(row.flavor_name) ||
    readString(row.label) ||
    "Untitled Flavor";

  return {
    id: readString(row.id),
    name,
    slug: readString(row.slug) || slugify(name),
    description:
      readNullableString(row.description) ??
      readNullableString(row.summary) ??
      readNullableString(row.subtitle),
    systemPrompt:
      readNullableString(row.llm_system_prompt) ??
      readNullableString(row.system_prompt) ??
      readNullableString(row.prompt),
    steps: [],
    raw: row
  };
}

function normalizeStep(row: Record<string, unknown>): MatrixStepRecord {
  const title =
    readString(row.title) ||
    readString(row.name) ||
    readString(row.step_name) ||
    readString(row.label) ||
    "Untitled Step";
  const stepKind =
    readNullableString(row.step_kind) ??
    readNullableString(row.kind) ??
    readNullableString(row.step_type);
  const inputType =
    readString(row.input_type) === "text"
      ? "text"
      : readString(row.input_type) === "image+text"
        ? "image+text"
        : stepKind?.toLowerCase().includes("analysis")
          ? "image+text"
          : "text";
  const outputType =
    readString(row.output_type) === "array" ? "array" : "string";

  return {
    id: readString(row.id),
    flavorId:
      readString(row.humor_flavor_id) ||
      readString(row.flavor_id),
    title,
    description:
      readNullableString(row.step_description) ??
      readNullableString(row.description) ??
      readNullableString(row.summary),
    systemPrompt:
      readNullableString(row.system_prompt) ??
      readNullableString(row.llm_system_prompt),
    userPrompt:
      readString(row.user_prompt) ||
      readString(row.llm_user_prompt) ||
      readString(row.prompt),
    prompt:
      readString(row.llm_user_prompt) ||
      readString(row.user_prompt) ||
      readString(row.prompt),
    orderBy:
      typeof row.order_by === "number"
        ? row.order_by
        : typeof row.step_order === "number"
          ? row.step_order
          : typeof row.position === "number"
            ? row.position
            : 1,
    inputType,
    outputType,
    modelId:
      readNullableString(row.model_id) ??
      readNullableString(row.llm_model_id),
    temperature: readNumber(row.temperature),
    stepKind,
    reuseCachedAdminValues:
      readBoolean(row.reuse_cached_admin_values) ??
      readBoolean(row.use_cached_values) ??
      (stepKind === "celebrity_recognition" || stepKind === "image_description"),
    imageId:
      readNullableString(row.image_id) ??
      readNullableString(row.images_id),
    raw: row
  };
}

function normalizeImage(
  row: Record<string, unknown>,
  publicUrl: string | null
): MatrixImageRecord {
  const loadedValues = {
    celebrity_recognition:
      readString(row.celebrity_recognition) ||
      readString(row.celebrity_name),
    image_description:
      readString(row.image_description) ||
      readString(row.description) ||
      readString(row.alt_text)
  };

  return {
    id: readString(row.id),
    title:
      readString(row.title) ||
      readString(row.name) ||
      readString(row.filename) ||
      "Untitled Image",
    publicUrl,
    createdAt:
      readString(row.created_at) ||
      new Date(0).toISOString(),
    loadedValues: Object.fromEntries(
      Object.entries(loadedValues).filter(([, value]) => value.trim().length > 0)
    ),
    raw: row
  };
}

function normalizeCaption(
  row: Record<string, unknown>,
  imageMap: Map<string, MatrixImageRecord>,
  flavorMap: Map<string, MatrixFlavorRecord>
): MatrixCaptionRecord {
  const imageId = readString(row.image_id);
  const flavorId =
    readString(row.humor_flavor_id) ||
    readString(row.flavor_id);

  return {
    id: readString(row.id),
    imageId,
    flavorId,
    caption:
      readString(row.caption) ||
      readString(row.text) ||
      readString(row.output_text),
    createdAt:
      readString(row.created_at) ||
      new Date(0).toISOString(),
    imageTitle: imageMap.get(imageId)?.title ?? null,
    flavorName: flavorMap.get(flavorId)?.name ?? null,
    processingTimeSeconds:
      readNumber(row.processing_time_seconds) ??
      readNumber(row.processing_seconds),
    modelId:
      readNullableString(row.model_id) ??
      readNullableString(row.llm_model_id)
  };
}

function normalizeResponse(row: Record<string, unknown>): MatrixResponseRecord {
  return {
    id: readString(row.id),
    imageId: readNullableString(row.image_id),
    flavorId:
      readNullableString(row.humor_flavor_id) ??
      readNullableString(row.flavor_id),
    stepId: readNullableString(row.humor_flavor_step_id) ?? readNullableString(row.step_id),
    outputText:
      readString(row.output_text) ||
      readString(row.response_text) ||
      readString(row.output) ||
      readString(row.text),
    modelId:
      readNullableString(row.model_id) ??
      readNullableString(row.llm_model_id),
    temperature: readNumber(row.temperature),
    processingTimeSeconds:
      readNumber(row.processing_time_seconds) ??
      readNumber(row.processing_seconds),
    createdAt:
      readString(row.created_at) ||
      new Date(0).toISOString()
  };
}

export async function fetchMatrixBootstrap(): Promise<MatrixExperimentBootstrap> {
  const supabase = createSupabaseServerClient();
  const adminContext = await requireAdminProfile();
  const auth = normalizeAuth(adminContext);

  const [{ data: flavorRows, error: flavorError }, { data: imageRows, error: imageError }] =
    await Promise.all([
      supabase.from("humor_flavors").select("*"),
      supabase.from("images").select("*")
    ]);

  if (flavorError) {
    throw flavorError;
  }

  if (imageError) {
    throw imageError;
  }

  const flavors = ((flavorRows ?? []) as Record<string, unknown>[]).map(normalizeFlavor);
  const flavorMap = new Map(flavors.map((flavor) => [flavor.id, flavor]));

  const { data: stepRows, error: stepError } = await supabase
    .from("humor_flavor_steps")
    .select("*");

  if (stepError) {
    throw stepError;
  }

  const steps = ((stepRows ?? []) as Record<string, unknown>[])
    .map(normalizeStep)
    .sort((left, right) => left.orderBy - right.orderBy);

  for (const step of steps) {
    const flavor = flavorMap.get(step.flavorId);
    if (flavor) {
      flavor.steps.push(step);
    }
  }

  const images = ((imageRows ?? []) as Record<string, unknown>[])
    .map((row) => {
      const raw = toRawRecord(row);
      const path =
        readNullableString(raw.object_path) ??
        readNullableString(raw.storage_path);
      const bucket = readNullableString(raw.bucket_id) ?? "images";
      const publicUrl = readNullableString(raw.public_url) ??
        (path ? getImagePublicUrl(supabase, { bucket_id: bucket, object_path: path }) : null);

      return normalizeImage(raw, publicUrl);
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const imageMap = new Map(images.map((image) => [image.id, image]));

  const [{ data: captionRows, error: captionsError }, { data: responseRows, error: responsesError }] =
    await Promise.all([
      supabase.from("captions").select("*").limit(250),
      supabase.from("llm_model_responses").select("*").limit(250)
    ]);

  if (captionsError) {
    console.warn("Matrix bootstrap: captions fetch failed", captionsError.message);
  }

  if (responsesError) {
    console.warn("Matrix bootstrap: llm_model_responses fetch failed", responsesError.message);
  }

  const captions = ((captionRows ?? []) as Record<string, unknown>[])
    .map((row) => normalizeCaption(row, imageMap, flavorMap))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const responses = ((responseRows ?? []) as Record<string, unknown>[])
    .map(normalizeResponse)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    auth,
    flavors: Array.from(flavorMap.values()).sort((left, right) => left.name.localeCompare(right.name)),
    images,
    captions,
    responses
  };
}
