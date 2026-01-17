/**
 * Ollama local model adapter
 * Connects to Ollama running locally on port 11434
 */

import type {
  ModelAdapter,
  Prompt,
  GenOptions,
  LLMOutput,
  Embedding,
  ModelCapabilities,
} from "./types.js";

export interface OllamaAdapterConfig {
  model?: string;
  baseUrl?: string;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

export class OllamaAdapter implements ModelAdapter {
  private model: string;
  private baseUrl: string;

  constructor(config: OllamaAdapterConfig = {}) {
    this.model = config.model || "qwen2.5:1.5b";
    this.baseUrl = config.baseUrl || "http://localhost:11434";
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    const messages: OllamaMessage[] = prompt.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const requestBody: OllamaChatRequest = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 2048,
        stop: options.stopSequences,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;

      return {
        text: data.message.content,
        finishReason: "stop",
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        metadata: {
          model: this.model,
          totalDuration: data.total_duration,
        },
      };
    } catch (error) {
      if ((error as Error).message.includes("ECONNREFUSED")) {
        throw new Error(
          "Ollama not running. Start it with: ollama serve\n" +
          "Or install from: https://ollama.com/download"
        );
      }
      throw error;
    }
  }

  async embed(text: string): Promise<Embedding> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embedding error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OllamaEmbedResponse;

      return {
        vector: data.embedding,
        model: this.model,
      };
    } catch (error) {
      if ((error as Error).message.includes("ECONNREFUSED")) {
        throw new Error("Ollama not running. Start it with: ollama serve");
      }
      throw error;
    }
  }

  getCapabilities(): ModelCapabilities {
    return {
      maxContextLength: 32768,
      supportsStreaming: true,
      supportsEmbedding: true,
      costPerToken: 0, // Free!
    };
  }

  /**
   * Check if Ollama is running and model is available
   */
  async checkHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return { ok: false, error: "Ollama not responding" };
      }

      const data = (await response.json()) as { models: { name: string }[] };
      const modelExists = data.models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model.split(":")[0])
      );

      if (!modelExists) {
        return {
          ok: false,
          error: `Model '${this.model}' not found. Run: ollama pull ${this.model}`,
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: "Ollama not running. Start with: ollama serve",
      };
    }
  }
}

