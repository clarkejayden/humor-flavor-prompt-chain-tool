import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen page-gradient flex items-center justify-center px-6">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-lg">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested does not exist.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
