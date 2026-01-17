/**
 * Unified Memory Manager
 * Coordinates context, vector store, and logging
 */

import { ContextManager, SummaryCallback } from "./context-manager.js";
import { VectorStore, EmbeddingProvider } from "./vector-store.js";
import { ConversationLogger } from "./logger.js";
import type { Message, MemoryEntry, MemoryConfig, VectorSearchResult } from "./types.js";

export interface MemoryManagerConfig extends MemoryConfig {
  loggerBasePath?: string;
  logFormat?: "json" | "markdown";
}

export class MemoryManager {
  private contexts: Map<string, ContextManager> = new Map();
  private vectorStore: VectorStore;
  private logger: ConversationLogger;
  private config: MemoryManagerConfig;
  private summaryCallback?: SummaryCallback;
  private embeddingProvider?: EmbeddingProvider;

  constructor(config: MemoryManagerConfig) {
    this.config = config;
    this.vectorStore = new VectorStore();
    this.logger = new ConversationLogger({
      basePath: config.loggerBasePath,
      format: config.logFormat,
    });
  }

  /**
   * Set the summarizer callback for context compression
   */
  setSummarizer(callback: SummaryCallback): void {
    this.summaryCallback = callback;
    // Apply to all existing contexts
    for (const context of this.contexts.values()) {
      context.setSummarizer(callback);
    }
  }

  /**
   * Set the embedding provider for semantic search
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
    this.vectorStore.setEmbeddingProvider(provider);
  }

  /**
   * Get or create a context for a thread
   */
  getContext(threadId: string): ContextManager {
    let context = this.contexts.get(threadId);
    if (!context) {
      context = new ContextManager(this.config);
      if (this.summaryCallback) {
        context.setSummarizer(this.summaryCallback);
      }
      this.contexts.set(threadId, context);
      this.logger.start(threadId);
    }
    return context;
  }

  /**
   * Add a message to a thread's context and log it
   */
  async addMessage(threadId: string, message: Message): Promise<void> {
    const context = this.getContext(threadId);
    await context.addMessage(message);
    this.logger.log(threadId, message);
  }

  /**
   * Add a user message
   */
  async addUserMessage(threadId: string, content: string): Promise<void> {
    await this.addMessage(threadId, {
      role: "user",
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Add an assistant message
   */
  async addAssistantMessage(threadId: string, content: string): Promise<void> {
    await this.addMessage(threadId, {
      role: "assistant",
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Get messages for LLM prompt
   */
  getPromptMessages(threadId: string): { role: string; content: string }[] {
    const context = this.getContext(threadId);
    return context.getPromptMessages();
  }

  /**
   * Store a memory entry for long-term retrieval
   */
  async storeMemory(entry: Omit<MemoryEntry, "id">): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const fullEntry: MemoryEntry = { ...entry, id };
    await this.vectorStore.store(fullEntry);
    return id;
  }

  /**
   * Search long-term memory
   */
  async searchMemory(
    query: string,
    limit?: number,
    threadId?: string
  ): Promise<VectorSearchResult[]> {
    return this.vectorStore.search(query, limit, threadId);
  }

  /**
   * Get relevant context from long-term memory
   */
  async getRelevantMemories(
    query: string,
    threadId?: string,
    limit: number = 5
  ): Promise<string[]> {
    const results = await this.searchMemory(query, limit, threadId);
    return results
      .filter((r) => r.similarity > 0.5)
      .map((r) => r.entry.content);
  }

  /**
   * End a conversation thread
   */
  async endThread(threadId: string, save: boolean = true): Promise<string | null> {
    this.logger.end(threadId);
    
    let savedPath: string | null = null;
    if (save) {
      try {
        savedPath = await this.logger.save(threadId);
      } catch (error) {
        console.warn("Failed to save transcript:", error);
      }
    }

    // Optionally store final context in long-term memory
    const context = this.contexts.get(threadId);
    if (context && this.config.vectorStoreEnabled) {
      const messages = context.getMessages();
      if (messages.length > 0) {
        const summary = messages
          .filter((m) => m.role !== "system")
          .map((m) => `${m.role}: ${m.content.substring(0, 200)}`)
          .join("\n");

        await this.storeMemory({
          threadId,
          timestamp: Date.now(),
          content: summary,
          metadata: {
            messageCount: messages.length,
            type: "conversation_summary",
          },
        });
      }
    }

    return savedPath;
  }

  /**
   * Clear a thread's context (but keep logs)
   */
  clearContext(threadId: string): void {
    const context = this.contexts.get(threadId);
    if (context) {
      context.clear();
    }
  }

  /**
   * Delete a thread entirely
   */
  deleteThread(threadId: string): void {
    this.contexts.delete(threadId);
    this.logger.remove(threadId);
    this.vectorStore.deleteThread(threadId);
  }

  /**
   * Get thread statistics
   */
  getThreadStats(threadId: string): {
    contextTokens: number;
    remainingBudget: number;
    messageCount: number;
    memoryEntries: number;
  } {
    const context = this.contexts.get(threadId);
    const transcript = this.logger.get(threadId);
    const memories = this.vectorStore.getByThread(threadId);

    return {
      contextTokens: context?.getTokenCount() || 0,
      remainingBudget: context?.getRemainingBudget() || this.config.tokenBudget,
      messageCount: transcript?.messages.length || 0,
      memoryEntries: memories.length,
    };
  }

  /**
   * Get all active thread IDs
   */
  getActiveThreads(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Export all data for persistence
   */
  export(): {
    memories: MemoryEntry[];
    transcripts: string[];
  } {
    return {
      memories: this.vectorStore.export(),
      transcripts: this.logger.getActiveThreads(),
    };
  }

  /**
   * Import memories from persistence
   */
  importMemories(entries: MemoryEntry[]): void {
    this.vectorStore.import(entries);
  }
}

