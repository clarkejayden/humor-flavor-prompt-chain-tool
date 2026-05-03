import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getCurrentAdminProfile } from "@/lib/supabase/admin";

import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Chain Tool | Humor flavors",
  description: "Manage humor flavor steps, run caption tests against api.almostcrackd.ai, and review stored captions."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminContext = hasSupabaseEnv() ? await getCurrentAdminProfile() : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans"
        style={
          {
            "--font-sans":
              '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif'
          } as CSSProperties
        }
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="mesh-overlay" />
          {adminContext?.user ? (
            <div className="pointer-events-none fixed right-5 top-5 z-40">
              <div className="pointer-events-auto flex items-center gap-2">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          ) : null}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
