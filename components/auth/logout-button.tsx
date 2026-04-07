"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <AnimatedButton glow={false} onClick={signOut} className="border-slate-700 bg-slate-950/70 text-slate-100">
      <LogOut className="mr-2 h-4 w-4" />
      Log Out
    </AnimatedButton>
  );
}
