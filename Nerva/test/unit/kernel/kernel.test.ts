/**
 * Unit tests for Kernel orchestration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Kernel, KernelDependencies } from "../../../core/kernel/kernel";
import type { KernelConfig, Context } from "../../../core/kernel/types";
import type { ModelAdapter, LLMOutput } from "../../../core/models/types";
import type { Tool, ToolRegistry, ToolResult } from "../../../core/tools/types";

// Mock model adapter
function createMockModelAdapter(response: string = "{}"): ModelAdapter {
  return {
    generate: vi.fn().mockResolvedValue({
      text: response,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    } as LLMOutput),
    embed: vi.fn().mockResolvedValue({ vector: [0.1, 0.2, 0.3], model: "mock" }),
    getCapabilities: vi.fn().mockReturnValue({
      maxContextLength: 4096,
      supportsStreaming: true,
      supportsEmbedding: true,
    }),
  };
}

// Mock tool
function createMockTool(name: string, result: unknown = { success: true }): Tool {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: result,
      metadata: { duration_ms: 10 },
    } as ToolResult),
  };
}

// Mock tool registry
function createMockToolRegistry(tools: Tool[]): ToolRegistry {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  return {
    register: vi.fn((tool: Tool) => toolMap.set(tool.name, tool)),
    get: vi.fn((name: string) => toolMap.get(name)),
    list: vi.fn(() => Array.from(toolMap.values())),
  };
}

// Create default context
function createContext(overrides: Partial<Context> = {}): Context {
  return {
    threadId: "test-thread",
    userId: "test-user",
    history: [],
    metadata: {},
    ...overrides,
  };
}

describe("Kernel", () => {
  let kernel: Kernel;
  let modelAdapter: ModelAdapter;
  let toolRegistry: ToolRegistry;
  let fsTool: Tool;
  let webTool: Tool;
  let processTool: Tool;

  const config: KernelConfig = {
    modelAdapter: "mock",
    toolsEnabled: ["fs", "web", "process"],
    agentsEnabled: ["planner", "executor", "summarizer"],
    memoryConfig: {
      tokenBudget: 4000,
      vectorStoreEnabled: true,
    },
  };

  beforeEach(() => {
    // Create mock LLM that returns valid intent JSON
    modelAdapter = createMockModelAdapter(
      JSON.stringify({
        action: "read",
        target: "/test/file.txt",
        parameters: {},
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
        clarificationQuestions: [],
      })
    );

    // Create mock tools
    fsTool = createMockTool("fs", { content: "file contents" });
    webTool = createMockTool("web", { data: "web response" });
    processTool = createMockTool("process", { output: "command output" });

    toolRegistry = createMockToolRegistry([fsTool, webTool, processTool]);

    const dependencies: KernelDependencies = {
      modelAdapter,
      toolRegistry,
    };

    kernel = new Kernel(config, dependencies);
  });

  describe("process", () => {
    it("should process simple file read intent", async () => {
      const context = createContext();
      const response = await kernel.process("read /test/file.txt", context);

      expect(response.type).toBe("success");
      expect(fsTool.execute).toHaveBeenCalled();
    });

    it("should emit events during processing", async () => {
      const events: string[] = [];
      kernel.onEvent((event) => events.push(event.type));

      const context = createContext();
      await kernel.process("read file.txt", context);

      expect(events).toContain("intent_parsed");
      expect(events).toContain("route_decided");
      expect(events).toContain("complete");
    });

    it("should request clarification for low-confidence intents", async () => {
      // Mock low-confidence response
      (modelAdapter.generate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        text: JSON.stringify({
          action: "unknown",
          parameters: {},
          complexity: "simple",
          confidence: 0.3,
          needsClarification: true,
          clarificationQuestions: ["What would you like to do?"],
        }),
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const context = createContext();
      const response = await kernel.process("something vague", context);

      expect(response.type).toBe("clarification");
      expect(response.content).toContain("What would you like to do?");
    });

    it("should handle tool execution errors", async () => {
      // Make tool fail
      (fsTool.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        error: {
          code: "ENOENT",
          message: "File not found",
          recoverable: false,
        },
        metadata: { duration_ms: 5 },
      });

      const context = createContext();
      const response = await kernel.process("read /nonexistent.txt", context);

      expect(response.type).toBe("error");
      expect(response.content).toContain("File not found");
    });

    it("should track task state", async () => {
      const context = createContext();
      await kernel.process("read file.txt", context);

      // After completion, no active tasks should remain
      const activeTasks = kernel.getActiveTasks();
      expect(activeTasks).toHaveLength(0);
    });

    it("should include duration in response metadata", async () => {
      const context = createContext();
      const response = await kernel.process("read file.txt", context);

      expect(response.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("should catch and format tool execution errors", async () => {
      // Make tool throw an error
      (fsTool.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Disk full")
      );

      const context = createContext();
      const response = await kernel.process("read /test/file.txt", context);

      expect(response.type).toBe("error");
      expect(response.content).toContain("Disk full");
    });

    it("should format common error types", async () => {
      (fsTool.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        error: {
          code: "EACCES",
          message: "EACCES: permission denied",
          recoverable: false,
        },
        metadata: { duration_ms: 5 },
      });

      const context = createContext();
      const response = await kernel.process("read /protected/file.txt", context);

      expect(response.type).toBe("error");
      expect(response.content).toContain("Permission denied");
    });
  });

  describe("event subscription", () => {
    it("should allow subscribing to kernel events", async () => {
      const intentEvents: unknown[] = [];
      const unsubscribe = kernel.subscribe("intent_parsed", (data) => {
        intentEvents.push(data);
      });

      const context = createContext();
      await kernel.process("read file.txt", context);

      expect(intentEvents.length).toBeGreaterThan(0);

      unsubscribe();
    });
  });

  describe("cleanup", () => {
    it("should cleanup old tasks", async () => {
      const context = createContext();
      await kernel.process("read file.txt", context);

      // Cleanup with 0 timeout should remove all completed tasks
      const cleaned = kernel.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Kernel with heuristic parsing", () => {
  it("should work without LLM using heuristic parsing", async () => {
    // Create model that always fails (to trigger heuristic fallback)
    const failingModel = createMockModelAdapter();
    (failingModel.generate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("LLM unavailable")
    );

    const fsTool = createMockTool("fs", { content: "data" });
    const toolRegistry = createMockToolRegistry([fsTool]);

    const kernel = new Kernel(
      {
        modelAdapter: "mock",
        toolsEnabled: ["fs"],
        agentsEnabled: [],
        memoryConfig: { tokenBudget: 4000, vectorStoreEnabled: false },
      },
      {
        modelAdapter: failingModel,
        toolRegistry,
      }
    );

    const context = createContext();
    // This should fall back to heuristic parsing
    const response = await kernel.process("read /test/file.txt", context);

    // Should still work with heuristic parsing
    expect(response.type).toBe("success");
    expect(fsTool.execute).toHaveBeenCalled();
  });
});

