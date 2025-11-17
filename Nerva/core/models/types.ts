/**
 * Model adapter types
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Prompt {
  messages: Message[];
}

export interface GenOptions {
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  stopSequences?: string[];
}

export interface LLMOutput {
  text: string;
  finishReason: "stop" | "length" | "error";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface Embedding {
  vector: number[];
  model: string;
}

export interface ModelCapabilities {
  maxContextLength: number;
  supportsStreaming: boolean;
  supportsEmbedding: boolean;
  costPerToken?: number;
}

export interface ModelAdapter {
  generate(prompt: Prompt, options?: GenOptions): Promise<LLMOutput>;
  embed(text: string): Promise<Embedding>;
  getCapabilities(): ModelCapabilities;
}

export interface ModelConfig {
  name: string;
  type: "local" | "cloud";
  provider?: string;
  modelPath?: string;
  apiKey?: string;
  endpoint?: string;
}

