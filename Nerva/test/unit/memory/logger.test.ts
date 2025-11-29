/**
 * Unit tests for ConversationLogger
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ConversationLogger } from "../../../core/memory/logger";
import type { Message } from "../../../core/memory/types";
import { promises as fs } from "fs";
import * as path from "path";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue("{}"),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

describe("ConversationLogger", () => {
  let logger: ConversationLogger;

  beforeEach(() => {
    logger = new ConversationLogger({
      basePath: "./test-transcripts",
      format: "json",
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMessage = (
    role: "user" | "assistant" | "system",
    content: string
  ): Message => ({
    role,
    content,
    timestamp: Date.now(),
  });

  describe("start", () => {
    it("should start a new transcript", () => {
      logger.start("thread-1", { model: "gpt-4" });

      const transcript = logger.get("thread-1");

      expect(transcript).toBeDefined();
      expect(transcript?.threadId).toBe("thread-1");
      expect(transcript?.metadata).toEqual({ model: "gpt-4" });
      expect(transcript?.messages).toEqual([]);
    });
  });

  describe("log", () => {
    it("should log a message to existing transcript", () => {
      logger.start("thread-1");
      const message = createMessage("user", "Hello!");

      logger.log("thread-1", message);

      const transcript = logger.get("thread-1");
      expect(transcript?.messages).toHaveLength(1);
      expect(transcript?.messages[0].content).toBe("Hello!");
    });

    it("should auto-start transcript if not exists", () => {
      const message = createMessage("user", "Hello!");

      logger.log("thread-2", message);

      const transcript = logger.get("thread-2");
      expect(transcript).toBeDefined();
      expect(transcript?.messages).toHaveLength(1);
    });

    it("should log multiple messages", () => {
      logger.start("thread-1");

      logger.logMany("thread-1", [
        createMessage("user", "Hello"),
        createMessage("assistant", "Hi there!"),
        createMessage("user", "How are you?"),
      ]);

      const transcript = logger.get("thread-1");
      expect(transcript?.messages).toHaveLength(3);
    });
  });

  describe("end", () => {
    it("should set end time on transcript", () => {
      logger.start("thread-1");
      logger.log("thread-1", createMessage("user", "Hello"));

      const transcript = logger.end("thread-1");

      expect(transcript?.endTime).toBeDefined();
      expect(transcript?.endTime).toBeGreaterThanOrEqual(transcript!.startTime);
    });

    it("should return undefined for non-existent transcript", () => {
      const transcript = logger.end("nonexistent");

      expect(transcript).toBeUndefined();
    });
  });

  describe("getActiveThreads", () => {
    it("should return threads without end time", () => {
      logger.start("thread-1");
      logger.start("thread-2");
      logger.end("thread-1");

      const active = logger.getActiveThreads();

      expect(active).toHaveLength(1);
      expect(active).toContain("thread-2");
    });
  });

  describe("save", () => {
    it("should save transcript as JSON", async () => {
      logger.start("thread-1");
      logger.log("thread-1", createMessage("user", "Hello"));

      await logger.save("thread-1");

      expect(fs.mkdir).toHaveBeenCalledWith(
        "./test-transcripts",
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalled();
      
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[0]).toContain("thread-1");
      expect(writeCall[0]).toContain(".json");
    });

    it("should save to custom path", async () => {
      logger.start("thread-1");

      await logger.save("thread-1", "./custom-path");

      expect(fs.mkdir).toHaveBeenCalledWith(
        "./custom-path",
        { recursive: true }
      );
    });

    it("should throw for non-existent transcript", async () => {
      await expect(logger.save("nonexistent")).rejects.toThrow(
        "Transcript not found"
      );
    });
  });

  describe("load", () => {
    it("should load transcript from JSON file", async () => {
      const mockTranscript = {
        threadId: "loaded-thread",
        startTime: Date.now(),
        messages: [createMessage("user", "Loaded message")],
        metadata: {},
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify(mockTranscript)
      );

      const transcript = await logger.load("./test.json");

      expect(transcript.threadId).toBe("loaded-thread");
      expect(logger.get("loaded-thread")).toBeDefined();
    });

    it("should throw for non-JSON files", async () => {
      await expect(logger.load("./test.md")).rejects.toThrow(
        "Can only load JSON transcripts"
      );
    });
  });

  describe("listSaved", () => {
    it("should list saved transcript files", async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        "thread-1.json",
        "thread-2.md",
        "other.txt",
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const files = await logger.listSaved();

      expect(files).toHaveLength(2);
      expect(files).toContain("thread-1.json");
      expect(files).toContain("thread-2.md");
    });

    it("should return empty array if directory doesn't exist", async () => {
      vi.mocked(fs.readdir).mockRejectedValueOnce(new Error("ENOENT"));

      const files = await logger.listSaved();

      expect(files).toEqual([]);
    });
  });

  describe("exportMarkdown", () => {
    it("should export transcript as markdown", () => {
      logger.start("thread-1", { model: "gpt-4" });
      logger.log("thread-1", createMessage("user", "Hello!"));
      logger.log("thread-1", createMessage("assistant", "Hi there!"));
      logger.end("thread-1");

      const md = logger.exportMarkdown("thread-1");

      expect(md).toContain("# Thread: thread-1");
      expect(md).toContain("**Started**:");
      expect(md).toContain("**Ended**:");
      expect(md).toContain("**Duration**:");
      expect(md).toContain("model");
      expect(md).toContain("👤 User");
      expect(md).toContain("Hello!");
      expect(md).toContain("🤖 Assistant");
      expect(md).toContain("Hi there!");
    });

    it("should throw for non-existent transcript", () => {
      expect(() => logger.exportMarkdown("nonexistent")).toThrow(
        "Transcript not found"
      );
    });
  });

  describe("exportJSON", () => {
    it("should export transcript as JSON string", () => {
      logger.start("thread-1");
      logger.log("thread-1", createMessage("user", "Test"));

      const json = logger.exportJSON("thread-1");
      const parsed = JSON.parse(json);

      expect(parsed.threadId).toBe("thread-1");
      expect(parsed.messages).toHaveLength(1);
    });
  });

  describe("getStats", () => {
    it("should return transcript statistics", () => {
      logger.start("thread-1");
      logger.log("thread-1", { ...createMessage("user", "Hello"), tokens: 10 });
      logger.log("thread-1", { ...createMessage("assistant", "Hi"), tokens: 5 });
      logger.log("thread-1", { ...createMessage("user", "Bye"), tokens: 8 });
      logger.end("thread-1");

      const stats = logger.getStats("thread-1");

      expect(stats.messageCount).toBe(3);
      expect(stats.totalTokens).toBe(23);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
      expect(stats.byRole).toEqual({ user: 2, assistant: 1 });
    });

    it("should throw for non-existent transcript", () => {
      expect(() => logger.getStats("nonexistent")).toThrow(
        "Transcript not found"
      );
    });
  });

  describe("remove", () => {
    it("should remove transcript from memory", () => {
      logger.start("thread-1");

      const removed = logger.remove("thread-1");

      expect(removed).toBe(true);
      expect(logger.get("thread-1")).toBeUndefined();
    });

    it("should return false for non-existent transcript", () => {
      const removed = logger.remove("nonexistent");

      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all transcripts", () => {
      logger.start("thread-1");
      logger.start("thread-2");

      logger.clear();

      expect(logger.get("thread-1")).toBeUndefined();
      expect(logger.get("thread-2")).toBeUndefined();
    });
  });
});

