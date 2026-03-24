import { createClient } from "@/lib/supabase/server";
import { TestRunner } from "./test-runner";

export default async function TestPage() {
  const supabase = createClient();
  const { data: flavors } = await supabase
    .from("humor_flavors")
    .select("id,name")
    .order("name");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Test Humor Flavor</h1>
        <p className="text-muted-foreground">
          Run a prompt chain against a sample image or URL and review captions.
        </p>
      </div>
      <TestRunner flavors={flavors ?? []} />
    </div>
  );
}
