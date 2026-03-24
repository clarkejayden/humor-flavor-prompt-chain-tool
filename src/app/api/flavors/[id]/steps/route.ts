import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminStatus } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { authorized } = await getAdminStatus();
  if (!authorized) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("humor_flavor_steps")
    .select("id,step_order,prompt,description")
    .eq("flavor_id", params.id)
    .order("step_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps: data ?? [] });
}
