"use client";

import { useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
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
  FlaskConical,
  GripVertical,
  ImageIcon,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2
} from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { Modal } from "@/components/ui/modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getImagePublicUrl } from "@/lib/images";
import type {
  FlavorWithSteps,
  HumorFlavorRecord,
  HumorFlavorStepRecord,
  ImageRecord
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface FlavorEditorProps {
  initialFlavors: FlavorWithSteps[];
}

type FlavorFormState = Pick<
  HumorFlavorRecord,
  "name" | "slug" | "description" | "llm_system_prompt"
>;

type StepFormState = Pick<HumorFlavorStepRecord, "title" | "llm_user_prompt" | "image_id">;

type StepRowWithImage = HumorFlavorStepRecord & {
  image: ImageRecord | null;
};

function attachImageToStep(
  step: HumorFlavorStepRecord,
  image: ImageRecord | null,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): StepRowWithImage {
  return {
    ...step,
    image: image
      ? {
          ...image,
          public_url: getImagePublicUrl(supabase, image)
        }
      : null
  };
}

function emptyFlavorForm(): FlavorFormState {
  return {
    name: "",
    slug: "",
    description: "",
    llm_system_prompt: ""
  };
}

function emptyStepForm(): StepFormState {
  return {
    title: "",
    llm_user_prompt: "",
    image_id: null
  };
}

function SortableStepCard({
  step,
  onEdit,
  onDelete
}: {
  step: FlavorWithSteps["steps"][number];
  onEdit: () => void;
  onDelete: () => void;
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
        "glass-panel rounded-[1.5rem] p-4",
        isDragging && "ring-2 ring-sky-400/50"
      )}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          className="mt-1 rounded-full border border-white/10 p-2 text-slate-500 dark:text-slate-300"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-400">
                Step {step.order_by}
              </p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
            </div>
            <div className="flex gap-2">
              <AnimatedButton className="px-3 py-2 text-xs" onClick={onEdit}>
                Edit
              </AnimatedButton>
              <AnimatedButton
                className="border-rose-400/25 bg-rose-500/10 text-rose-100"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </AnimatedButton>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {step.llm_user_prompt}
          </p>
          {step.image?.public_url ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <img
                src={step.image.public_url}
                alt={step.image.title ?? step.title}
                className="h-44 w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function FlavorEditor({ initialFlavors }: FlavorEditorProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [flavors, setFlavors] = useState(initialFlavors);
  const [selectedFlavorId, setSelectedFlavorId] = useState(initialFlavors[0]?.id ?? null);
  const [flavorModalOpen, setFlavorModalOpen] = useState(false);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [runnerPending, startRunnerTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const [flavorForm, setFlavorForm] = useState<FlavorFormState>(emptyFlavorForm);
  const [stepForm, setStepForm] = useState<StepFormState>(emptyStepForm);
  const [editingFlavorId, setEditingFlavorId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [chainOutput, setChainOutput] = useState<Array<{ title?: string; outputText: string }>>([]);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const selectedFlavor = flavors.find((item) => item.id === selectedFlavorId) ?? null;

  async function loadImages() {
    const { data, error } = await supabase
      .from("images")
      .select("id,title,bucket_id,object_path,storage_path,public_url")
      .order("title", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((image) => ({
      ...image,
      public_url: getImagePublicUrl(supabase, image as ImageRecord)
    })) as ImageRecord[];
  }

  async function getImageById(imageId: string | null) {
    if (!imageId) {
      return null;
    }

    const existing = images.find((image) => image.id === imageId);

    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from("images")
      .select("id,title,bucket_id,object_path,storage_path,public_url")
      .eq("id", imageId)
      .single();

    if (error) {
      throw error;
    }

    const image = {
      ...(data as ImageRecord),
      public_url: getImagePublicUrl(supabase, data as ImageRecord)
    };

    setImages((current) => {
      if (current.some((entry) => entry.id === image.id)) {
        return current;
      }

      return [...current, image];
    });

    return image;
  }

  const [images, setImages] = useState<ImageRecord[]>([]);

  async function ensureImagesLoaded() {
    if (images.length > 0) {
      return;
    }

    const loaded = await loadImages();
    setImages(loaded);
  }

  async function saveFlavor() {
    startTransition(() => {
      void (async () => {
        setStatusMessage(null);
        const payload = {
          ...flavorForm,
          description: flavorForm.description || null,
          llm_system_prompt: flavorForm.llm_system_prompt || null
        };

        if (editingFlavorId) {
          const { data, error } = await supabase
            .from("humor_flavors")
            .update(payload)
            .eq("id", editingFlavorId)
            .select()
            .single();

          if (error) {
            setStatusMessage(error.message);
            return;
          }

          const updatedFlavor = data as HumorFlavorRecord;

          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === editingFlavorId ? { ...flavor, ...updatedFlavor } : flavor
            )
          );
        } else {
          const { data, error } = await supabase
            .from("humor_flavors")
            .insert(payload)
            .select()
            .single();

          if (error) {
            setStatusMessage(error.message);
            return;
          }

          const createdFlavor = data as HumorFlavorRecord;
          setFlavors((current) => [{ ...createdFlavor, steps: [] }, ...current]);
          setSelectedFlavorId(createdFlavor.id);
        }

        setFlavorModalOpen(false);
        setEditingFlavorId(null);
        setFlavorForm(emptyFlavorForm());
        setStatusMessage("Flavor saved.");
      })();
    });
  }

  async function saveStep() {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setStatusMessage(null);

        const payload = {
          ...stepForm,
          humor_flavor_id: selectedFlavor.id,
          order_by:
            editingStepId == null
              ? selectedFlavor.steps.length + 1
              : selectedFlavor.steps.find((step) => step.id === editingStepId)?.order_by ?? 1
        };

        if (editingStepId) {
          const { data, error } = await supabase
            .from("humor_flavor_steps")
            .update(payload)
            .eq("id", editingStepId)
            .select("id,humor_flavor_id,title,llm_user_prompt,order_by,image_id,created_at,updated_at")
            .single();

          if (error) {
            setStatusMessage(error.message);
            return;
          }

          const updatedStep = data as HumorFlavorStepRecord;
          const image = await getImageById(updatedStep.image_id);

          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === selectedFlavor.id
                ? {
                  ...flavor,
                  steps: flavor.steps.map((step) =>
                    step.id === editingStepId
                        ? attachImageToStep(updatedStep, image, supabase)
                        : step
                    )
                  }
                : flavor
            )
          );
        } else {
          const { data, error } = await supabase
            .from("humor_flavor_steps")
            .insert(payload)
            .select("id,humor_flavor_id,title,llm_user_prompt,order_by,image_id,created_at,updated_at")
            .single();

          if (error) {
            setStatusMessage(error.message);
            return;
          }

          const createdStep = data as HumorFlavorStepRecord;
          const image = await getImageById(createdStep.image_id);

          setFlavors((current) =>
            current.map((flavor) =>
              flavor.id === selectedFlavor.id
                ? {
                    ...flavor,
                    steps: [
                      ...flavor.steps,
                      attachImageToStep(createdStep, image, supabase)
                    ]
                  }
                : flavor
            )
          );
        }

        setStepModalOpen(false);
        setEditingStepId(null);
        setStepForm(emptyStepForm());
        setStatusMessage("Step saved.");
      })();
    });
  }

  async function deleteFlavor(flavorId: string) {
    startTransition(() => {
      void (async () => {
        const { error } = await supabase.from("humor_flavors").delete().eq("id", flavorId);

        if (error) {
          setStatusMessage(error.message);
          return;
        }

        setFlavors((current) => current.filter((flavor) => flavor.id !== flavorId));
        setSelectedFlavorId((current) => (current === flavorId ? null : current));
        setStatusMessage("Flavor deleted.");
      })();
    });
  }

  async function deleteStep(stepId: string) {
    if (!selectedFlavor) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", stepId);

        if (error) {
          setStatusMessage(error.message);
          return;
        }

        const nextSteps = selectedFlavor.steps
          .filter((step) => step.id !== stepId)
          .map((step, index) => ({ ...step, order_by: index + 1 }));

        setFlavors((current) =>
          current.map((flavor) =>
            flavor.id === selectedFlavor.id ? { ...flavor, steps: nextSteps } : flavor
          )
        );
        await persistStepOrder(selectedFlavor.id, nextSteps);
        setStatusMessage("Step deleted.");
      })();
    });
  }

  async function persistStepOrder(flavorId: string, steps: FlavorWithSteps["steps"]) {
    const updates = steps.map((step, index) => ({
      id: step.id,
      humor_flavor_id: flavorId,
      order_by: index + 1
    }));

    const { error } = await supabase.from("humor_flavor_steps").upsert(updates);

    if (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!selectedFlavor || !event.over || event.active.id === event.over.id) {
      return;
    }

    const oldIndex = selectedFlavor.steps.findIndex((step) => step.id === event.active.id);
    const newIndex = selectedFlavor.steps.findIndex((step) => step.id === event.over?.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(selectedFlavor.steps, oldIndex, newIndex).map((step, index) => ({
      ...step,
      order_by: index + 1
    }));

    setFlavors((current) =>
      current.map((flavor) =>
        flavor.id === selectedFlavor.id ? { ...flavor, steps: reordered } : flavor
      )
    );
    await persistStepOrder(selectedFlavor.id, reordered);
  }

  function openFlavorModal(flavor?: FlavorWithSteps) {
    if (flavor) {
      setEditingFlavorId(flavor.id);
      setFlavorForm({
        name: flavor.name,
        slug: flavor.slug,
        description: flavor.description ?? "",
        llm_system_prompt: flavor.llm_system_prompt ?? ""
      });
    } else {
      setEditingFlavorId(null);
      setFlavorForm(emptyFlavorForm());
    }

    setFlavorModalOpen(true);
  }

  async function openStepModal(step?: FlavorWithSteps["steps"][number]) {
    await ensureImagesLoaded();

    if (step) {
      setEditingStepId(step.id);
      setStepForm({
        title: step.title,
        llm_user_prompt: step.llm_user_prompt,
        image_id: step.image_id
      });
    } else {
      setEditingStepId(null);
      setStepForm(emptyStepForm());
    }

    setStepModalOpen(true);
  }

  function selectedImageUrl() {
    const firstImage = selectedFlavor?.steps.find((step) => step.image?.public_url)?.image?.public_url;
    return firstImage ?? null;
  }

  async function runChain() {
    if (!selectedFlavor) {
      return;
    }

    const imageUrl = selectedImageUrl();

    if (!imageUrl) {
      setRunnerError("At least one step needs an image with a resolvable public URL.");
      return;
    }

    startRunnerTransition(() => {
      void (async () => {
        setRunnerError(null);

        const response = await fetch("/api/chain-run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            imageUrl,
            systemPrompt: selectedFlavor.llm_system_prompt,
            steps: selectedFlavor.steps.map((step) => ({
              id: step.id,
              title: step.title,
              llmUserPrompt: step.llm_user_prompt
            }))
          })
        });

        const payload = await response.json();

        if (!response.ok) {
          setRunnerError(payload.error ?? "Chain execution failed.");
          return;
        }

        setChainOutput(payload.results ?? []);
      })();
    });
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-sky-400">Deep Blue Control</p>
            <h1 className="mt-2 text-4xl font-semibold text-slate-900 dark:text-slate-50">
              Flavor Editor
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Manage humor flavor chains, reorder prompt steps with layout animation, and execute sequential API tests with placeholder substitution like <code>{"{{step_1}}"}</code>.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="grid gap-6 xl:grid-cols-[320px,1fr,380px]">
          <aside className="glass-panel rounded-[2rem] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-400">Flavors</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{flavors.length} total</p>
              </div>
              <AnimatedButton onClick={() => openFlavorModal()}>
                <Plus className="mr-2 h-4 w-4" />
                New
              </AnimatedButton>
            </div>
            <motion.div
              className="space-y-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.08
                  }
                }
              }}
            >
              {flavors.map((flavor) => (
                <motion.button
                  key={flavor.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 28px rgba(56, 189, 248, 0.22)" }}
                  type="button"
                  onClick={() => setSelectedFlavorId(flavor.id)}
                  className={cn(
                    "glass-panel w-full rounded-[1.6rem] p-4 text-left transition",
                    selectedFlavorId === flavor.id && "border-sky-400/45 ring-1 ring-sky-400/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {flavor.name}
                      </h2>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        {flavor.slug}
                      </p>
                    </div>
                    <Sparkles className="h-5 w-5 text-sky-400" />
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {flavor.description || "No description"}
                  </p>
                </motion.button>
              ))}
            </motion.div>
          </aside>

          <main className="glass-panel rounded-[2rem] p-5">
            {selectedFlavor ? (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex items-center gap-3">
                      <FlaskConical className="h-5 w-5 text-sky-400" />
                      <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {selectedFlavor.name}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {selectedFlavor.description || "No description yet."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <AnimatedButton onClick={() => openFlavorModal(selectedFlavor)}>
                      <Save className="mr-2 h-4 w-4" />
                      Edit Flavor
                    </AnimatedButton>
                    <AnimatedButton
                      className="border-rose-400/25 bg-rose-500/10 text-rose-100"
                      onClick={() => deleteFlavor(selectedFlavor.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </AnimatedButton>
                    <AnimatedButton onClick={() => openStepModal()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Step
                    </AnimatedButton>
                  </div>
                </div>

                <div className="mt-6">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={selectedFlavor.steps.map((step) => step.id)}
                      strategy={rectSortingStrategy}
                    >
                      <motion.div layout className="space-y-4">
                        <AnimatePresence>
                          {selectedFlavor.steps.map((step) => (
                            <SortableStepCard
                              key={step.id}
                              step={step}
                              onEdit={() => openStepModal(step)}
                              onDelete={() => deleteStep(step.id)}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center text-slate-500 dark:text-slate-300">
                Create or select a flavor to begin.
              </div>
            )}
          </main>

          <section className="glass-panel rounded-[2rem] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-400">Chain Runner</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                  Sequential execution
                </h2>
              </div>
              <AnimatedButton onClick={runChain} disabled={!selectedFlavor || runnerPending}>
                <Play className="mr-2 h-4 w-4" />
                {runnerPending ? "Running..." : "Run"}
              </AnimatedButton>
            </div>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-200">
              <p className="text-slate-300">
                Uses the first available step image public URL and resolves placeholders against prior outputs.
              </p>
              {runnerError ? <p className="mt-3 text-rose-300">{runnerError}</p> : null}
              <div className="mt-4 space-y-3">
                {chainOutput.length === 0 ? (
                  <p className="text-slate-400">No execution yet.</p>
                ) : (
                  chainOutput.map((entry, index) => (
                    <div key={`${entry.title}-${index}`} className="rounded-2xl border border-white/10 p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-sky-300">
                        {entry.title ?? `Step ${index + 1}`}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{entry.outputText}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {statusMessage ? (
              <p className="mt-4 text-sm text-sky-200">{pending ? "Saving..." : statusMessage}</p>
            ) : null}
          </section>
        </section>
      </div>

      <Modal
        title={editingFlavorId ? "Edit Flavor" : "Create Flavor"}
        open={flavorModalOpen}
        onClose={() => setFlavorModalOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">Name</span>
            <input
              value={flavorForm.name}
              onChange={(event) => setFlavorForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">Slug</span>
            <input
              value={flavorForm.slug}
              onChange={(event) => setFlavorForm((current) => ({ ...current, slug: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">Description</span>
            <textarea
              rows={3}
              value={flavorForm.description ?? ""}
              onChange={(event) =>
                setFlavorForm((current) => ({ ...current, description: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">System Prompt</span>
            <textarea
              rows={4}
              value={flavorForm.llm_system_prompt ?? ""}
              onChange={(event) =>
                setFlavorForm((current) => ({ ...current, llm_system_prompt: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            />
          </label>
          <div className="flex justify-end">
            <AnimatedButton onClick={saveFlavor}>{pending ? "Saving..." : "Save Flavor"}</AnimatedButton>
          </div>
        </div>
      </Modal>

      <Modal
        title={editingStepId ? "Edit Step" : "Create Step"}
        open={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">Title</span>
            <input
              value={stepForm.title}
              onChange={(event) => setStepForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-600 dark:text-slate-300">User Prompt</span>
            <textarea
              rows={6}
              value={stepForm.llm_user_prompt}
              onChange={(event) =>
                setStepForm((current) => ({ ...current, llm_user_prompt: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-mono text-sm text-slate-900 outline-none dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <ImageIcon className="h-4 w-4" />
              Image
            </span>
            <select
              value={stepForm.image_id ?? ""}
              onChange={(event) =>
                setStepForm((current) => ({
                  ...current,
                  image_id: event.target.value ? event.target.value : null
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-slate-900 outline-none dark:text-white"
            >
              <option value="">No image</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.title ?? image.id}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-dashed border-sky-400/30 p-4 text-sm text-slate-500 dark:text-slate-300">
            Placeholder examples: <code>{"{{step_1}}"}</code>, <code>{"{{ step_2 }}"}</code>
          </div>
          <div className="flex justify-end">
            <AnimatedButton onClick={saveStep}>{pending ? "Saving..." : "Save Step"}</AnimatedButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
