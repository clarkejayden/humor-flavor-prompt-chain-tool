import Link from "next/link";

import { LoginScreen } from "@/components/auth/login-screen";
import { RequestAccess } from "@/components/request-access";
import { hasSupabaseEnv, getSupabaseEnvErrorMessage } from "@/lib/supabase/config";
import { getCurrentAdminProfile } from "@/lib/supabase/admin";

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="glass-panel max-w-2xl rounded-[2rem] p-10 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-amber-400">
            Environment Setup
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-50 dark:text-slate-50">
            Supabase configuration is missing.
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Add the required public Supabase variables to <code>.env.local</code> before using the admin workspace.
          </p>
          <pre className="mt-8 overflow-x-auto rounded-[1.5rem] border border-slate-800 bg-[#01050d] p-4 text-left text-sm text-slate-400">
            {getSupabaseEnvErrorMessage()}
          </pre>
        </div>
      </main>
    );
  }

  const adminContext = await getCurrentAdminProfile();

  if (!adminContext?.user) {
    return <LoginScreen />;
  }

  if (!adminContext.allowed) {
    return <RequestAccess />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel max-w-2xl rounded-[2rem] p-10 text-center">
        <p className="text-sm uppercase tracking-[0.32em] text-sky-400">
          Humor Flavors
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-50 dark:text-slate-50">
          Admin management workspace for prompt-chain flavors.
        </h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
          Use the guarded editor to manage sequential chain steps, images, and API test runs.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/admin/flavors"
            className="inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-6 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-500/25 dark:text-sky-100"
          >
            Open Flavor Editor
          </Link>
        </div>
      </div>
    </main>
  );
}
