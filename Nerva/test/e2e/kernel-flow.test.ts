/**
 * E2E Tests: Kernel Processing Flow
 * 
 * Tests the complete kernel loop with intent parsing, routing, and execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntentParser } from "../../core/kernel/intent-parser";
import { Router } from "../../core/kernel/router";
import { MemoryManager } from "../../core/memory";
import { MessageBus } from "../../core/kernel/message-bus";
import type { Intent } from "../../core/kernel/types";
import type { ModelAdapter, LLMOutput } from "../../core/models/types";
import type { Tool, ToolResult } from "../../core/tools/types";

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
      const operation = input.operation || input.action || "list";
      
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
const createMockRegistry = (tools: Tool[]) => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  return {
    register: vi.fn(),
    get: (name: string) => toolMap.get(name),
    list: () => tools,
    getDescriptions: () => tools.map((t) => `- ${t.name}: ${t.description}`).join("\n"),
  };
};

describe("E2E: Intent Parser", () => {
  let parser: IntentParser;
  let modelAdapter: ModelAdapter;
  let toolRegistry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    modelAdapter = createMockModelAdapter();
    const tools = createMockTools();
    toolRegistry = createMockRegistry(tools);
    parser = new IntentParser();
  });

  it("should parse 'list files' correctly", async () => {
    const intent = await parser.parse("list files in the current directory", modelAdapter, toolRegistry as any);
    
    expect(intent.action).toBe("list");
    expect(intent.complexity).toBe("simple");
    // Heuristic parsing returns 0.7-0.8 confidence
    expect(intent.confidence).toBeGreaterThanOrEqual(0.5);
    expect(intent.needsClarification).toBe(false);
  });

  it("should parse 'read file' correctly", async () => {
    const intent = await parser.parse("read config.txt", modelAdapter, toolRegistry as any);
    
    expect(intent.action).toBe("read");
    expect(intent.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("should parse 'search' correctly", async () => {
    const intent = await parser.parse("search for TODO comments", modelAdapter, toolRegistry as any);
    
    expect(intent.action).toBe("search");
    expect(intent.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("should request clarification for ambiguous input", async () => {
    const intent = await parser.parse("do something", modelAdapter, toolRegistry as any);
    
    // Either needsClarification is true or confidence is low
    expect(intent.confidence).toBeLessThanOrEqual(0.7);
  });

  it("should fall back to heuristics on LLM failure", async () => {
    vi.spyOn(modelAdapter, "generate").mockRejectedValue(new Error("LLM unavailable"));
    
    const intent = await parser.parse("list files", modelAdapter, toolRegistry as any);
    
    // Heuristic should still produce a reasonable intent
    expect(intent.action).toBeDefined();
  });
});

describe("E2E: Router", () => {
  let router: Router;
  let toolRegistry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    const tools = createMockTools();
    toolRegistry = createMockRegistry(tools);
    // Pass toolRegistry via constructor
    router = new Router({}, toolRegistry as any);
  });

  it("should route simple intents to tools", () => {
    const intent: Intent = {
      action: "list",
      target: "files",
      parameters: { path: "./" },
      complexity: "simple",
      confidence: 0.9,
      needsClarification: false,
    };
    
    const context = {
      threadId: "test-thread",
      userId: "test-user",
      history: [],
      metadata: {},
    };
    
    const decision = router.route(intent, context);
    
    // Router returns type: "direct" for tool execution
    expect(decision.type).toBe("direct");
    if (decision.type === "direct") {
      expect(decision.tool).toBe("fs");
    }
  });

  it("should route complex intents to planner", () => {
    const intent: Intent = {
      action: "analyze",
      target: "analysis task",
      parameters: {},
      complexity: "complex",
      confidence: 0.8,
      needsClarification: false,
    };
    
    const context = {
      threadId: "test-thread",
      userId: "test-user",
      history: [],
      metadata: {},
    };
    
    const decision = router.route(intent, context);
    
    // Router returns type: "plan" for complex intents
    expect(decision.type).toBe("plan");
  });

  it("should request clarification when needed", () => {
    const intent: Intent = {
      action: "unknown",
      parameters: {},
      complexity: "simple",
      confidence: 0.3,
      needsClarification: true,
      clarificationQuestions: ["What would you like me to do?"],
    };
    
    const context = {
      threadId: "test-thread",
      userId: "test-user",
      history: [],
      metadata: {},
    };
    
    const decision = router.route(intent, context);
    
    expect(decision.type).toBe("clarify");
  });
});

describe("E2E: Memory Integration", () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      tokenBudget: 4096,
      vectorStoreEnabled: false,
    });
  });

  it("should store and retrieve messages", async () => {
    const threadId = "test-thread";
    
    await memoryManager.addUserMessage(threadId, "Hello");
    await memoryManager.addAssistantMessage(threadId, "Hi there!");
    
    const stats = memoryManager.getThreadStats(threadId);
    expect(stats.messageCount).toBe(2);
  });

  it("should maintain separate contexts per thread", async () => {
    await memoryManager.addUserMessage("thread-1", "Message 1");
    await memoryManager.addUserMessage("thread-2", "Message 2");
    await memoryManager.addUserMessage("thread-2", "Message 3");
    
    const stats1 = memoryManager.getThreadStats("thread-1");
    const stats2 = memoryManager.getThreadStats("thread-2");
    
    expect(stats1.messageCount).toBe(1);
    expect(stats2.messageCount).toBe(2);
  });
});

describe("E2E: Message Bus Integration", () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  it("should emit and receive events", async () => {
    const events: string[] = [];
    
    messageBus.subscribe("test.event", (data: any) => {
      events.push(data.message);
    });
    
    // publish is async
    await messageBus.publish("test.event", { message: "hello" });
    await messageBus.publish("test.event", { message: "world" });
    
    expect(events).toContain("hello");
    expect(events).toContain("world");
  });

  it("should support one-time listeners", async () => {
    let callCount = 0;
    
    messageBus.once("once.event", () => {
      callCount++;
    });
    
    await messageBus.publish("once.event", {});
    await messageBus.publish("once.event", {});
    await messageBus.publish("once.event", {});
    
    expect(callCount).toBe(1);
  });

  it("should support waitFor", async () => {
    setTimeout(() => {
      messageBus.publish("delayed.event", { value: 42 });
    }, 10);
    
    const result = await messageBus.waitFor("delayed.event", 1000) as { value: number };
    
    expect(result.value).toBe(42);
  });
});

describe("E2E: Latency Benchmarks", () => {
  it("intent parsing should complete under 200ms", async () => {
    const parser = new IntentParser();
    const modelAdapter = createMockModelAdapter();
    const tools = createMockTools();
    const toolRegistry = createMockRegistry(tools);
    
    const start = Date.now();
    
    await parser.parse("list files in src/", modelAdapter, toolRegistry as any);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it("routing should complete under 10ms", () => {
    const tools = createMockTools();
    const toolRegistry = createMockRegistry(tools);
    const router = new Router({}, toolRegistry as any);
    
    const intent: Intent = {
      action: "list",
      target: "files",
      parameters: { path: "./" },
      complexity: "simple",
      confidence: 0.9,
      needsClarification: false,
    };
    
    const context = {
      threadId: "test-thread",
      userId: "test-user",
      history: [],
      metadata: {},
    };
    
    const start = Date.now();
    
    router.route(intent, context);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it("memory operations should complete under 50ms", async () => {
    const memoryManager = new MemoryManager({
      tokenBudget: 4096,
      vectorStoreEnabled: false,
    });
    
    const start = Date.now();
    
    await memoryManager.addUserMessage("test-thread", "Test message");
    await memoryManager.addAssistantMessage("test-thread", "Response");
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });

  it("message bus operations should complete under 10ms", async () => {
    const messageBus = new MessageBus();
    let received = false;
    
    messageBus.subscribe("perf.test", () => {
      received = true;
    });
    
    const start = Date.now();
    
    await messageBus.publish("perf.test", {});
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10);
    expect(received).toBe(true);
  });
});
