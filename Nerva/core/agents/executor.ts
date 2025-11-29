/**
 * Executor agent - executes plans with retry logic
 */

import type {
  Plan,
  PlanStep,
  ExecutionResult,
  StepResult,
  ProgressUpdate,
} from "./types";
import type { Tool } from "../tools/types";

export type ProgressCallback = (update: ProgressUpdate) => void;

export interface ExecutorConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

interface ToolRegistry {
  getTool(name: string): Tool | undefined;
  execute(toolName: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export class ExecutorAgent {
  private config: ExecutorConfig;

  constructor(
    private toolRegistry: ToolRegistry,
    config?: ExecutorConfig
  ) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      baseDelayMs: config?.baseDelayMs ?? 1000,
      timeoutMs: config?.timeoutMs ?? 30000,
    };
  }

  /**
   * Execute a plan step by step
   */
  async executePlan(
    plan: Plan,
    onProgress?: ProgressCallback
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: StepResult[] = [];
    const stepOutputs: Map<number, unknown> = new Map();

    // Build execution order (topological sort respecting dependencies)
    const executionOrder = this.buildExecutionOrder(plan);

    for (const step of executionOrder) {
      // Emit progress: running
      onProgress?.({
        type: "progress",
        stepId: step.id,
        stepTotal: plan.steps.length,
        action: step.action,
        status: "running",
      });

      // Interpolate inputs from previous step outputs
      const interpolatedInputs = this.interpolateInputs(
        step.inputs,
        stepOutputs
      );

      // Execute step with retry logic
      const result = await this.executeStepWithRetry(
        step,
        interpolatedInputs,
        onProgress
      );

      results.push(result);

      if (result.success) {
        stepOutputs.set(step.id, result.output);

        // Emit progress: complete
        onProgress?.({
          type: "progress",
          stepId: step.id,
          stepTotal: plan.steps.length,
          action: step.action,
          status: "complete",
        });
      } else {
        // Emit progress: error
        onProgress?.({
          type: "progress",
          stepId: step.id,
          stepTotal: plan.steps.length,
          action: step.action,
          status: "error",
        });

        // Stop execution on failure (could make this configurable)
        break;
      }
    }

    const summary = this.generateSummary(results);
    const totalCost = this.calculateCost(results);

    // Emit complete
    onProgress?.({
      type: "complete",
      results,
      summary,
    });

    return {
      results,
      summary,
      totalDurationMs: Date.now() - startTime,
      totalCost,
    };
  }

  /**
   * Build execution order respecting dependencies
   */
  private buildExecutionOrder(plan: Plan): PlanStep[] {
    const order: PlanStep[] = [];
    const completed = new Set<number>();
    const remaining = new Set(plan.steps.map((s) => s.id));

    while (remaining.size > 0) {
      let progress = false;

      for (const step of plan.steps) {
        if (!remaining.has(step.id)) continue;

        // Check if all dependencies are completed
        const depsComplete =
          !step.dependsOn || step.dependsOn.every((id) => completed.has(id));

        if (depsComplete) {
          order.push(step);
          completed.add(step.id);
          remaining.delete(step.id);
          progress = true;
        }
      }

      if (!progress && remaining.size > 0) {
        throw new Error("Circular dependency detected in plan");
      }
    }

    return order;
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStepWithRetry(
    step: PlanStep,
    inputs: Record<string, unknown>,
    onProgress?: ProgressCallback
  ): Promise<StepResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const stepStart = Date.now();

        // Execute with timeout
        const output = await this.executeWithTimeout(step.tool, inputs);

        return {
          stepId: step.id,
          success: true,
          output,
          error: null,
          durationMs: Date.now() - stepStart,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Emit retry progress
        if (attempt < this.config.maxRetries!) {
          onProgress?.({
            type: "retry",
            stepId: step.id,
            attempt,
            reason: lastError.message,
          });

          // Exponential backoff
          const delay = this.config.baseDelayMs! * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      stepId: step.id,
      success: false,
      output: null,
      error: lastError?.message || "Unknown error",
      durationMs: 0,
    };
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    toolName: string,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return Promise.race([
      this.toolRegistry.execute(toolName, inputs),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Execution timeout")),
          this.config.timeoutMs
        )
      ),
    ]);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /rate limit/i,
      /network/i,
      /temporarily unavailable/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /503/,
      /429/,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Interpolate step inputs from previous outputs
   * Replaces ${step_N.field} with actual values
   */
  private interpolateInputs(
    inputs: Record<string, unknown>,
    stepOutputs: Map<number, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      result[key] = this.interpolateValue(value, stepOutputs);
    }

    return result;
  }

  /**
   * Interpolate a single value
   */
  private interpolateValue(
    value: unknown,
    stepOutputs: Map<number, unknown>
  ): unknown {
    if (typeof value === "string") {
      // Replace ${step_N.path.to.field} patterns
      return value.replace(
        /\$\{step_(\d+)\.([^}]+)\}/g,
        (match, stepId, path) => {
          const output = stepOutputs.get(parseInt(stepId, 10));
          if (output === undefined) {
            return match; // Keep original if step not found
          }

          const result = this.getNestedValue(output, path);
          return result !== undefined ? String(result) : match;
        }
      );
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.interpolateValue(v, stepOutputs));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.interpolateValue(v, stepOutputs);
      }
      return result;
    }

    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indexing: field[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, field, index] = arrayMatch;
        current = (current as Record<string, unknown>)[field];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  /**
   * Generate summary of execution
   */
  private generateSummary(results: StepResult[]): string {
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

    let summary = `Executed ${results.length} steps: ${successful} successful, ${failed} failed`;
    summary += ` (${totalDuration}ms total)`;

    if (failed > 0) {
      const errors = results
        .filter((r) => !r.success && r.error)
        .map((r) => `Step ${r.stepId}: ${r.error}`)
        .join("; ");
      summary += `. Errors: ${errors}`;
    }

    return summary;
  }

  /**
   * Calculate total cost from results
   */
  private calculateCost(_results: StepResult[]): number {
    // TODO: Implement cost calculation based on tool usage
    return 0;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
