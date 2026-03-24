import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateFlavor } from "../actions";
import { createStep } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepRow } from "./step-row";

export default async function FlavorDetailPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: flavor, error } = await supabase
    .from("humor_flavors")
    .select("id,name")
    .eq("id", params.id)
    .single();

  if (error || !flavor) {
    notFound();
  }

  const { data: steps } = await supabase
    .from("humor_flavor_steps")
    .select("id,step_order,prompt,description")
    .eq("flavor_id", params.id)
    .order("step_order");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">{flavor.name}</h1>
          <Button asChild variant="ghost">
            <Link href="/app/flavors">Back to flavors</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Manage steps and ordering.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit flavor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFlavor} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="id" value={flavor.id} />
            <Input name="name" defaultValue={flavor.name} required />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add step</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStep} className="space-y-3">
            <input type="hidden" name="flavorId" value={flavor.id} />
            <Input name="prompt" placeholder="Prompt text" required />
            <Textarea name="description" placeholder="Optional description" />
            <Button type="submit">Add step</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Steps</h2>
        {steps && steps.length > 0 ? (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                flavorId={flavor.id}
                disableUp={index === 0}
                disableDown={index === steps.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No steps yet. Add your first prompt step.
          </div>
        )}
      </div>
    </div>
  );
}
