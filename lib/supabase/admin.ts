import { cache } from "react";

import type { ProfileRecord } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isAllowedAdminProfile(
  profile: Pick<ProfileRecord, "is_superadmin" | "is_matrix_admin"> | null
) {
  return profile?.is_superadmin === true || profile?.is_matrix_admin === true;
}

export const getCurrentAdminProfile = cache(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      allowed: false
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,is_superadmin,is_matrix_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const allowed = isAllowedAdminProfile(data as ProfileRecord);

  return {
    user,
    profile: data as ProfileRecord,
    allowed
  };
});

export async function requireAdminProfile() {
  const adminContext = await getCurrentAdminProfile();

  if (!adminContext?.user) {
    throw new Error("Authentication required.");
  }

  if (!adminContext.allowed) {
    throw new Error("Admin access requires is_superadmin or is_matrix_admin.");
  }

  return adminContext;
}
