import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  is_superadmin: boolean | null;
  is_matrix_admin: boolean | null;
};

export async function requireUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return data.user;
}

export async function getAdminStatus() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user ?? null;

  if (!user) {
    return { authorized: false, user: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,is_superadmin,is_matrix_admin")
    .eq("id", user.id)
    .single<AdminProfile>();

  if (error || !data) {
    return { authorized: false, user };
  }

  const authorized = Boolean(data.is_superadmin || data.is_matrix_admin);
  return { authorized, user };
}

export async function requireAdmin() {
  const { authorized, user } = await getAdminStatus();

  if (!user) {
    redirect("/login");
  }

  return { authorized, user };
}
