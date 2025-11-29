/**
 * Unit tests for ExecutorAgent
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutorAgent, ProgressCallback } from "../../../core/agents/executor";
import type { Plan, PlanStep, ProgressUpdate } from "../../../core/agents/types";
import type { Tool } from "../../../core/tools/types";

// Mock tool registry
function createMockRegistry(
  tools: Record<string, unknown>,
  executeResults: Record<string, unknown> = {}
) {
  return {
    getTool: vi.fn((name: string) =>
      tools[name]
        ? ({
            name,
            description: "Mock tool",
            parameters: {},
            execute: vi.fn(),
          } as Tool)
        : undefined
    ),
    execute: vi.fn((toolName: string, _inputs: Record<string, unknown>) => {
      if (executeResults[toolName] instanceof Error) {
        return Promise.reject(executeResults[toolName]);
      }
      return Promise.resolve(executeResults[toolName] ?? { success: true });
    }),
  };
}

function createPlan(steps: Partial<PlanStep>[]): Plan {
  return {
    steps: steps.map((s, i) => ({
      id: s.id ?? i + 1,
      action: s.action ?? `action_${i + 1}`,
      tool: s.tool ?? "test.tool",
      inputs: s.inputs ?? {},
      rationale: s.rationale ?? "",
      dependsOn: s.dependsOn ?? null,
      estimatedTimeMs: s.estimatedTimeMs ?? 100,
    })),
    totalEstimatedTimeMs: 1000,
    totalEstimatedCost: 0,
    parallelizable: false,
    risks: [],
  };
}

describe("ExecutorAgent", () => {
  describe("executePlan", () => {
    it("should execute a simple plan successfully", async () => {
      const registry = createMockRegistry(
        { "test.tool": true },
        { "test.tool": { data: "result" } }
      );
      const executor = new ExecutorAgent(registry);

      const plan = createPlan([{ id: 1, tool: "test.tool" }]);

      const result = await executor.executePlan(plan);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output).toEqual({ data: "result" });
      expect(registry.execute).toHaveBeenCalledWith("test.tool", {});
    });

    it("should execute steps in dependency order", async () => {
      const executionOrder: number[] = [];
      const registry = {
        getTool: vi.fn(() => ({ name: "t", description: "", parameters: {}, execute: vi.fn() })),
        execute: vi.fn((_: string, inputs: Record<string, unknown>) => {
          executionOrder.push(inputs.stepId as number);
          return Promise.resolve({ success: true });
        }),
      };

      const executor = new ExecutorAgent(registry);

      const plan = createPlan([
        { id: 1, inputs: { stepId: 1 }, dependsOn: null },
        { id: 2, inputs: { stepId: 2 }, dependsOn: [1] },
        { id: 3, inputs: { stepId: 3 }, dependsOn: [2] },
      ]);

      await executor.executePlan(plan);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should emit progress updates", async () => {
      const registry = createMockRegistry({ "test.tool": true });
      const executor = new ExecutorAgent(registry);

      const updates: ProgressUpdate[] = [];
      const onProgress: ProgressCallback = (update) => updates.push(update);

      const plan = createPlan([{ id: 1, action: "test_action" }]);

      await executor.executePlan(plan, onProgress);

      expect(updates).toContainEqual(
        expect.objectContaining({
          type: "progress",
          stepId: 1,
          status: "running",
        })
      );
      expect(updates).toContainEqual(
        expect.objectContaining({
          type: "progress",
          stepId: 1,
          status: "complete",
        })
      );
      expect(updates).toContainEqual(
        expect.objectContaining({
          type: "complete",
        })
      );
    });

    it("should interpolate step outputs into inputs", async () => {
      const capturedInputs: Record<string, unknown>[] = [];
      const registry = {
        getTool: vi.fn(() => ({ name: "t", description: "", parameters: {}, execute: vi.fn() })),
        execute: vi.fn((_: string, inputs: Record<string, unknown>) => {
          capturedInputs.push(inputs);
          if (capturedInputs.length === 1) {
            return Promise.resolve({ data: "step1_result", items: ["a", "b"] });
          }
          return Promise.resolve({ success: true });
        }),
      };

      const executor = new ExecutorAgent(registry);

      const plan = createPlan([
        { id: 1, inputs: {} },
        { id: 2, inputs: { value: "${step_1.data}", first: "${step_1.items[0]}" }, dependsOn: [1] },
      ]);

      await executor.executePlan(plan);

      expect(capturedInputs[1]).toEqual({
        value: "step1_result",
        first: "a",
      });
    });

    it("should stop execution on failure", async () => {
      const registry = createMockRegistry(
        { "test.tool": true },
        { "test.tool": new Error("Tool failed") }
      );
      const executor = new ExecutorAgent(registry, { maxRetries: 1 });

      const plan = createPlan([
        { id: 1, tool: "test.tool" },
        { id: 2, tool: "test.tool", dependsOn: [1] },
      ]);

      const result = await executor.executePlan(plan);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe("Tool failed");
    });

    it("should throw on missing tool", async () => {
      const registry = createMockRegistry({});
      const executor = new ExecutorAgent(registry);

      const plan = createPlan([{ id: 1, tool: "missing.tool" }]);

      const result = await executor.executePlan(plan);

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("Tool not found");
    });
  });

  describe("retry logic", () => {
    it("should retry on transient errors", async () => {
      let attempts = 0;
      const registry = {
        getTool: vi.fn(() => ({ name: "t", description: "", parameters: {}, execute: vi.fn() })),
        execute: vi.fn(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(new Error("Network timeout"));
          }
          return Promise.resolve({ success: true });
        }),
      };

      const executor = new ExecutorAgent(registry, {
        maxRetries: 3,
        baseDelayMs: 10, // Short delay for tests
      });

      const plan = createPlan([{ id: 1 }]);

      const result = await executor.executePlan(plan);

      expect(attempts).toBe(3);
      expect(result.results[0].success).toBe(true);
    });

    it("should not retry on permanent errors", async () => {
      let attempts = 0;
      const registry = {
        getTool: vi.fn(() => ({ name: "t", description: "", parameters: {}, execute: vi.fn() })),
        execute: vi.fn(() => {
          attempts++;
          return Promise.reject(new Error("Permission denied"));
        }),
      };

      const executor = new ExecutorAgent(registry, {
        maxRetries: 3,
        baseDelayMs: 10,
      });

      const plan = createPlan([{ id: 1 }]);

      const result = await executor.executePlan(plan);

      expect(attempts).toBe(1); // No retries for permanent errors
      expect(result.results[0].success).toBe(false);
    });

    it("should emit retry progress updates", async () => {
      let attempts = 0;
      const registry = {
        getTool: vi.fn(() => ({ name: "t", description: "", parameters: {}, execute: vi.fn() })),
        execute: vi.fn(() => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new Error("Rate limit exceeded"));
          }
          return Promise.resolve({ success: true });
        }),
      };

      const executor = new ExecutorAgent(registry, {
        maxRetries: 3,
        baseDelayMs: 10,
      });

      const updates: ProgressUpdate[] = [];
      const plan = createPlan([{ id: 1 }]);

      await executor.executePlan(plan, (update) => updates.push(update));

      const retryUpdate = updates.find((u) => u.type === "retry");
      expect(retryUpdate).toBeDefined();
      expect(retryUpdate?.type === "retry" && retryUpdate.attempt).toBe(1);
    });
  });

  describe("circular dependency detection", () => {
    it("should throw on circular dependencies", async () => {
      const registry = createMockRegistry({ "test.tool": true });
      const executor = new ExecutorAgent(registry);

      const plan: Plan = {
        steps: [
          { id: 1, action: "a", tool: "test.tool", inputs: {}, rationale: "", dependsOn: [2], estimatedTimeMs: 100 },
          { id: 2, action: "b", tool: "test.tool", inputs: {}, rationale: "", dependsOn: [1], estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 200,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      };

      await expect(executor.executePlan(plan)).rejects.toThrow(
        "Circular dependency"
      );
    });
  });

  describe("summary generation", () => {
    it("should generate accurate summary", async () => {
      const registry = createMockRegistry({ "test.tool": true });
      const executor = new ExecutorAgent(registry);

      const plan = createPlan([
        { id: 1 },
        { id: 2, dependsOn: [1] },
        { id: 3, dependsOn: [2] },
      ]);

      const result = await executor.executePlan(plan);

      expect(result.summary).toContain("3 steps");
      expect(result.summary).toContain("3 successful");
      expect(result.summary).toContain("0 failed");
    });

    it("should include errors in summary", async () => {
      const registry = createMockRegistry(
        { "test.tool": true },
        { "test.tool": new Error("Something broke") }
      );
      const executor = new ExecutorAgent(registry, { maxRetries: 1 });

      const plan = createPlan([{ id: 1 }]);

      const result = await executor.executePlan(plan);

      expect(result.summary).toContain("1 failed");
      expect(result.summary).toContain("Something broke");
    });
  });
});

