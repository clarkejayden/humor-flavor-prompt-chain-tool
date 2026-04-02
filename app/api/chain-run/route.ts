import { NextResponse } from "next/server";

import { runFlavorChain } from "@/lib/chain-runner";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageUrl: string;
      systemPrompt?: string | null;
      steps: Array<{
        id: string;
        title?: string;
        llmUserPrompt: string;
      }>;
    };

    const results = await runFlavorChain({
      imageUrl: body.imageUrl,
      systemPrompt: body.systemPrompt,
      steps: body.steps
    });

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown chain runner error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
