/**
 * Unit tests for ContextManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContextManager } from "../../../core/memory/context-manager";
import type { Message, MemoryConfig } from "../../../core/memory/types";

describe("ContextManager", () => {
  let manager: ContextManager;
  const config: MemoryConfig = {
    tokenBudget: 1000,
    vectorStoreEnabled: false,
    summaryThreshold: 0.8,
  };

  beforeEach(() => {
    manager = new ContextManager(config);
  });

  describe("addMessage", () => {
    it("should add a message to context", async () => {
      const message: Message = {
        role: "user",
        content: "Hello, world!",
        timestamp: Date.now(),
      };

      await manager.addMessage(message);

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello, world!");
      expect(messages[0].tokens).toBeGreaterThan(0);
    });

    it("should track token count", async () => {
      await manager.addMessage({
        role: "user",
        content: "This is a test message with some words",
        timestamp: Date.now(),
      });

      expect(manager.getTokenCount()).toBeGreaterThan(0);
    });

    it("should add multiple messages", async () => {
      await manager.addMessages([
        { role: "user", content: "First", timestamp: Date.now() },
        { role: "assistant", content: "Second", timestamp: Date.now() },
        { role: "user", content: "Third", timestamp: Date.now() },
      ]);

      expect(manager.getMessages()).toHaveLength(3);
    });
  });

  describe("getPromptMessages", () => {
    it("should return messages formatted for LLM", async () => {
      await manager.addMessage({
        role: "system",
        content: "You are helpful",
        timestamp: Date.now(),
      });
      await manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });

      const prompt = manager.getPromptMessages();

      expect(prompt).toHaveLength(2);
      expect(prompt[0]).toEqual({ role: "system", content: "You are helpful" });
      expect(prompt[1]).toEqual({ role: "user", content: "Hello" });
    });
  });

  describe("token budget", () => {
    it("should calculate remaining budget", async () => {
      const initial = manager.getRemainingBudget();
      expect(initial).toBe(config.tokenBudget);

      await manager.addMessage({
        role: "user",
        content: "Test message",
        timestamp: Date.now(),
      });

      expect(manager.getRemainingBudget()).toBeLessThan(initial);
    });

    it("should detect near capacity", async () => {
      // Create a manager with high threshold (no pruning) for this test
      const noPruneConfig: MemoryConfig = {
        tokenBudget: 1000,
        vectorStoreEnabled: false,
        summaryThreshold: 1.0, // Never prune
      };
      const testManager = new ContextManager(noPruneConfig);
      
      expect(testManager.isNearCapacity()).toBe(false);

      // Add messages to approach capacity (>80% of 1000 = 800 tokens)
      // With estimateTokens: ~1.3 tokens per word + 0.5 per special char
      // For "x".repeat(400): 1 word = ~1.3 tokens, but min is length/4 = 100 tokens
      for (let i = 0; i < 10; i++) {
        await testManager.addMessage({
          role: "user",
          content: "x".repeat(400), // ~100 tokens each
          timestamp: Date.now(),
        });
      }

      expect(testManager.isNearCapacity()).toBe(true);
    });
  });

  describe("pruning", () => {
    it("should prune when exceeding threshold", async () => {
      // Create a manager with low threshold for testing
      const testConfig: MemoryConfig = {
        tokenBudget: 100,
        vectorStoreEnabled: false,
        summaryThreshold: 0.5,
      };
      const testManager = new ContextManager(testConfig);

      // Add many messages to trigger pruning
      for (let i = 0; i < 20; i++) {
        await testManager.addMessage({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i} with some content to add tokens`,
          timestamp: Date.now(),
        });
      }

      // Should have fewer messages after pruning
      expect(testManager.getMessages().length).toBeLessThan(20);
    });

    it("should call summarizer when set", async () => {
      const testConfig: MemoryConfig = {
        tokenBudget: 100,
        vectorStoreEnabled: false,
        summaryThreshold: 0.3,
      };
      const testManager = new ContextManager(testConfig);

      const summarizer = vi.fn().mockResolvedValue("Summary of conversation");
      testManager.setSummarizer(summarizer);

      // Add messages to trigger pruning
      for (let i = 0; i < 15; i++) {
        await testManager.addMessage({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i} with content`,
          timestamp: Date.now(),
        });
      }

      // Summarizer should have been called
      expect(summarizer).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear all messages", async () => {
      await manager.addMessage({
        role: "user",
        content: "Test",
        timestamp: Date.now(),
      });

      manager.clear();

      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getTokenCount()).toBe(0);
    });
  });

  describe("setSystemMessage", () => {
    it("should set system message", () => {
      manager.setSystemMessage("You are a helpful assistant");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toBe("You are a helpful assistant");
    });

    it("should replace existing system message", async () => {
      manager.setSystemMessage("First system message");
      await manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      manager.setSystemMessage("Updated system message");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Updated system message");
    });
  });

  describe("getRecentMessages", () => {
    it("should return last N messages", async () => {
      for (let i = 0; i < 10; i++) {
        await manager.addMessage({
          role: "user",
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }

      const recent = manager.getRecentMessages(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].content).toBe("Message 7");
      expect(recent[2].content).toBe("Message 9");
    });
  });

  describe("popMessage", () => {
    it("should remove and return last message", async () => {
      await manager.addMessage({
        role: "user",
        content: "First",
        timestamp: Date.now(),
      });
      await manager.addMessage({
        role: "assistant",
        content: "Second",
        timestamp: Date.now(),
      });

      const popped = manager.popMessage();

      expect(popped?.content).toBe("Second");
      expect(manager.getMessages()).toHaveLength(1);
    });

    it("should update token count when popping", async () => {
      await manager.addMessage({
        role: "user",
        content: "Test message",
        timestamp: Date.now(),
      });

      const tokensBefore = manager.getTokenCount();
      manager.popMessage();

      expect(manager.getTokenCount()).toBeLessThan(tokensBefore);
    });
  });
});

