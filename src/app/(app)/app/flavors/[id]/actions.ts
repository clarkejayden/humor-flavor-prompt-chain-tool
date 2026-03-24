"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const stepSchema = z.object({
  prompt: z.string().min(4, "Prompt is required"),
  description: z.string().optional()
});

export async function createStep(formData: FormData) {
  const flavorId = formData.get("flavorId")?.toString();
  const values = stepSchema.safeParse({
    prompt: formData.get("prompt"),
    description: formData.get("description") || null
  });

  if (!flavorId || !values.success) {
    return { error: "Invalid step data" };
  }

  const supabase = createClient();
  const { data: currentSteps } = await supabase
    .from("humor_flavor_steps")
    .select("step_order")
    .eq("flavor_id", flavorId)
    .order("step_order", { ascending: false })
    .limit(1);

  const nextOrder = (currentSteps?.[0]?.step_order ?? 0) + 1;

  const { error } = await supabase.from("humor_flavor_steps").insert({
    flavor_id: flavorId,
    step_order: nextOrder,
    prompt: values.data.prompt,
    description: values.data.description
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/flavors/${flavorId}`);
  return { error: null };
}

export async function updateStep(formData: FormData) {
  const id = formData.get("id")?.toString();
  const flavorId = formData.get("flavorId")?.toString();
  const values = stepSchema.safeParse({
    prompt: formData.get("prompt"),
    description: formData.get("description") || null
  });

  if (!id || !flavorId || !values.success) {
    return { error: "Invalid step data" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("humor_flavor_steps")
    .update({
      prompt: values.data.prompt,
      description: values.data.description
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/flavors/${flavorId}`);
  return { error: null };
}

export async function deleteStep(formData: FormData) {
  const id = formData.get("id")?.toString();
  const flavorId = formData.get("flavorId")?.toString();
  if (!id || !flavorId) {
    return { error: "Missing step id" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await normalizeStepOrder(flavorId);
  revalidatePath(`/app/flavors/${flavorId}`);
  return { error: null };
}

export async function moveStep(formData: FormData) {
  const flavorId = formData.get("flavorId")?.toString();
  const stepId = formData.get("stepId")?.toString();
  const direction = formData.get("direction")?.toString();

  if (!flavorId || !stepId || (direction !== "up" && direction !== "down")) {
    return { error: "Invalid request" };
  }

  const supabase = createClient();
  const { data: steps, error } = await supabase
    .from("humor_flavor_steps")
    .select("id,step_order")
    .eq("flavor_id", flavorId)
    .order("step_order");

  if (error || !steps) {
    return { error: error?.message ?? "Failed to load steps" };
  }

  const index = steps.findIndex((step) => step.id === stepId);
  if (index === -1) {
    return { error: "Step not found" };
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= steps.length) {
    return { error: null };
  }

  const reordered = [...steps];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  const updates = reordered.map((step, idx) => ({
    id: step.id,
    step_order: idx + 1
  }));

  const { error: updateError } = await supabase
    .from("humor_flavor_steps")
    .upsert(updates);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/app/flavors/${flavorId}`);
  return { error: null };
}

async function normalizeStepOrder(flavorId: string) {
  const supabase = createClient();
  const { data: steps } = await supabase
    .from("humor_flavor_steps")
    .select("id")
    .eq("flavor_id", flavorId)
    .order("step_order");

  if (!steps) {
    return;
  }

  const updates = steps.map((step, index) => ({
    id: step.id,
    step_order: index + 1
  }));

  if (updates.length > 0) {
    await supabase.from("humor_flavor_steps").upsert(updates);
  }
}
