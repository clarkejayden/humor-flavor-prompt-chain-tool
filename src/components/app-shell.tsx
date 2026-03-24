import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen page-gradient">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Prompt Chain Tool
            </span>
            <nav className="hidden items-center gap-4 text-sm font-medium text-muted-foreground md:flex">
              <Link className="hover:text-foreground" href="/app">
                Overview
              </Link>
              <Link className="hover:text-foreground" href="/app/flavors">
                Flavors
              </Link>
              <Link className="hover:text-foreground" href="/app/test">
                Test
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/flavors">Manage Flavors</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
