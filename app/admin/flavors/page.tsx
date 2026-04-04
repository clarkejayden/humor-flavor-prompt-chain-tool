import { MatrixErrorState } from "@/components/matrix-error-state";
import { SimpleFlavorManager } from "@/components/simple-flavor-manager";
import { fetchMatrixBootstrap } from "@/lib/data/matrix";
import { requireAdminProfile } from "@/lib/supabase/admin";

export default async function FlavorEditorPage() {
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
