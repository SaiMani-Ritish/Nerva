/**
 * Local model adapter using llama.cpp
 */

import type {
  ModelAdapter,
  Prompt,
  GenOptions,
  LLMOutput,
  Embedding,
  ModelCapabilities,
} from "./types";

export interface LocalAdapterConfig {
  modelPath: string;
  contextSize?: number;
  threads?: number;
}

export class LocalAdapter implements ModelAdapter {
  constructor(private config: LocalAdapterConfig) {
    // TODO(cursor): Initialize llama.cpp bindings
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    // TODO(cursor): Implement local model generation
    // Use llama.cpp bindings (node-llama-cpp or similar)
    // Steps:
    // 1. Format messages into prompt text
    // 2. Call llama.cpp with options
    // 3. Parse response
    // 4. Return LLMOutput

    throw new Error("Not implemented");
  }

  async embed(text: string): Promise<Embedding> {
    // TODO(cursor): Implement embedding generation
    // Use llama.cpp embedding model
    throw new Error("Not implemented");
  }

  getCapabilities(): ModelCapabilities {
    return {
      maxContextLength: this.config.contextSize || 8192,
      supportsStreaming: true,
      supportsEmbedding: true,
      costPerToken: 0, // Free for local
    };
  }

  /**
   * Format messages into prompt text
   */
  private formatPrompt(prompt: Prompt): string {
    // TODO(cursor): Format for specific model
    // Different models have different prompt formats (ChatML, Llama2, etc.)
    return prompt.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }
}

