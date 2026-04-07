"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account"
          }
        }
      });

      if (signInError) {
        throw signInError;
      }
    } catch (caughtError) {
      setPending(false);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start sign-in.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950/65 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.38em] text-cyan-400">Super Admin Access</p>
        <div className="mt-5 inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 p-4 text-cyan-200">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-4xl font-semibold text-slate-100">
          Sign in to manage humor flavors.
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Access is limited to authenticated super admins. Continue with OAuth to verify your account.
        </p>
        <div className="mt-8">
          <AnimatedButton onClick={signIn} disabled={pending} className="px-6 py-3">
            {pending ? "Redirecting..." : "Continue with Google"}
          </AnimatedButton>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Configure the Google OAuth provider in Supabase if sign-in is not yet enabled.
        </p>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </main>
  );
}
