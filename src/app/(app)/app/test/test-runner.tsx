"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Flavor = {
  id: string;
  name: string;
};

type Step = {
  id: string;
  step_order: number;
  prompt: string;
  description: string | null;
};

const TEST_IMAGES = [
  {
    label: "Retro diner",
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0"
  },
  {
    label: "Golden retriever",
    url: "https://images.unsplash.com/photo-1507146426996-ef05306b995a"
  },
  {
    label: "City skyline",
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e"
  }
];

export function TestRunner({ flavors }: { flavors: Flavor[] }) {
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [imageUrl, setImageUrl] = useState<string>(TEST_IMAGES[0]?.url ?? "");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);

  const previewUrl = customUrl.trim().length > 0 ? customUrl : imageUrl;

  useEffect(() => {
    if (!selectedFlavorId) {
      setSteps([]);
      return;
    }

    const loadSteps = async () => {
      setError(null);
      const res = await fetch(`/api/flavors/${selectedFlavorId}/steps`);
      if (!res.ok) {
        setError("Failed to load steps.");
        return;
      }
      const data = await res.json();
      setSteps(data.steps ?? []);
    };

    loadSteps();
  }, [selectedFlavorId]);

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.step_order - b.step_order),
    [steps]
  );

  const handleRun = () => {
    if (!selectedFlavorId) {
      setError("Select a humor flavor first.");
      return;
    }
    if (!previewUrl) {
      setError("Provide an image URL.");
      return;
    }

    setError(null);
    setOutputs([]);

    startTransition(async () => {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageUrl: previewUrl,
          steps: orderedSteps.map((step) => ({
            order: step.step_order,
            prompt: step.prompt,
            description: step.description
          }))
        })
      });

      if (!res.ok) {
        const message = await res.text();
        setError(message || "Failed to generate captions.");
        return;
      }

      const data = await res.json();
      setOutputs(data.outputs ?? []);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Humor flavor</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedFlavorId}
              onChange={(event) => setSelectedFlavorId(event.target.value)}
            >
              <option value="">Select a flavor</option>
              {flavors.map((flavor) => (
                <option key={flavor.id} value={flavor.id}>
                  {flavor.name}
                </option>
              ))}
            </select>
            {orderedSteps.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {orderedSteps.length} steps loaded.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No steps loaded yet.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Pick a test image</label>
            <div className="flex flex-wrap gap-2">
              {TEST_IMAGES.map((image) => (
                <Button
                  key={image.url}
                  type="button"
                  variant={imageUrl === image.url ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setImageUrl(image.url);
                    setCustomUrl("");
                  }}
                >
                  {image.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Or paste an image URL</label>
            <Input
              placeholder="https://..."
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
            />
          </div>

          <Button onClick={handleRun} disabled={loading}>
            {loading ? "Running prompt chain..." : "Run prompt chain"}
          </Button>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Image preview</CardTitle>
          </CardHeader>
          <CardContent>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Test preview"
                className="h-64 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No image selected.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outputs.length > 0 ? (
              outputs.map((output, index) => (
                <div
                  key={`${output}-${index}`}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    index === outputs.length - 1
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {index === outputs.length - 1
                      ? "Final output"
                      : `Step ${index + 1} output`}
                  </div>
                  <Textarea
                    readOnly
                    value={output}
                    className="mt-2 min-h-[80px] resize-none"
                  />
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Run a flavor to see outputs.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
