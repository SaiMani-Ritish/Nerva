/**
 * Vector store for long-term memory with semantic search
 */

import type { MemoryEntry, VectorSearchResult } from "./types";

export class VectorStore {
  private entries: Map<string, MemoryEntry> = new Map();

  /**
   * Store an entry with embedding
   */
  async store(entry: MemoryEntry): Promise<void> {
    // TODO(cursor): Generate embedding using model adapter
    // For now, store without embedding
    this.entries.set(entry.id, entry);
  }

  /**
   * Search for similar entries
   */
  async search(
    query: string,
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    // TODO(cursor): Implement semantic search
    // 1. Generate query embedding
    // 2. Compute cosine similarity with stored embeddings
    // 3. Return top-k results

    // Placeholder: return all entries
    return Array.from(this.entries.values())
      .map((entry) => ({
        entry,
        similarity: 0.5,
      }))
      .slice(0, limit);
  }

  /**
   * Get entry by ID
   */
  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Delete entry by ID
   */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Get all entries for a thread
   */
  getByThread(threadId: string): MemoryEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.threadId === threadId
    );
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

