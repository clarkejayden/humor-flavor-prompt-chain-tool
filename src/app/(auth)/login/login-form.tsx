"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`
      }
    });
    setLoading(false);
  };

  return (
    <Button className="w-full" onClick={handleLogin} disabled={loading}>
      {loading ? "Redirecting..." : "Continue with Google"}
    </Button>
  );
}
