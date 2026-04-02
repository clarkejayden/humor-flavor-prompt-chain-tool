import type {
  FlavorWithSteps,
  HumorFlavorRecord,
  HumorFlavorStepRecord,
  ImageRecord
} from "@/lib/supabase/types";
import { getImagePublicUrl } from "@/lib/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeFlavorRecord(row: Record<string, unknown>): HumorFlavorRecord {
  const id = readString(row.id);
  const name =
    readString(row.name) ||
    readString(row.title) ||
    readString(row.flavor_name) ||
    readString(row.label) ||
    `Flavor ${id.slice(0, 8)}`;

  const slug =
    readString(row.slug) ||
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return {
    id,
    name,
    slug,
    description:
      readNullableString(row.description) ??
      readNullableString(row.subtitle) ??
      readNullableString(row.summary),
    llm_system_prompt:
      readNullableString(row.llm_system_prompt) ??
      readNullableString(row.system_prompt) ??
      readNullableString(row.prompt),
    created_at:
      readString(row.created_at) || new Date(0).toISOString(),
    updated_at:
      readString(row.updated_at) ||
      readString(row.created_at) ||
      new Date(0).toISOString()
  };
}

function normalizeStepRecord(row: Record<string, unknown>): HumorFlavorStepRecord {
  return {
    id: readString(row.id),
    humor_flavor_id:
      readString(row.humor_flavor_id) ||
      readString(row.flavor_id),
    title:
      readString(row.title) ||
      readString(row.name) ||
      readString(row.step_name) ||
      readString(row.label) ||
      "Untitled step",
    llm_user_prompt:
      readString(row.llm_user_prompt) ||
      readString(row.user_prompt) ||
      readString(row.prompt),
    order_by:
      typeof row.order_by === "number"
        ? row.order_by
        : typeof row.step_order === "number"
          ? row.step_order
          : typeof row.position === "number"
            ? row.position
            : 1,
    image_id:
      readNullableString(row.image_id) ??
      readNullableString(row.images_id),
    created_at:
      readString(row.created_at) || new Date(0).toISOString(),
    updated_at:
      readString(row.updated_at) ||
      readString(row.created_at) ||
      new Date(0).toISOString()
  };
}

export async function fetchFlavorEditorData(): Promise<FlavorWithSteps[]> {
  const supabase = createSupabaseServerClient();

  const { data: flavors, error: flavorsError } = await supabase
    .from("humor_flavors")
    .select("*");

  if (flavorsError) {
    throw flavorsError;
  }

  const normalizedFlavors = ((flavors ?? []) as Record<string, unknown>[])
    .map(normalizeFlavorRecord)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const flavorIds = normalizedFlavors.map((flavor) => flavor.id);

  if (flavorIds.length === 0) {
    return [];
  }

  const { data: steps, error: stepsError } = await supabase
    .from("humor_flavor_steps")
    .select("*")
    .in("humor_flavor_id", flavorIds)
    .returns<Record<string, unknown>[]>();

  if (stepsError) {
    throw stepsError;
  }

  const normalizedSteps = ((steps ?? []) as Record<string, unknown>[])
    .map(normalizeStepRecord)
    .sort((left, right) => left.order_by - right.order_by);

  const imageIds = Array.from(
    new Set(normalizedSteps.map((step) => step.image_id).filter(Boolean))
  ) as string[];

  const imageMap = new Map<string, ImageRecord>();

  if (imageIds.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("id,title,bucket_id,object_path,storage_path,public_url")
      .in("id", imageIds)
      .returns<ImageRecord[]>();

    if (imagesError) {
      throw imagesError;
    }

    for (const image of images ?? []) {
      imageMap.set(image.id, {
        ...image,
        public_url: getImagePublicUrl(supabase, image)
      });
    }
  }

  const stepsByFlavorId = new Map<string, FlavorWithSteps["steps"]>();

  for (const step of normalizedSteps) {
    const flavorSteps = stepsByFlavorId.get(step.humor_flavor_id) ?? [];
    flavorSteps.push({
      ...step,
      image: step.image_id ? imageMap.get(step.image_id) ?? null : null
    });
    stepsByFlavorId.set(step.humor_flavor_id, flavorSteps);
  }

  return normalizedFlavors.map((flavor) => ({
    ...flavor,
    steps: stepsByFlavorId.get(flavor.id) ?? []
  }));
}
