/**
 * Unit tests for VectorStore
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VectorStore, EmbeddingProvider } from "../../../core/memory/vector-store";
import type { MemoryEntry } from "../../../core/memory/types";

describe("VectorStore", () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  const createEntry = (
    id: string,
    content: string,
    threadId: string = "thread-1"
  ): MemoryEntry => ({
    id,
    threadId,
    timestamp: Date.now(),
    content,
    metadata: {},
  });

  describe("store", () => {
    it("should store an entry", async () => {
      const entry = createEntry("1", "Test content");
      await store.store(entry);

      expect(store.get("1")).toEqual(entry);
    });

    it("should store multiple entries", async () => {
      await store.storeMany([
        createEntry("1", "First"),
        createEntry("2", "Second"),
        createEntry("3", "Third"),
      ]);

      expect(store.size()).toBe(3);
    });

    it("should generate embedding when provider is set", async () => {
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };
      store.setEmbeddingProvider(mockProvider);

      const entry = createEntry("1", "Test content");
      await store.store(entry);

      expect(mockProvider.embed).toHaveBeenCalledWith("Test content");
      expect(store.get("1")?.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await store.storeMany([
        createEntry("1", "The quick brown fox jumps over the lazy dog"),
        createEntry("2", "Machine learning is a subset of artificial intelligence"),
        createEntry("3", "TypeScript is a typed superset of JavaScript"),
        createEntry("4", "The fox is quick and brown", "thread-2"),
      ]);
    });

    it("should search using keyword similarity when no embeddings", async () => {
      const results = await store.search("fox quick", 2);

      expect(results.length).toBeGreaterThan(0);
      // Results should include entries with matching keywords
      const ids = results.map((r) => r.entry.id);
      expect(ids).toContain("1"); // Contains "fox" and "quick"
    });

    it("should filter by threadId", async () => {
      const results = await store.search("fox", 10, "thread-2");

      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe("4");
    });

    it("should limit results", async () => {
      const results = await store.search("the", 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should use embeddings when provider is set", async () => {
      // Set up mock embedding provider
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn().mockImplementation((text: string) => {
          // Simple mock: return different vectors based on content
          if (text.includes("fox")) return Promise.resolve([1, 0, 0]);
          if (text.includes("machine")) return Promise.resolve([0, 1, 0]);
          return Promise.resolve([0, 0, 1]);
        }),
      };

      const embeddedStore = new VectorStore();
      embeddedStore.setEmbeddingProvider(mockProvider);

      // Store entries with embeddings
      await embeddedStore.store({
        id: "1",
        threadId: "t1",
        timestamp: Date.now(),
        content: "The fox is quick",
        metadata: {},
      });

      const results = await embeddedStore.search("fox jumps", 5);

      expect(mockProvider.embed).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("searchByKeyword", () => {
    beforeEach(async () => {
      await store.storeMany([
        createEntry("1", "apple banana"),
        createEntry("2", "banana cherry date"),
        createEntry("3", "cherry date elderberry"),
      ]);
    });

    it("should find entries matching keywords", () => {
      const results = store.searchByKeyword(["banana"]);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain("1");
      expect(results.map((r) => r.id)).toContain("2");
    });

    it("should rank by keyword match count", () => {
      const results = store.searchByKeyword(["banana", "cherry"]);

      // Entry 2 has both keywords, entry 1 has only banana
      expect(results[0].id).toBe("2");
    });

    it("should limit results", () => {
      const results = store.searchByKeyword(["cherry"], 1);

      expect(results).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update existing entry", async () => {
      await store.store(createEntry("1", "Original content"));

      const updated = await store.update("1", { content: "Updated content" });

      expect(updated).toBe(true);
      expect(store.get("1")?.content).toBe("Updated content");
    });

    it("should return false for non-existent entry", async () => {
      const updated = await store.update("nonexistent", { content: "New" });

      expect(updated).toBe(false);
    });

    it("should regenerate embedding on content update", async () => {
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn().mockResolvedValue([0.5, 0.5, 0.5]),
      };
      store.setEmbeddingProvider(mockProvider);

      await store.store(createEntry("1", "Original"));
      await store.update("1", { content: "Updated" });

      expect(mockProvider.embed).toHaveBeenCalledTimes(2);
      expect(mockProvider.embed).toHaveBeenLastCalledWith("Updated");
    });
  });

  describe("delete", () => {
    it("should delete entry by id", async () => {
      await store.store(createEntry("1", "Test"));

      const deleted = store.delete("1");

      expect(deleted).toBe(true);
      expect(store.get("1")).toBeUndefined();
    });

    it("should return false for non-existent entry", () => {
      const deleted = store.delete("nonexistent");

      expect(deleted).toBe(false);
    });
  });

  describe("deleteThread", () => {
    it("should delete all entries for a thread", async () => {
      await store.storeMany([
        createEntry("1", "First", "thread-1"),
        createEntry("2", "Second", "thread-1"),
        createEntry("3", "Third", "thread-2"),
      ]);

      const deleted = store.deleteThread("thread-1");

      expect(deleted).toBe(2);
      expect(store.size()).toBe(1);
      expect(store.get("3")).toBeDefined();
    });
  });

  describe("getByThread", () => {
    it("should return all entries for a thread", async () => {
      await store.storeMany([
        createEntry("1", "First", "thread-1"),
        createEntry("2", "Second", "thread-1"),
        createEntry("3", "Third", "thread-2"),
      ]);

      const entries = store.getByThread("thread-1");

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.id)).toContain("1");
      expect(entries.map((e) => e.id)).toContain("2");
    });
  });

  describe("getThreadIds", () => {
    it("should return unique thread IDs", async () => {
      await store.storeMany([
        createEntry("1", "First", "thread-1"),
        createEntry("2", "Second", "thread-1"),
        createEntry("3", "Third", "thread-2"),
      ]);

      const threads = store.getThreadIds();

      expect(threads).toHaveLength(2);
      expect(threads).toContain("thread-1");
      expect(threads).toContain("thread-2");
    });
  });

  describe("export/import", () => {
    it("should export all entries", async () => {
      await store.storeMany([
        createEntry("1", "First"),
        createEntry("2", "Second"),
      ]);

      const exported = store.export();

      expect(exported).toHaveLength(2);
    });

    it("should import entries", () => {
      const entries = [
        createEntry("1", "First"),
        createEntry("2", "Second"),
      ];

      store.import(entries);

      expect(store.size()).toBe(2);
      expect(store.get("1")).toEqual(entries[0]);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await store.storeMany([
        createEntry("1", "First"),
        createEntry("2", "Second"),
      ]);

      store.clear();

      expect(store.size()).toBe(0);
    });
  });
});

