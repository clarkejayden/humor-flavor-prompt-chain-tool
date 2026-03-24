import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminStatus } from "@/lib/auth";

const requestSchema = z.object({
  imageUrl: z.string().url(),
  steps: z.array(
    z.object({
      order: z.number(),
      prompt: z.string(),
      description: z.string().nullable().optional()
    })
  )
});

async function callCaptionApi(payload: {
  imageUrl: string;
  prompt: string;
  input: string | null;
}) {
  const apiKey = process.env.ALMOSTCRACKD_API_KEY;
  const response = await fetch("https://api.almostcrackd.ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      image_url: payload.imageUrl,
      prompt: payload.prompt,
      input: payload.input
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Caption API error");
  }

  return response.json();
}

export async function POST(request: Request) {
  const { authorized } = await getAdminStatus();
  if (!authorized) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const body = await request.json();
  const values = requestSchema.safeParse(body);

  if (!values.success) {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const orderedSteps = [...values.data.steps].sort(
    (a, b) => a.order - b.order
  );

  let previousOutput: string | null = null;
  const outputs: string[] = [];

  for (const step of orderedSteps) {
    const result = await callCaptionApi({
      imageUrl: values.data.imageUrl,
      prompt: step.prompt,
      input: previousOutput
    });

    const output =
      result.output ||
      result.caption ||
      result.result ||
      result.text ||
      JSON.stringify(result);

    outputs.push(output);
    previousOutput = output;
  }

  return NextResponse.json({ outputs });
}
