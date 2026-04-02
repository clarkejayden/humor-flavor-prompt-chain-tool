"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState
} from "react";
import { useTheme } from "next-themes";

import type { MatrixAuthContext, PipelineExecutionResult } from "@/lib/matrix/types";

interface ActiveTestState {
  flavorId: string;
  imageIds: string[];
  startedAt: string;
  progress: number;
  total: number;
}

interface MatrixContextValue {
  auth: MatrixAuthContext;
  themeMode: string | undefined;
  activeTests: ActiveTestState[];
  latestResults: PipelineExecutionResult[];
  startTest: (test: Omit<ActiveTestState, "startedAt">) => void;
  updateTestProgress: (flavorId: string, progress: number, total: number) => void;
  finishTest: (flavorId: string, results: PipelineExecutionResult[]) => void;
}

const MatrixContext = createContext<MatrixContextValue | null>(null);

export function MatrixProvider({
  auth,
  children
}: {
  auth: MatrixAuthContext;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [activeTests, setActiveTests] = useState<ActiveTestState[]>([]);
  const [latestResults, setLatestResults] = useState<PipelineExecutionResult[]>([]);

  const value = useMemo<MatrixContextValue>(
    () => ({
      auth,
      themeMode: resolvedTheme,
      activeTests,
      latestResults,
      startTest(test) {
        setActiveTests((current) => [
          ...current.filter((entry) => entry.flavorId !== test.flavorId),
          {
            ...test,
            startedAt: new Date().toISOString()
          }
        ]);
      },
      updateTestProgress(flavorId, progress, total) {
        setActiveTests((current) =>
          current.map((entry) =>
            entry.flavorId === flavorId ? { ...entry, progress, total } : entry
          )
        );
      },
      finishTest(flavorId, results) {
        setActiveTests((current) => current.filter((entry) => entry.flavorId !== flavorId));
        setLatestResults(results);
      }
    }),
    [activeTests, auth, latestResults, resolvedTheme]
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export function useMatrix() {
  const context = useContext(MatrixContext);

  if (!context) {
    throw new Error("useMatrix must be used within MatrixProvider.");
  }

  return context;
}
