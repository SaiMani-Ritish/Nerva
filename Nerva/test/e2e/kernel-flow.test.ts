/**
 * E2E Tests: Kernel Processing Flow
 * 
 * Tests the complete kernel loop with intent parsing, routing, and execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Kernel } from "../../core/kernel/kernel";
import { MessageBus } from "../../core/kernel/message-bus";
import { MemoryManager } from "../../core/memory";
import type { KernelConfig, Context } from "../../core/kernel/types";
import type { ModelAdapter, LLMOutput } from "../../core/models/types";
import type { ToolRegistry, Tool, ToolResult } from "../../core/tools/types";

// Mock model adapter that simulates LLM responses
const createMockModelAdapter = (): ModelAdapter => ({
  generate: vi.fn(async (prompt): Promise<LLMOutput> => {
    const userMsg = prompt.messages.find((m: any) => m.role === "user")?.content || "";
    
    // Simulate different intent parsing responses
    if (userMsg.toLowerCase().includes("list files")) {
      return {
        text: JSON.stringify({
          action: "list",
          target: "files",
          parameters: { path: "./" },
          complexity: "simple",
          confidence: 0.95,
          needsClarification: false,
        }),
        finishReason: "stop",
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      };
    }
    
    if (userMsg.toLowerCase().includes("read") && userMsg.includes(".txt")) {
      const match = userMsg.match(/read\s+(\S+\.txt)/i);
      return {
        text: JSON.stringify({
          action: "read",
          target: match?.[1] || "file.txt",
          parameters: { path: match?.[1] || "file.txt" },
          complexity: "simple",
          confidence: 0.9,
          needsClarification: false,
        }),
        finishReason: "stop",
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      };
    }
    
    if (userMsg.toLowerCase().includes("search")) {
      const queryMatch = userMsg.match(/search\s+(?:for\s+)?["']?([^"']+?)["']?(?:\s+in|$)/i);
      return {
        text: JSON.stringify({
          action: "search",
          target: "files",
          parameters: { query: queryMatch?.[1] || "TODO", path: "./" },
          complexity: "simple",
          confidence: 0.85,
          needsClarification: false,
        }),
        finishReason: "stop",
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      };
    }
    
    if (userMsg.toLowerCase().includes("analyze") || userMsg.toLowerCase().includes("summarize")) {
      return {
        text: JSON.stringify({
          action: "plan",
          target: "analysis task",
          parameters: {},
          complexity: "complex",
          confidence: 0.8,
          needsClarification: false,
        }),
        finishReason: "stop",
        usage: { promptTokens: 60, completionTokens: 30, totalTokens: 90 },
      };
    }
    
    // Default: needs clarification
    return {
      text: JSON.stringify({
        action: "unknown",
        parameters: {},
        complexity: "simple",
        confidence: 0.3,
        needsClarification: true,
        clarificationQuestions: ["What would you like me to do?"],
      }),
      finishReason: "stop",
      usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 },
    };
  }),
  embed: vi.fn(async () => ({ vector: [0.1, 0.2, 0.3], model: "mock" })),
  getCapabilities: vi.fn(() => ({
    maxContextLength: 8192,
    supportsStreaming: true,
    supportsEmbedding: true,
  })),
});

// Mock tools
const createMockTools = (): Tool[] => [
  {
    name: "fs",
    description: "Filesystem operations",
    parameters: { type: "object" },
    execute: vi.fn(async (input: any): Promise<ToolResult> => {
      const operation = input.operation || "list";
      
      if (operation === "list" || input.path) {
        return {
          success: true,
          output: ["file1.txt", "file2.js", "README.md"],
          metadata: { duration_ms: 15 },
        };
      }
      if (operation === "read") {
        return {
          success: true,
          output: "File content here...",
          metadata: { duration_ms: 10 },
        };
      }
      if (operation === "search") {
        return {
          success: true,
          output: [{ file: "src/index.ts", line: 42, match: "TODO: fix this" }],
          metadata: { duration_ms: 50 },
        };
      }
      return { success: true, output: "OK", metadata: { duration_ms: 5 } };
    }),
  },
  {
    name: "web",
    description: "Web operations",
    parameters: { type: "object" },
    execute: vi.fn(async (): Promise<ToolResult> => ({
      success: true,
      output: { status: 200, body: "Web response" },
      metadata: { duration_ms: 100 },
    })),
  },
  {
    name: "process",
    description: "Process execution",
    parameters: { type: "object" },
    execute: vi.fn(async (): Promise<ToolResult> => ({
      success: true,
      output: "Command output",
      metadata: { duration_ms: 200 },
    })),
  },
];

// Create mock tool registry
const createMockRegistry = (tools: Tool[]): ToolRegistry => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  return {
    register: vi.fn(),
    get: (name: string) => toolMap.get(name),
    list: () => tools,
    getDescriptions: () => tools.map((t) => `- ${t.name}: ${t.description}`).join("\n"),
  };
};

describe("E2E: Kernel Processing Flow", () => {
  let kernel: Kernel;
  let modelAdapter: ModelAdapter;
  let toolRegistry: ToolRegistry;
  let memoryManager: MemoryManager;
  let messageBus: MessageBus;
  let context: Context;

  const config: KernelConfig = {
    modelAdapter: "mock",
    toolsEnabled: ["fs", "web", "process"],
    agentsEnabled: ["planner", "executor", "summarizer"],
    memoryConfig: { tokenBudget: 4096, vectorStoreEnabled: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    modelAdapter = createMockModelAdapter();
    const tools = createMockTools();
    toolRegistry = createMockRegistry(tools);
    memoryManager = new MemoryManager({
      tokenBudget: 4096,
      vectorStoreEnabled: false,
    });
    messageBus = new MessageBus();
    
    kernel = new Kernel(config, modelAdapter, toolRegistry, memoryManager, messageBus);
    
    context = {
      threadId: "e2e-test-thread",
      userId: "test-user",
      history: [],
      metadata: {},
    };
  });

  describe("Golden Transcript: Simple File Operations", () => {
    it("should process 'list files' request end-to-end", async () => {
      const input = "list files in the current directory";
      
      const response = await kernel.process(input, context);
      
      expect(response.type).toBe("success");
      expect(response.content).toContain("file1.txt");
      expect(response.metadata.duration_ms).toBeDefined();
      expect(response.metadata.duration_ms).toBeLessThan(1000); // Under 1s
    });

    it("should process 'read file' request end-to-end", async () => {
      const input = "read config.txt";
      
      const response = await kernel.process(input, context);
      
      expect(response.type).toBe("success");
      expect(response.metadata.duration_ms).toBeDefined();
    });

    it("should process 'search' request end-to-end", async () => {
      const input = "search for TODO comments";
      
      const response = await kernel.process(input, context);
      
      expect(response.type).toBe("success");
      expect(response.metadata.duration_ms).toBeDefined();
    });
  });

  describe("Golden Transcript: Clarification Flow", () => {
    it("should request clarification for ambiguous input", async () => {
      const input = "do something";
      
      const response = await kernel.process(input, context);
      
      expect(response.type).toBe("clarification");
      expect(response.content).toContain("clarify");
    });
  });

  describe("Golden Transcript: Error Handling", () => {
    it("should handle tool not found gracefully", async () => {
      // Force a tool lookup failure
      vi.spyOn(toolRegistry, "get").mockReturnValue(undefined);
      
      const input = "list files";
      const response = await kernel.process(input, context);
      
      // Should either error gracefully or route to planner
      expect(["error", "success"]).toContain(response.type);
    });

    it("should handle model errors gracefully", async () => {
      vi.spyOn(modelAdapter, "generate").mockRejectedValue(new Error("Model unavailable"));
      
      const input = "list files";
      const response = await kernel.process(input, context);
      
      expect(response.type).toBe("error");
      expect(response.content).toContain("error");
    });
  });

  describe("Memory Integration", () => {
    it("should store messages in memory after processing", async () => {
      const input = "list files";
      
      await kernel.process(input, context);
      
      // Memory manager should have recorded the interaction
      const stats = memoryManager.getThreadStats(context.threadId);
      expect(stats.messageCount).toBeGreaterThan(0);
    });

    it("should maintain context across multiple requests", async () => {
      await kernel.process("list files", context);
      await kernel.process("read config.txt", context);
      
      const stats = memoryManager.getThreadStats(context.threadId);
      expect(stats.messageCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Event Bus Integration", () => {
    it("should emit events during processing", async () => {
      const events: string[] = [];
      
      messageBus.subscribe("intent.parsed", () => events.push("intent.parsed"));
      messageBus.subscribe("tool.called", () => events.push("tool.called"));
      messageBus.subscribe("tool.completed", () => events.push("tool.completed"));
      
      await kernel.process("list files", context);
      
      expect(events).toContain("intent.parsed");
    });
  });
});

describe("E2E: Latency Benchmarks", () => {
  let kernel: Kernel;
  let context: Context;

  beforeEach(() => {
    const modelAdapter = createMockModelAdapter();
    const tools = createMockTools();
    const toolRegistry = createMockRegistry(tools);
    const memoryManager = new MemoryManager({
      tokenBudget: 4096,
      vectorStoreEnabled: false,
    });
    const messageBus = new MessageBus();
    
    const config: KernelConfig = {
      modelAdapter: "mock",
      toolsEnabled: ["fs", "web", "process"],
      agentsEnabled: ["planner", "executor", "summarizer"],
      memoryConfig: { tokenBudget: 4096, vectorStoreEnabled: true },
    };
    
    kernel = new Kernel(config, modelAdapter, toolRegistry, memoryManager, messageBus);
    
    context = {
      threadId: "benchmark-thread",
      userId: "benchmark-user",
      history: [],
      metadata: {},
    };
  });

  it("simple query should complete under 500ms", async () => {
    const start = Date.now();
    
    await kernel.process("list files", context);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it("intent parsing should complete under 200ms", async () => {
    const parser = kernel.getIntentParser();
    const start = Date.now();
    
    await parser.parse("list files in src/", kernel.getModelAdapter(), kernel.getToolRegistry());
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it("routing should complete under 10ms", async () => {
    const router = kernel.getRouter();
    const intent = {
      action: "list",
      target: "files",
      parameters: { path: "./" },
      complexity: "simple" as const,
      confidence: 0.9,
      needsClarification: false,
    };
    
    const start = Date.now();
    
    router.route(intent, context, kernel.getToolRegistry());
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it("memory operations should complete under 50ms", async () => {
    const memoryManager = kernel.getMemoryManager();
    const start = Date.now();
    
    await memoryManager.addUserMessage("test-thread", "Test message");
    await memoryManager.addAssistantMessage("test-thread", "Response");
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });
});

