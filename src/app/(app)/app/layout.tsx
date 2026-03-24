import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { authorized } = await requireAdmin();

  if (!authorized) {
    return (
      <div className="min-h-screen page-gradient flex items-center justify-center px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-lg">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to view this application.
          </p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
