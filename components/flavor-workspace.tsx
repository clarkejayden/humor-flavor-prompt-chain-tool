"use client";

import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  GripVertical,
  ImageIcon,
  Layers3,
  Play,
  Search,
  TerminalSquare
} from "lucide-react";

import { useMatrix } from "@/components/matrix-provider";
import { ResultsTable } from "@/components/results-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatedButton } from "@/components/ui/animated-button";
import type {
  MatrixCaptionRecord,
  MatrixExperimentBootstrap,
  MatrixFlavorRecord,
  PipelineExecutionResult
} from "@/lib/matrix/types";
import { cn } from "@/lib/utils";

function SortableStep({
  step
}: {
  step: MatrixFlavorRecord["steps"][number];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id
  });

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-[1.25rem] border border-slate-800 bg-slate-950/45 p-4",
        isDragging && "ring-2 ring-sky-500/50"
      )}
    >
      <div className="flex gap-4">
        <button
          type="button"
          className="mt-1 rounded-full border border-slate-800 p-2 text-slate-500"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-cyan-400">Step {step.orderBy}</p>
              <h3 className="mt-1 text-base font-semibold text-slate-100">{step.title}</h3>
            </div>
            <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
              {step.inputType} → {step.outputType}
            </div>
          </div>
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap font-mono text-sm text-slate-400">{step.prompt}</p>
        </div>
      </div>
    </motion.div>
  );
}

function InspectionDrawer({
  result,
  onClose
}: {
  result: PipelineExecutionResult | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {result ? (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="h-full w-full max-w-2xl border-l border-slate-800 bg-slate-950/85 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Inspection</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">{result.imageTitle}</h2>
              </div>
              <AnimatedButton glow={false} onClick={onClose}>
                Close
              </AnimatedButton>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-400">Final caption</p>
                <p className="mt-2 text-base text-slate-100">{result.finalCaption}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Model</p>
                  <p className="mt-2 text-sm text-slate-100">{result.modelId ?? "-"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Temp</p>
                  <p className="mt-2 text-sm text-slate-100">{result.temperature ?? "-"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Seconds</p>
                  <p className="mt-2 text-sm text-slate-100">
                    {result.processingTimeSeconds?.toFixed(2) ?? "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-800 bg-[#01050d] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
                  <TerminalSquare className="h-4 w-4" />
                  Terminal chain log
                </div>
                <div className="space-y-3 font-mono text-sm">
                  {result.steps.map((step, index) => (
                    <div key={step.stepId} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-cyan-400">$ step_{index + 1} {step.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-slate-500">{step.resolvedPrompt}</p>
                      <p className="mt-3 whitespace-pre-wrap text-slate-200">{step.outputText}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function FlavorWorkspace({
  bootstrap
}: {
  bootstrap: MatrixExperimentBootstrap;
}) {
  const { auth, activeTests, startTest, updateTestProgress, finishTest, latestResults } = useMatrix();
  const [flavors, setFlavors] = useState(bootstrap.flavors);
  const [selectedFlavorId, setSelectedFlavorId] = useState(bootstrap.flavors[0]?.id ?? null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(
    bootstrap.images.slice(0, 6).map((image) => image.id)
  );
  const [resultGrid, setResultGrid] = useState<PipelineExecutionResult[]>([]);
  const [inspectionResult, setInspectionResult] = useState<PipelineExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageQuery, setImageQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const selectedFlavor = flavors.find((flavor) => flavor.id === selectedFlavorId) ?? null;
  const selectedImages = bootstrap.images.filter((image) => selectedImageIds.includes(image.id));
  const activeTest = activeTests.find((entry) => entry.flavorId === selectedFlavorId) ?? null;
  const visibleImages = useMemo(() => {
    const query = imageQuery.trim().toLowerCase();

    if (!query) {
      return bootstrap.images.slice(0, 12);
    }

    return bootstrap.images
      .filter((image) => image.title.toLowerCase().includes(query))
      .slice(0, 12);
  }, [bootstrap.images, imageQuery]);
  const mergedCaptions = useMemo<MatrixCaptionRecord[]>(() => {
    const transient = latestResults.map((result, index) => ({
      id: `transient-${result.imageId}-${index}`,
      imageId: result.imageId,
      flavorId: selectedFlavorId ?? "",
      caption: result.finalCaption,
      createdAt: new Date().toISOString(),
      imageTitle: result.imageTitle,
      flavorName: selectedFlavor?.name ?? null,
      processingTimeSeconds: result.processingTimeSeconds,
      modelId: result.modelId
    }));

    return [...transient, ...bootstrap.captions];
  }, [bootstrap.captions, latestResults, selectedFlavor?.name, selectedFlavorId]);

  async function runStudy() {
    if (!selectedFlavor || selectedImages.length === 0) {
      return;
    }

    setRunning(true);
    setError(null);
    startTest({
      flavorId: selectedFlavor.id,
      imageIds: selectedImages.map((image) => image.id),
      progress: 0,
      total: selectedImages.length
    });

    try {
      const response = await fetch("/api/matrix/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          flavor: selectedFlavor,
          images: selectedImages
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Study run failed.");
      }

      const reader = response.body?.getReader();

      if (!reader) {
        const payload = await response.json();
        setResultGrid(payload.results ?? []);
        finishTest(selectedFlavor.id, payload.results ?? []);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const collected: PipelineExecutionResult[] = [];

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
            | { type: "progress"; completed: number; total: number; result: PipelineExecutionResult }
            | { type: "done"; results: PipelineExecutionResult[] }
            | { type: "error"; error: string };

          if (event.type === "progress") {
            collected.push(event.result);
            setResultGrid([...collected]);
            updateTestProgress(selectedFlavor.id, event.completed, event.total);
          }

          if (event.type === "done") {
            setResultGrid(event.results);
            finishTest(selectedFlavor.id, event.results);
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (caughtError) {
      finishTest(selectedFlavor.id, []);
      setError(caughtError instanceof Error ? caughtError.message : "Unknown testing error.");
    } finally {
      setRunning(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    if (!selectedFlavor || !event.over || event.active.id === event.over.id) {
      return;
    }

    const overId = event.over.id;
    const oldIndex = selectedFlavor.steps.findIndex((step) => step.id === event.active.id);
    const newIndex = selectedFlavor.steps.findIndex((step) => step.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedSteps = arrayMove(selectedFlavor.steps, oldIndex, newIndex).map((step, index) => ({
      ...step,
      orderBy: index + 1
    }));

    setFlavors((current) =>
      current.map((flavor) =>
        flavor.id === selectedFlavor.id ? { ...flavor, steps: reorderedSteps } : flavor
      )
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-[1.9rem] border border-slate-800 bg-slate-950/55 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-cyan-400">The Matrix</p>
            <h1 className="mt-3 text-3xl font-semibold">Humor Flavor Experimentation Platform</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Pick a flavor, pick a small image set, run the study, then inspect the winning captions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-300">
              {auth.email ?? "Unknown user"}
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="glass-panel rounded-[1.5rem] border border-slate-800 bg-slate-950/55 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">1. Flavor</p>
            <p className="mt-2 text-2xl font-semibold">{selectedFlavor?.name ?? "Choose one"}</p>
            <p className="mt-1 text-sm text-slate-400">{selectedFlavor?.steps.length ?? 0} steps loaded</p>
          </div>
          <div className="glass-panel rounded-[1.5rem] border border-slate-800 bg-slate-950/55 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">2. Image Set</p>
            <p className="mt-2 text-2xl font-semibold">{selectedImages.length} selected</p>
            <p className="mt-1 text-sm text-slate-400">Keep it small while iterating.</p>
          </div>
          <div className="glass-panel rounded-[1.5rem] border border-slate-800 bg-slate-950/55 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">3. Status</p>
            <div className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              {running || activeTest ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
                  </span>
                  Running
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Ready
                </>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {activeTest ? `${activeTest.progress}/${activeTest.total} complete` : "No active test"}
            </p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[280px,1fr]">
          <aside className="glass-panel rounded-[1.9rem] border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">Flavors</p>
                <p className="mt-2 text-sm text-slate-500">Select one to test</p>
              </div>
              <Layers3 className="h-5 w-5 text-sky-400" />
            </div>
            <motion.div
              className="mt-5 space-y-3"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {flavors.map((flavor) => (
                <motion.button
                  key={flavor.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 28px rgba(59, 130, 246, 0.22)" }}
                  type="button"
                  onClick={() => setSelectedFlavorId(flavor.id)}
                  className={cn(
                    "w-full rounded-[1.5rem] border p-4 text-left transition",
                    selectedFlavorId === flavor.id
                      ? "border-sky-500/60 bg-sky-500/10"
                      : "border-slate-800 bg-slate-950/55"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">{flavor.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">{flavor.steps.length} steps</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </aside>

          <main className="space-y-6">
            <section className="glass-panel rounded-[1.9rem] border border-slate-800 bg-slate-950/55 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">Workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold">{selectedFlavor?.name ?? "No flavor selected"}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    {selectedFlavor?.description ?? "Choose a flavor to inspect prompt chain steps and test against image sets."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-300">
                    Use placeholders like <span className="font-mono text-cyan-300">{"{{step_1}}"}</span>
                  </div>
                  <AnimatedButton onClick={runStudy} disabled={!selectedFlavor || running || selectedImages.length === 0}>
                    <Play className="mr-2 h-4 w-4" />
                    {running ? "Running Study..." : "Run Study"}
                  </AnimatedButton>
                </div>
              </div>

              {selectedFlavor ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr),340px]">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext
                      items={selectedFlavor.steps.map((step) => step.id)}
                      strategy={rectSortingStrategy}
                    >
                      <motion.div layout className="space-y-4">
                        {selectedFlavor.steps.map((step) => (
                          <SortableStep key={step.id} step={step} />
                        ))}
                      </motion.div>
                    </SortableContext>
                  </DndContext>
                  <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 text-sm text-cyan-300">
                      <TerminalSquare className="h-4 w-4" />
                      Quick chain log
                    </div>
                    <div className="mt-4 space-y-3 font-mono text-sm">
                      {(inspectionResult?.steps ?? resultGrid[0]?.steps ?? []).slice(0, 3).map((step, index) => (
                        <div key={step.stepId} className="rounded-xl border border-slate-800 bg-[#01050d] p-3">
                          <p className="text-cyan-400">$ step_{index + 1}</p>
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-slate-500">{step.resolvedPrompt}</p>
                          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-slate-200">{step.outputText}</p>
                        </div>
                      ))}
                      {(inspectionResult?.steps ?? resultGrid[0]?.steps ?? []).length === 0 ? (
                        <p className="text-slate-500">Run a study, then inspect any result for full chain history.</p>
                      ) : null}
                    </div>
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                      Loaded values can bypass LLM calls for celebrity recognition and image description.
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <div className="glass-panel rounded-[1.9rem] border border-slate-800 bg-slate-950/55 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">Testing Lab</p>
                    <h3 className="mt-2 text-xl font-semibold">Select study images</h3>
                  </div>
                  <ImageIcon className="h-5 w-5 text-sky-400" />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400"
                    animate={{
                      width: activeTest ? `${(activeTest.progress / Math.max(activeTest.total, 1)) * 100}%` : "0%"
                    }}
                  />
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-[1.25rem] border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={imageQuery}
                    onChange={(event) => setImageQuery(event.target.value)}
                    placeholder="Filter images by title"
                    className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {visibleImages.map((image) => {
                    const selected = selectedImageIds.includes(image.id);
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() =>
                          setSelectedImageIds((current) =>
                            selected ? current.filter((id) => id !== image.id) : [...current, image.id]
                          )
                        }
                        className={cn(
                          "overflow-hidden rounded-[1.2rem] border text-left transition",
                          selected ? "border-sky-500/60 bg-sky-500/5" : "border-slate-800"
                        )}
                      >
                        <div className="aspect-[4/3] bg-slate-900">
                          {image.publicUrl ? (
                            <img src={image.publicUrl} alt={image.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between bg-slate-950/75 p-3 text-sm text-slate-300">
                          <span className="truncate">{image.title}</span>
                          {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-400" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
              </div>

              <div className="glass-panel rounded-[1.9rem] border border-slate-800 bg-slate-950/55 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">Result Grid</p>
                    <h3 className="mt-2 text-xl font-semibold">Latest caption outcomes</h3>
                  </div>
                  <Cpu className="h-5 w-5 text-sky-400" />
                </div>
                <div className="mt-5 space-y-3">
                  {resultGrid.map((result) => (
                    <div
                      key={result.imageId}
                      className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{result.imageTitle}</p>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-400">{result.finalCaption}</p>
                        </div>
                        <AnimatedButton glow={false} onClick={() => setInspectionResult(result)}>
                          Inspect
                        </AnimatedButton>
                      </div>
                    </div>
                  ))}
                  {resultGrid.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                      No executions yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <ResultsTable captions={mergedCaptions} />
          </main>
        </div>
      </div>

      <InspectionDrawer result={inspectionResult} onClose={() => setInspectionResult(null)} />
    </div>
  );
}
