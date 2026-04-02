import { cache } from "react";
import { notFound } from "next/navigation";

import type { ProfileRecord } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentAdminProfile = cache(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,is_superadmin,is_matrix_admin")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const allowed = Boolean(data.is_superadmin || data.is_matrix_admin);

  return {
    user,
    profile: data as ProfileRecord,
    allowed
  };
});

export async function requireAdminProfile() {
  const result = await getCurrentAdminProfile();

  if (!result?.allowed) {
    notFound();
  }

  return result;
}
