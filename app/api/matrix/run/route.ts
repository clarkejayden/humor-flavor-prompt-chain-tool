import { NextResponse } from "next/server";

import { executeImageSetStudy } from "@/lib/pipeline-executor";
import type { MatrixFlavorRecord, MatrixImageRecord } from "@/lib/matrix/types";
import { getCurrentAdminProfile } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const adminContext = await getCurrentAdminProfile();

    if (!adminContext?.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      flavor: MatrixFlavorRecord;
      images: MatrixImageRecord[];
    };

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const results = await executeImageSetStudy(body.flavor, body.images, {
            endpoint: process.env.ALMOSTCRACKD_API_URL ?? "https://api.almostcrackd.ai/",
            onProgress(completed, total, result) {
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({ type: "progress", completed, total, result })}\n`
                )
              );
            }
          });

          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done", results })}\n`));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown Matrix execution error."
              })}\n`
            )
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Matrix execution error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
