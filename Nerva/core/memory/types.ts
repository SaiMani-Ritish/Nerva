/**
 * Memory system types
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface MemoryEntry {
  id: string;
  threadId: string;
  timestamp: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export interface MemoryConfig {
  tokenBudget: number;
  vectorStoreEnabled: boolean;
  summaryThreshold: number; // Summarize when context exceeds this ratio
}

