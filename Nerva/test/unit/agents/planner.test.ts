/**
 * Unit tests for PlannerAgent
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlannerAgent, PlannerInput } from "../../../core/agents/planner";
import type { ModelAdapter, Prompt, LLMOutput } from "../../../core/models/types";

// Mock model adapter
function createMockAdapter(response: string): ModelAdapter {
  return {
    generate: vi.fn().mockResolvedValue({
      text: response,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    } as LLMOutput),
    embed: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({
      maxContextLength: 4096,
      supportsStreaming: true,
      supportsEmbedding: true,
    }),
  };
}

describe("PlannerAgent", () => {
  describe("createPlan", () => {
    it("should create a valid plan from LLM response", async () => {
      const mockResponse = JSON.stringify({
        steps: [
          {
            id: 1,
            action: "search",
            tool: "web.search",
            inputs: { query: "test" },
            rationale: "Find information",
            dependsOn: null,
            estimatedTimeMs: 1000,
          },
          {
            id: 2,
            action: "summarize",
            tool: "llm.summarize",
            inputs: { text: "${step_1.results}" },
            rationale: "Summarize results",
            dependsOn: [1],
            estimatedTimeMs: 2000,
          },
        ],
        totalEstimatedTimeMs: 3000,
        totalEstimatedCost: 0.05,
        parallelizable: false,
        risks: ["Search might fail"],
      });

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      const input: PlannerInput = {
        goal: "Research and summarize a topic",
        availableTools: ["web.search", "llm.summarize"],
      };

      const plan = await planner.createPlan(input);

      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].tool).toBe("web.search");
      expect(plan.steps[1].dependsOn).toEqual([1]);
      expect(plan.totalEstimatedTimeMs).toBe(3000);
      expect(plan.risks).toContain("Search might fail");
    });

    it("should parse JSON from markdown code blocks", async () => {
      const mockResponse = `Here's the plan:

\`\`\`json
{
  "steps": [
    {
      "id": 1,
      "action": "read",
      "tool": "fs.read",
      "inputs": { "path": "/test.txt" },
      "rationale": "Read file",
      "dependsOn": null,
      "estimatedTimeMs": 100
    }
  ],
  "totalEstimatedTimeMs": 100,
  "totalEstimatedCost": 0,
  "parallelizable": false,
  "risks": []
}
\`\`\``;

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      const plan = await planner.createPlan({
        goal: "Read a file",
        availableTools: ["fs.read"],
      });

      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].tool).toBe("fs.read");
    });

    it("should normalize snake_case to camelCase", async () => {
      const mockResponse = JSON.stringify({
        steps: [
          {
            id: 1,
            action: "test",
            tool: "test.tool",
            inputs: {},
            rationale: "Test",
            depends_on: null,
            estimated_time_ms: 1000,
          },
        ],
        total_estimated_time_ms: 1000,
        total_estimated_cost: 0.1,
        parallelizable: true,
        risks: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      const plan = await planner.createPlan({
        goal: "Test",
        availableTools: ["test.tool"],
      });

      expect(plan.steps[0].dependsOn).toBeNull();
      expect(plan.steps[0].estimatedTimeMs).toBe(1000);
      expect(plan.totalEstimatedTimeMs).toBe(1000);
    });

    it("should throw on invalid JSON response", async () => {
      const adapter = createMockAdapter("This is not valid JSON");
      const planner = new PlannerAgent(adapter);

      await expect(
        planner.createPlan({
          goal: "Test",
          availableTools: ["test.tool"],
        })
      ).rejects.toThrow("Failed to parse plan response");
    });

    it("should throw on unavailable tool", async () => {
      const mockResponse = JSON.stringify({
        steps: [
          {
            id: 1,
            action: "test",
            tool: "unavailable.tool",
            inputs: {},
            rationale: "Test",
            dependsOn: null,
            estimatedTimeMs: 1000,
          },
        ],
        totalEstimatedTimeMs: 1000,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      await expect(
        planner.createPlan({
          goal: "Test",
          availableTools: ["other.tool"],
        })
      ).rejects.toThrow("unavailable tool");
    });

    it("should throw on duplicate step IDs", async () => {
      const mockResponse = JSON.stringify({
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
          { id: 1, action: "b", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 200,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      await expect(
        planner.createPlan({
          goal: "Test",
          availableTools: ["t"],
        })
      ).rejects.toThrow("Duplicate step ID");
    });

    it("should throw on invalid dependency", async () => {
      const mockResponse = JSON.stringify({
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: [99], estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 100,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const planner = new PlannerAgent(adapter);

      await expect(
        planner.createPlan({
          goal: "Test",
          availableTools: ["t"],
        })
      ).rejects.toThrow("non-existent step");
    });
  });

  describe("getExecutionLevels", () => {
    it("should return steps grouped by execution level", () => {
      const plan = {
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
          { id: 2, action: "b", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
          { id: 3, action: "c", tool: "t", inputs: {}, rationale: "", dependsOn: [1, 2], estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 300,
        totalEstimatedCost: 0,
        parallelizable: true,
        risks: [],
      };

      const levels = PlannerAgent.getExecutionLevels(plan);

      expect(levels).toHaveLength(2);
      expect(levels[0]).toHaveLength(2); // Steps 1 and 2 can run in parallel
      expect(levels[1]).toHaveLength(1); // Step 3 depends on both
      expect(levels[1][0].id).toBe(3);
    });

    it("should detect circular dependencies", () => {
      const plan = {
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: [2], estimatedTimeMs: 100 },
          { id: 2, action: "b", tool: "t", inputs: {}, rationale: "", dependsOn: [1], estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 200,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      };

      expect(() => PlannerAgent.getExecutionLevels(plan)).toThrow(
        "Circular dependency"
      );
    });
  });

  describe("canParallelize", () => {
    it("should return true for parallelizable plans", () => {
      const plan = {
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
          { id: 2, action: "b", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 200,
        totalEstimatedCost: 0,
        parallelizable: true,
        risks: [],
      };

      expect(PlannerAgent.canParallelize(plan)).toBe(true);
    });

    it("should return false for sequential plans", () => {
      const plan = {
        steps: [
          { id: 1, action: "a", tool: "t", inputs: {}, rationale: "", dependsOn: null, estimatedTimeMs: 100 },
          { id: 2, action: "b", tool: "t", inputs: {}, rationale: "", dependsOn: [1], estimatedTimeMs: 100 },
        ],
        totalEstimatedTimeMs: 200,
        totalEstimatedCost: 0,
        parallelizable: false,
        risks: [],
      };

      expect(PlannerAgent.canParallelize(plan)).toBe(false);
    });
  });
});

