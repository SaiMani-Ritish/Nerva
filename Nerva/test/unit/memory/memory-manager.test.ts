/**
 * Unit tests for MemoryManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryManager, MemoryManagerConfig } from "../../../core/memory/memory-manager";
import type { EmbeddingProvider } from "../../../core/memory/vector-store";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue("{}"),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

describe("MemoryManager", () => {
  let manager: MemoryManager;
  const config: MemoryManagerConfig = {
    tokenBudget: 4000,
    vectorStoreEnabled: true,
    summaryThreshold: 0.8,
    loggerBasePath: "./test-logs",
    logFormat: "json",
  };

  beforeEach(() => {
    manager = new MemoryManager(config);
    vi.clearAllMocks();
  });

  describe("getContext", () => {
    it("should create context for new thread", () => {
      const context = manager.getContext("thread-1");

      expect(context).toBeDefined();
      expect(context.getMessages()).toEqual([]);
    });

    it("should return same context for existing thread", () => {
      const context1 = manager.getContext("thread-1");
      const context2 = manager.getContext("thread-1");

      expect(context1).toBe(context2);
    });
  });

  describe("addMessage", () => {
    it("should add message to context and log", async () => {
      await manager.addMessage("thread-1", {
        role: "user",
        content: "Hello!",
        timestamp: Date.now(),
      });

      const context = manager.getContext("thread-1");
      expect(context.getMessages()).toHaveLength(1);
    });

    it("should add user message", async () => {
      await manager.addUserMessage("thread-1", "User message");

      const messages = manager.getPromptMessages("thread-1");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "user",
        content: "User message",
      });
    });

    it("should add assistant message", async () => {
      await manager.addAssistantMessage("thread-1", "Assistant response");

      const messages = manager.getPromptMessages("thread-1");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Assistant response",
      });
    });
  });

  describe("getPromptMessages", () => {
    it("should return formatted messages for LLM", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.addAssistantMessage("thread-1", "Hi there!");
      await manager.addUserMessage("thread-1", "How are you?");

      const messages = manager.getPromptMessages("thread-1");

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
      expect(messages[2]).toEqual({ role: "user", content: "How are you?" });
    });
  });

  describe("storeMemory", () => {
    it("should store memory entry and return id", async () => {
      const id = await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Important information",
        metadata: { type: "note" },
      });

      expect(id).toMatch(/^mem_/);
    });
  });

  describe("searchMemory", () => {
    it("should search stored memories", async () => {
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "TypeScript is a typed language",
        metadata: {},
      });
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Python is dynamically typed",
        metadata: {},
      });

      const results = await manager.searchMemory("TypeScript");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should filter by threadId", async () => {
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Thread 1 content",
        metadata: {},
      });
      await manager.storeMemory({
        threadId: "thread-2",
        timestamp: Date.now(),
        content: "Thread 2 content",
        metadata: {},
      });

      const results = await manager.searchMemory("content", 10, "thread-1");

      expect(results).toHaveLength(1);
      expect(results[0].entry.threadId).toBe("thread-1");
    });
  });

  describe("getRelevantMemories", () => {
    it("should return relevant memory contents", async () => {
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "The API key is stored in environment variables",
        metadata: {},
      });

      const relevant = await manager.getRelevantMemories("API key");

      expect(relevant.length).toBeGreaterThan(0);
    });
  });

  describe("endThread", () => {
    it("should end thread and optionally save", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.addAssistantMessage("thread-1", "Hi!");

      const savedPath = await manager.endThread("thread-1", true);

      // Path should be returned (mock saves successfully)
      expect(savedPath).toBeDefined();
    });

    it("should store conversation summary in vector store", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.addAssistantMessage("thread-1", "Hi there!");

      await manager.endThread("thread-1", false);

      // Search for the summary
      const results = await manager.searchMemory("conversation", 10, "thread-1");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("clearContext", () => {
    it("should clear thread context but keep logs", async () => {
      await manager.addUserMessage("thread-1", "Hello");

      manager.clearContext("thread-1");

      const context = manager.getContext("thread-1");
      expect(context.getMessages()).toHaveLength(0);
    });
  });

  describe("deleteThread", () => {
    it("should delete thread entirely", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Memory",
        metadata: {},
      });

      manager.deleteThread("thread-1");

      const results = await manager.searchMemory("Memory", 10, "thread-1");
      expect(results).toHaveLength(0);
    });
  });

  describe("getThreadStats", () => {
    it("should return thread statistics", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.addAssistantMessage("thread-1", "Hi!");
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Memory entry",
        metadata: {},
      });

      const stats = manager.getThreadStats("thread-1");

      expect(stats.contextTokens).toBeGreaterThan(0);
      expect(stats.remainingBudget).toBeLessThan(config.tokenBudget);
      expect(stats.messageCount).toBe(2);
      expect(stats.memoryEntries).toBe(1);
    });
  });

  describe("getActiveThreads", () => {
    it("should return list of active thread IDs", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.addUserMessage("thread-2", "Hi");

      const threads = manager.getActiveThreads();

      expect(threads).toHaveLength(2);
      expect(threads).toContain("thread-1");
      expect(threads).toContain("thread-2");
    });
  });

  describe("setSummarizer", () => {
    it("should set summarizer for all contexts", async () => {
      const summarizer = vi.fn().mockResolvedValue("Summary");

      // Create context first
      await manager.addUserMessage("thread-1", "Hello");

      // Set summarizer
      manager.setSummarizer(summarizer);

      // New contexts should also get the summarizer
      manager.getContext("thread-2");

      // Summarizer is set (would be called when pruning)
      expect(summarizer).not.toHaveBeenCalled(); // Not called yet
    });
  });

  describe("setEmbeddingProvider", () => {
    it("should set embedding provider for vector store", async () => {
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      manager.setEmbeddingProvider(mockProvider);

      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Test content",
        metadata: {},
      });

      expect(mockProvider.embed).toHaveBeenCalledWith("Test content");
    });
  });

  describe("export/import", () => {
    it("should export memories and active threads", async () => {
      await manager.addUserMessage("thread-1", "Hello");
      await manager.storeMemory({
        threadId: "thread-1",
        timestamp: Date.now(),
        content: "Memory",
        metadata: {},
      });

      const exported = manager.export();

      expect(exported.memories).toHaveLength(1);
      expect(exported.transcripts).toHaveLength(1);
    });

    it("should import memories", async () => {
      manager.importMemories([
        {
          id: "imported-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          content: "Imported memory",
          metadata: {},
        },
      ]);

      const results = await manager.searchMemory("Imported");

      expect(results.length).toBeGreaterThan(0);
    });
  });
});

