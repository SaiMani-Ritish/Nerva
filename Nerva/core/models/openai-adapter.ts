/**
 * OpenAI model adapter
 */

import type {
  ModelAdapter,
  Prompt,
  GenOptions,
  LLMOutput,
  Embedding,
  ModelCapabilities,
} from "./types";

export interface OpenAIAdapterConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export class OpenAIAdapter implements ModelAdapter {
  private model: string;
  private endpoint: string;

  constructor(private config: OpenAIAdapterConfig) {
    this.model = config.model || "gpt-4";
    this.endpoint = config.endpoint || "https://api.openai.com/v1";
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    // TODO(cursor): Implement OpenAI API call
    // Use fetch or openai npm package
    // Steps:
    // 1. Build request body
    // 2. Call /v1/chat/completions
    // 3. Parse response
    // 4. Return LLMOutput

    throw new Error("Not implemented");
  }

  async embed(text: string): Promise<Embedding> {
    // TODO(cursor): Implement embedding via OpenAI
    // Use /v1/embeddings endpoint
    throw new Error("Not implemented");
  }

  getCapabilities(): ModelCapabilities {
    const capabilities: Record<string, ModelCapabilities> = {
      "gpt-4": {
        maxContextLength: 128000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.00003, // $0.03 per 1K tokens
      },
      "gpt-3.5-turbo": {
        maxContextLength: 16384,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.000002, // $0.002 per 1K tokens
      },
    };

    return capabilities[this.model] || capabilities["gpt-4"];
  }
}

