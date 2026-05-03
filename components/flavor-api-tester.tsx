"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Play, RefreshCw } from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  MatrixCaptionRecord,
  MatrixFlavorRecord,
  MatrixImageRecord,
  PipelineExecutionResult
} from "@/lib/matrix/types";
import { cn } from "@/lib/utils";

type RunLifecycleStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "registering"
  | "captioning"
  | "complete"
  | "failed";

function formatRunStatusLabel(status: RunLifecycleStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "registering":
      return "Registering";
    case "captioning":
      return "Captioning";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

function captionFromRow(row: Record<string, unknown>, flavorName: string | null): MatrixCaptionRecord {
  const imageId = String(row.image_id ?? "");
  const flavorId = String(row.humor_flavor_id ?? row.flavor_id ?? "");

  return {
    id: String(row.id),
    imageId,
    flavorId,
    caption: String(row.caption ?? row.text ?? row.output_text ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    imageTitle: typeof row.image_title === "string" ? row.image_title : null,
    flavorName,
    processingTimeSeconds:
      typeof row.processing_time_seconds === "number"
        ? row.processing_time_seconds
        : typeof row.processing_seconds === "number"
          ? row.processing_seconds
          : null,
    modelId:
      typeof row.model_id === "string"
        ? row.model_id
        : typeof row.llm_model_id === "string"
          ? row.llm_model_id
          : null
  };
}

export interface FlavorApiTesterProps {
  selectedFlavor: MatrixFlavorRecord | null;
  images: MatrixImageRecord[];
  initialCaptions: MatrixCaptionRecord[];
}

export function FlavorApiTester({ selectedFlavor, images, initialCaptions }: FlavorApiTesterProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [captions, setCaptions] = useState<MatrixCaptionRecord[]>(initialCaptions);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<RunLifecycleStatus>("idle");
  const [runDetail, setRunDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latestResults, setLatestResults] = useState<PipelineExecutionResult[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCaptions(initialCaptions);
  }, [initialCaptions]);

  const flavorCaptions = useMemo(() => {
    if (!selectedFlavor) {
      return [];
    }

    return captions
      .filter((c) => c.flavorId === selectedFlavor.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [captions, selectedFlavor]);

  const transientCaptions = useMemo<MatrixCaptionRecord[]>(() => {
    if (!selectedFlavor) {
      return [];
    }

    return latestResults.map((result, index) => ({
      id: `run-${result.imageId}-${index}`,
      imageId: result.imageId,
      flavorId: selectedFlavor.id,
      caption: result.finalCaption,
      createdAt: new Date().toISOString(),
      imageTitle: result.imageTitle,
      flavorName: selectedFlavor.name,
      processingTimeSeconds: result.processingTimeSeconds,
      modelId: result.modelId
    }));
  }, [latestResults, selectedFlavor]);

  const displayCaptions = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...transientCaptions, ...flavorCaptions];
    return merged.filter((c) => {
      if (seen.has(c.id)) {
        return false;
      }
      seen.add(c.id);
      return true;
    });
  }, [flavorCaptions, transientCaptions]);

  function toggleImage(id: string) {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectFirstN(n: number) {
    const slice = images.slice(0, n).map((i) => i.id);
    setSelectedImageIds(new Set(slice));
  }

  function refreshCaptionsFromDb() {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const { data, error: qError } = await supabase
          .from("captions")
          .select("*")
          .eq("humor_flavor_id", selectedFlavor.id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (qError) {
          setError(qError.message);
          return;
        }

        const rows = (data ?? []) as Record<string, unknown>[];
        const next = rows.map((row) => captionFromRow(row, selectedFlavor.name));
        setCaptions((current) => {
          const others = current.filter((c) => c.flavorId !== selectedFlavor.id);
          return [...next, ...others];
        });
        setError(null);
      })();
    });
  }

  async function runStudy() {
    if (!selectedFlavor || selectedImageIds.size === 0) {
      return;
    }

    const selectedImages = images.filter((img) => selectedImageIds.has(img.id));

    setRunning(true);
    setError(null);
    setLatestResults([]);
    setRunStatus("queued");
    setRunDetail(
      `Queued ${selectedImages.length} image${selectedImages.length === 1 ? "" : "s"} for ${selectedFlavor.name}.`
    );

    try {
      const response = await fetch("/api/matrix/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flavor: selectedFlavor,
          images: selectedImages
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Caption run failed.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream from server.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as
            | { type: "status"; imageId: string; imageTitle: string; status: Exclude<RunLifecycleStatus, "idle"> }
            | { type: "progress"; completed: number; total: number; result: PipelineExecutionResult }
            | { type: "done"; results: PipelineExecutionResult[] }
            | { type: "error"; error: string };

          if (event.type === "status") {
            setRunStatus(event.status);
            setRunDetail(`${formatRunStatusLabel(event.status)} · ${event.imageTitle}`);
          }

          if (event.type === "progress") {
            setRunStatus("captioning");
            setRunDetail(`Completed ${event.completed} of ${event.total} images.`);
          }

          if (event.type === "done") {
            setLatestResults(event.results);
            setRunStatus("complete");
            setRunDetail(`Finished ${event.results.length} image${event.results.length === 1 ? "" : "s"}.`);
            refreshCaptionsFromDb();
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (caught) {
      setRunStatus("failed");
      setRunDetail("Run stopped before completion.");
      setError(caught instanceof Error ? caught.message : "Unknown testing error.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-6">
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">REST API · Image test set</p>
            <h2 className="mt-2 text-xl font-semibold">Generate captions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Uses <span className="font-mono text-cyan-300">api.almostcrackd.ai</span> pipeline (presign → upload →
              generate) with the selected humor flavor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectFirstN(4)}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              Select first 4
            </button>
            <button
              type="button"
              onClick={() => setSelectedImageIds(new Set(images.map((i) => i.id)))}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedImageIds(new Set())}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-[1rem] border border-slate-800 bg-slate-950/40 p-3">
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">No images in the test set. Add rows to the `images` table in Supabase.</p>
          ) : (
            images.map((img) => (
              <label
                key={img.id}
                className="flex cursor-pointer items-center gap-3 rounded-[1rem] border border-slate-800/80 px-3 py-2 hover:bg-slate-900/50"
              >
                <input
                  type="checkbox"
                  checked={selectedImageIds.has(img.id)}
                  onChange={() => toggleImage(img.id)}
                  className="rounded border-slate-600"
                />
                <ImageIcon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{img.title}</span>
                {!img.publicUrl ? (
                  <span className="text-xs text-amber-400">No URL</span>
                ) : null}
              </label>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {running || runStatus === "failed" ? (
              runStatus === "failed" ? (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              )
            ) : runStatus === "complete" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : null}
            <span>{runDetail || "Ready when a flavor and images are selected."}</span>
          </div>
          <AnimatedButton
            onClick={() => void runStudy()}
            disabled={running || !selectedFlavor || selectedImageIds.size === 0}
          >
            <Play className="mr-2 h-4 w-4" />
            Run caption pipeline
          </AnimatedButton>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

        {latestResults.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest run output</p>
            {latestResults.map((r) => (
              <div key={r.imageId} className="rounded-[1rem] border border-slate-800 bg-[#020817] p-4 text-sm">
                <p className="font-medium text-slate-200">{r.imageTitle}</p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-slate-400">
                  {r.finalCaption}
                </pre>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-6">
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Stored captions</p>
            <h2 className="mt-2 text-xl font-semibold">By humor flavor</h2>
            <p className="mt-1 text-sm text-slate-400">
              Rows from <span className="font-mono">captions</span> for the selected flavor, plus outputs from the latest
              run above.
            </p>
          </div>
          <AnimatedButton glow={false} onClick={refreshCaptionsFromDb} disabled={pending || !selectedFlavor}>
            <RefreshCw className={cn("mr-2 h-4 w-4", pending && "animate-spin")} />
            Refresh from DB
          </AnimatedButton>
        </div>

        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto">
          {!selectedFlavor ? (
            <p className="text-sm text-slate-500">Select a humor flavor to load its captions.</p>
          ) : displayCaptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No captions yet for this flavor. Run the pipeline or insert into `captions` in Supabase.
            </p>
          ) : (
            displayCaptions.map((c) => (
              <div key={c.id} className="rounded-[1rem] border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{c.imageTitle ?? c.imageId}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.caption}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
