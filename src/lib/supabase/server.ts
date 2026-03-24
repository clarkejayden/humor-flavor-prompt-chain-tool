import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookies().get(name)?.value;
      },
      set(name, value, options) {
        cookies().set({ name, value, ...options });
      },
      remove(name, options) {
        cookies().set({ name, value: "", ...options });
      }
    }
  });
}
