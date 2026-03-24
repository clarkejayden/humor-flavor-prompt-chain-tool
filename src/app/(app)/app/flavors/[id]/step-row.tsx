"use client";

import { useTransition } from "react";
import { moveStep, deleteStep, updateStep } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

type StepRowProps = {
  step: {
    id: string;
    step_order: number;
    prompt: string;
    description: string | null;
  };
  flavorId: string;
  disableUp: boolean;
  disableDown: boolean;
};

export function StepRow({ step, flavorId, disableUp, disableDown }: StepRowProps) {
  const [pending, startTransition] = useTransition();

  const handleMove = (direction: "up" | "down") => {
    const formData = new FormData();
    formData.set("flavorId", flavorId);
    formData.set("stepId", step.id);
    formData.set("direction", direction);
    startTransition(async () => {
      await moveStep(formData);
    });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("flavorId", flavorId);
    formData.set("id", step.id);
    startTransition(async () => {
      await deleteStep(formData);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">
            Step {step.step_order}
          </div>
          <div className="text-base font-medium">{step.prompt}</div>
          {step.description ? (
            <p className="text-sm text-muted-foreground">{step.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={disableUp || pending}
            onClick={() => handleMove("up")}
          >
            ↑
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={disableDown || pending}
            onClick={() => handleMove("down")}
          >
            ↓
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit step</DialogTitle>
                <DialogDescription>Update prompt and description.</DialogDescription>
              </DialogHeader>
              <form
                action={(formData) => {
                  formData.set("id", step.id);
                  formData.set("flavorId", flavorId);
                  return updateStep(formData);
                }}
                className="space-y-3"
              >
                <Input name="prompt" defaultValue={step.prompt} required />
                <Textarea name="description" defaultValue={step.description ?? ""} />
                <DialogFooter>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete step?</DialogTitle>
                <DialogDescription>This cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={handleDelete}>
                    Confirm delete
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
