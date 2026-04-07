import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvErrorMessage } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envError = getSupabaseEnvErrorMessage();

  if (envError || !url || !anonKey) {
    throw new Error(envError ?? "Missing Supabase environment variables.");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
