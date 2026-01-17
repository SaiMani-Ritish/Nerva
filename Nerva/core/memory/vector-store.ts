/**
 * Vector store for long-term memory with semantic search
 */

import type { MemoryEntry, VectorSearchResult } from "./types.js";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export class VectorStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private embeddingProvider?: EmbeddingProvider;

  /**
   * Set the embedding provider for semantic search
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /**
   * Store an entry with embedding
   */
  async store(entry: MemoryEntry): Promise<void> {
    // Generate embedding if provider is available
    if (this.embeddingProvider && !entry.embedding) {
      try {
        entry.embedding = await this.embeddingProvider.embed(entry.content);
      } catch (error) {
        console.warn("Failed to generate embedding:", error);
      }
    }
    
    this.entries.set(entry.id, entry);
  }

  /**
   * Store multiple entries
   */
  async storeMany(entries: MemoryEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.store(entry);
    }
  }

  /**
   * Search for similar entries using semantic similarity
   */
  async search(
    query: string,
    limit: number = 10,
    threadId?: string
  ): Promise<VectorSearchResult[]> {
    let queryEmbedding: number[] | undefined;

    // Generate query embedding
    if (this.embeddingProvider) {
      try {
        queryEmbedding = await this.embeddingProvider.embed(query);
      } catch (error) {
        console.warn("Failed to generate query embedding:", error);
      }
    }

    // Get candidate entries
    let candidates = Array.from(this.entries.values());
    
    // Filter by thread if specified
    if (threadId) {
      candidates = candidates.filter((e) => e.threadId === threadId);
    }

    // Calculate similarities
    const results: VectorSearchResult[] = candidates.map((entry) => {
      let similarity = 0;

      if (queryEmbedding && entry.embedding) {
        similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      } else {
        // Fallback to keyword matching
        similarity = this.keywordSimilarity(query, entry.content);
      }

      return { entry, similarity };
    });

    // Sort by similarity (descending) and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Search by keyword (fallback when embeddings unavailable)
   */
  searchByKeyword(
    keywords: string[],
    limit: number = 10,
    threadId?: string
  ): MemoryEntry[] {
    let candidates = Array.from(this.entries.values());

    if (threadId) {
      candidates = candidates.filter((e) => e.threadId === threadId);
    }

    // Score by keyword matches
    const scored = candidates.map((entry) => {
      const content = entry.content.toLowerCase();
      const score = keywords.reduce((sum, kw) => {
        return sum + (content.includes(kw.toLowerCase()) ? 1 : 0);
      }, 0);
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  /**
   * Get entry by ID
   */
  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Update an existing entry
   */
  async update(id: string, updates: Partial<MemoryEntry>): Promise<boolean> {
    const existing = this.entries.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    
    // Regenerate embedding if content changed
    if (updates.content && this.embeddingProvider) {
      try {
        updated.embedding = await this.embeddingProvider.embed(updated.content);
      } catch (error) {
        console.warn("Failed to update embedding:", error);
      }
    }

    this.entries.set(id, updated);
    return true;
  }

  /**
   * Delete entry by ID
   */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Delete all entries for a thread
   */
  deleteThread(threadId: string): number {
    let deleted = 0;
    for (const [id, entry] of this.entries) {
      if (entry.threadId === threadId) {
        this.entries.delete(id);
        deleted++;
      }
    }
    return deleted;
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
   * Get total entry count
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Get all thread IDs
   */
  getThreadIds(): string[] {
    const threads = new Set<string>();
    for (const entry of this.entries.values()) {
      threads.add(entry.threadId);
    }
    return Array.from(threads);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Export all entries (for persistence)
   */
  export(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import entries (from persistence)
   */
  import(entries: MemoryEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
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

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Simple keyword-based similarity (fallback)
   */
  private keywordSimilarity(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) {
        matches++;
      }
    }

    return queryWords.size > 0 ? matches / queryWords.size : 0;
  }
}

