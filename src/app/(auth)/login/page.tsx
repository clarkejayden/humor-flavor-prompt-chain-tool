import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen page-gradient flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold">Humor Flavor Prompt Tool</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your Google account to continue.
          </p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
