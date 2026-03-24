import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AppHomePage() {
  const supabase = createClient();
  const { data: flavorCount } = await supabase
    .from("humor_flavors")
    .select("id", { count: "exact", head: true });

  const { data: stepCount } = await supabase
    .from("humor_flavor_steps")
    .select("id", { count: "exact", head: true });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="text-muted-foreground">
          Manage humor flavors, edit step chains, and test caption outputs.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Humor Flavors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold">{flavorCount?.count ?? 0}</p>
            <Button asChild>
              <Link href="/app/flavors">Manage flavors</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Steps in Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold">{stepCount?.count ?? 0}</p>
            <Button asChild variant="secondary">
              <Link href="/app/test">Test a chain</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
