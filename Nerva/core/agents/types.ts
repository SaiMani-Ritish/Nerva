/**
 * Agent system types
 */

export interface Plan {
  steps: PlanStep[];
  totalEstimatedTimeMs: number;
  totalEstimatedCost: number;
  parallelizable: boolean;
  risks: string[];
}

export interface PlanStep {
  id: number;
  action: string;
  tool: string;
  inputs: Record<string, unknown>;
  rationale: string;
  dependsOn: number[] | null;
  estimatedTimeMs: number;
}

export interface ExecutionResult {
  results: StepResult[];
  summary: string;
  totalDurationMs: number;
  totalCost: number;
}

export interface StepResult {
  stepId: number;
  success: boolean;
  output: unknown;
  error: string | null;
  durationMs: number;
}

export interface Summary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  openQuestions: string[];
  contextHints: string[];
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
}

export type ProgressUpdate =
  | { type: "progress"; stepId: number; stepTotal: number; action: string; status: "running" | "complete" | "error" }
  | { type: "retry"; stepId: number; attempt: number; reason: string }
  | { type: "complete"; results: StepResult[]; summary: string };

