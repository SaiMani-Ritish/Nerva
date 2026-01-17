/**
 * Google Gemini model adapter
 */

import type {
  ModelAdapter,
  Prompt,
  GenOptions,
  LLMOutput,
  Embedding,
  ModelCapabilities,
} from "./types.js";

export interface GeminiAdapterConfig {
  apiKey: string;
  model?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    stopSequences?: string[];
  };
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
      role: string;
    };
    finishReason: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiAdapter implements ModelAdapter {
  private model: string;
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(private config: GeminiAdapterConfig) {
    this.model = config.model || "gemini-1.5-flash";
    this.apiKey = config.apiKey;
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    // Convert messages to Gemini format
    const contents: GeminiContent[] = [];
    
    for (const msg of prompt.messages) {
      if (msg.role === "system") {
        // Gemini doesn't have system role, prepend to first user message
        contents.push({
          role: "user",
          parts: [{ text: `Instructions: ${msg.content}\n\n` }],
        });
        contents.push({
          role: "model",
          parts: [{ text: "Understood. I will follow these instructions." }],
        });
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    const requestBody: GeminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7,
        stopSequences: options.stopSequences,
      },
    };

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no candidates");
    }

    const candidate = data.candidates[0];
    const text = candidate.content.parts.map((p) => p.text).join("");

    const finishReason =
      candidate.finishReason === "STOP"
        ? "stop"
        : candidate.finishReason === "MAX_TOKENS"
          ? "length"
          : "error";

    return {
      text,
      finishReason,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      metadata: {
        model: this.model,
      },
    };
  }

  async embed(text: string): Promise<Embedding> {
    const url = `${this.baseUrl}/models/text-embedding-004:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { embedding: { values: number[] } };

    return {
      vector: data.embedding.values,
      model: "text-embedding-004",
    };
  }

  getCapabilities(): ModelCapabilities {
    const capabilities: Record<string, ModelCapabilities> = {
      "gemini-1.5-flash": {
        maxContextLength: 1000000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0, // Free tier
      },
      "gemini-1.5-pro": {
        maxContextLength: 2000000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.00000125,
      },
      "gemini-2.0-flash": {
        maxContextLength: 1000000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0,
      },
    };

    return capabilities[this.model] || capabilities["gemini-1.5-flash"];
  }
}

