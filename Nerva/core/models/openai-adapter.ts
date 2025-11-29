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

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stop?: string[];
}

interface OpenAIChatResponse {
  id: string;
  choices: {
    message: { role: string; content: string };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIAdapter implements ModelAdapter {
  private model: string;
  private endpoint: string;
  private apiKey: string;

  constructor(private config: OpenAIAdapterConfig) {
    this.model = config.model || "gpt-4";
    this.endpoint = config.endpoint || "https://api.openai.com/v1";
    this.apiKey = config.apiKey;
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    const requestBody: OpenAIChatRequest = {
      model: this.model,
      messages: prompt.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: false, // For now, no streaming
      stop: options.stopSequences,
    };

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;

    const choice = data.choices[0];
    const finishReason =
      choice.finish_reason === "stop"
        ? "stop"
        : choice.finish_reason === "length"
          ? "length"
          : "error";

    return {
      text: choice.message.content,
      finishReason,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      metadata: {
        model: this.model,
        id: data.id,
      },
    };
  }

  async embed(text: string): Promise<Embedding> {
    const response = await fetch(`${this.endpoint}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;

    return {
      vector: data.data[0].embedding,
      model: data.model,
    };
  }

  getCapabilities(): ModelCapabilities {
    const capabilities: Record<string, ModelCapabilities> = {
      "gpt-4": {
        maxContextLength: 128000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.00003,
      },
      "gpt-4-turbo-preview": {
        maxContextLength: 128000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.00003,
      },
      "gpt-3.5-turbo": {
        maxContextLength: 16384,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.000002,
      },
    };

    return capabilities[this.model] || capabilities["gpt-4"];
  }
}

