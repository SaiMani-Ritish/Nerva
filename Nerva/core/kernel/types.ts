/**
 * Core types for the Nerva kernel
 */

export interface Intent {
  action: string;
  target?: string;
  parameters: Record<string, unknown>;
  complexity: "simple" | "complex";
  confidence: number;
  needsClarification: boolean;
  clarificationQuestions?: string[];
}

export interface Context {
  threadId: string;
  userId: string;
  history: Message[];
  metadata: Record<string, unknown>;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ToolCall {
  tool: string;
  inputs: Record<string, unknown>;
}

export interface Response {
  type: "success" | "error" | "clarification";
  content: string;
  metadata: {
    duration_ms: number;
    tokens_used?: number;
    cost?: number;
  };
}

export interface KernelConfig {
  modelAdapter: string;
  toolsEnabled: string[];
  agentsEnabled: string[];
  memoryConfig: MemoryConfig;
}

export interface MemoryConfig {
  tokenBudget: number;
  vectorStoreEnabled: boolean;
}

