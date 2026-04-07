import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseEnvErrorMessage } from "@/lib/supabase/config";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envError = getSupabaseEnvErrorMessage();

  if (envError || !url || !anonKey) {
    throw new Error(envError ?? "Missing Supabase environment variables.");
  }

  return { url, anonKey };
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components may not be allowed to write cookies during render.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Server Components may not be allowed to write cookies during render.
        }
      }
    }
  });
}
