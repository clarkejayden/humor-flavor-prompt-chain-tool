import { MatrixErrorState } from "@/components/matrix-error-state";
import { RequestAccess } from "@/components/request-access";
import { LoginScreen } from "@/components/auth/login-screen";
import { SimpleFlavorManager } from "@/components/simple-flavor-manager";
import { fetchMatrixBootstrap } from "@/lib/data/matrix";
import { getSupabaseEnvErrorMessage, hasSupabaseEnv } from "@/lib/supabase/config";
import { getCurrentAdminProfile, requireAdminProfile } from "@/lib/supabase/admin";

export default async function FlavorEditorPage() {
  if (!hasSupabaseEnv()) {
    return (
      <MatrixErrorState
        title="Supabase environment is not configured"
        message="The editor cannot load until the public Supabase URL and anon key are set."
        details={getSupabaseEnvErrorMessage() ?? undefined}
      />
    );
  }

  const adminContext = await getCurrentAdminProfile();

  if (!adminContext?.user) {
    return <LoginScreen />;
  }

  if (!adminContext.allowed) {
    return <RequestAccess />;
  }

  await requireAdminProfile();

  try {
    const bootstrap = await fetchMatrixBootstrap();

    return <SimpleFlavorManager initialFlavors={bootstrap.flavors} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Matrix bootstrap failure.";
    return (
      <MatrixErrorState
        title="Unable to reach Supabase"
        message="The Matrix cannot load its bootstrap data because the configured Supabase host is unreachable."
        details={message}
      />
    );
  }
}
