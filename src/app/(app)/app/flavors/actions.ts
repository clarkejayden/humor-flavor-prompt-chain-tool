"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const flavorSchema = z.object({
  name: z.string().min(2, "Name is required")
});

export async function createFlavor(formData: FormData) {
  const values = flavorSchema.safeParse({
    name: formData.get("name")
  });

  if (!values.success) {
    return { error: values.error.errors[0]?.message ?? "Invalid data" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("humor_flavors").insert({
    name: values.data.name
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/flavors");
  return { error: null };
}

export async function updateFlavor(formData: FormData) {
  const id = formData.get("id");
  const values = flavorSchema.safeParse({
    name: formData.get("name")
  });

  if (!id || !values.success) {
    return { error: "Invalid data" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("humor_flavors")
    .update({ name: values.data.name })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/flavors/${id}`);
  revalidatePath("/app/flavors");
  return { error: null };
}

export async function deleteFlavor(formData: FormData) {
  const id = formData.get("id");
  if (!id) {
    return { error: "Missing flavor id" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("humor_flavors").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/flavors");
  return { error: null };
}
