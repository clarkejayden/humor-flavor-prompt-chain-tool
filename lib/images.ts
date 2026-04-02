import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageRecord } from "@/lib/supabase/types";

export function resolveImageStoragePath(image: Partial<ImageRecord>) {
  return image.object_path ?? image.storage_path ?? null;
}

export function resolveImageBucket(image: Partial<ImageRecord>) {
  return image.bucket_id ?? "images";
}

export function getImagePublicUrl(
  supabase: SupabaseClient,
  image: Partial<ImageRecord> | null | undefined
) {
  if (!image) {
    return null;
  }

  if (image.public_url) {
    return image.public_url;
  }

  const path = resolveImageStoragePath(image);

  if (!path) {
    return null;
  }

  const { data } = supabase.storage.from(resolveImageBucket(image)).getPublicUrl(path);
  return data.publicUrl;
}
