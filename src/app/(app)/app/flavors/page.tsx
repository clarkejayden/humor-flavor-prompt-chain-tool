import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createFlavor } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlavorDeleteButton } from "./flavor-delete-button";

export default async function FlavorsPage() {
  const supabase = createClient();
  const { data: flavors, error } = await supabase
    .from("humor_flavors")
    .select("id,name,humor_flavor_steps(count)")
    .order("name");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Humor Flavors</h1>
        <p className="text-muted-foreground">
          Create and manage humor flavor chains.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a flavor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createFlavor} className="flex flex-col gap-3 sm:flex-row">
            <Input name="name" placeholder="Flavor name" required />
            <Button type="submit">Add flavor</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flavor library</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">Failed to load flavors.</p>
          ) : flavors && flavors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flavors.map((flavor) => (
                  <TableRow key={flavor.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/app/flavors/${flavor.id}`}>
                        {flavor.name}
                      </Link>
                    </TableCell>
                    <TableCell>{flavor.humor_flavor_steps?.[0]?.count ?? 0}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/flavors/${flavor.id}`}>Edit</Link>
                      </Button>
                      <FlavorDeleteButton flavorId={flavor.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No flavors yet. Create your first humor flavor.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
