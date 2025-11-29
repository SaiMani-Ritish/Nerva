/**
 * Local model adapter using llama.cpp
 * 
 * For MVP, this provides a mock implementation.
 * Real llama.cpp integration requires node-llama-cpp or similar native bindings.
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
  gpuLayers?: number;
}

export class LocalAdapter implements ModelAdapter {
  private contextSize: number;
  private modelLoaded: boolean = false;

  constructor(private config: LocalAdapterConfig) {
    this.contextSize = config.contextSize || 8192;
    // In real implementation, would load the model here
    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    // TODO: Replace with actual llama.cpp initialization
    // const { LlamaModel, LlamaContext } = await import('node-llama-cpp');
    // this.model = new LlamaModel({ modelPath: this.config.modelPath });
    // this.context = new LlamaContext({ model: this.model });
    
    // For MVP, just mark as loaded
    this.modelLoaded = true;
  }

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    if (!this.modelLoaded) {
      throw new Error("Model not loaded");
    }

    const formattedPrompt = this.formatPrompt(prompt);
    
    // TODO: Replace with actual llama.cpp generation
    // const session = new LlamaChatSession({ context: this.context });
    // const response = await session.prompt(formattedPrompt, {
    //   maxTokens: options.maxTokens || 2048,
    //   temperature: options.temperature || 0.7,
    // });

    // For MVP, return a mock response indicating local model
    // In production, this would call the actual llama.cpp bindings
    const mockResponse = `[Local Model Response]\n\nThis is a placeholder response from the local model adapter.\nPrompt received: "${formattedPrompt.substring(0, 100)}..."\n\nTo enable real local inference:\n1. Install node-llama-cpp\n2. Download a GGUF model\n3. Update this adapter with real bindings`;

    const estimatedTokens = Math.ceil(formattedPrompt.length / 4);
    const responseTokens = Math.ceil(mockResponse.length / 4);

    return {
      text: mockResponse,
      finishReason: "stop",
      usage: {
        promptTokens: estimatedTokens,
        completionTokens: responseTokens,
        totalTokens: estimatedTokens + responseTokens,
      },
      metadata: {
        model: "local",
        modelPath: this.config.modelPath,
        isMock: true,
      },
    };
  }

  async embed(text: string): Promise<Embedding> {
    if (!this.modelLoaded) {
      throw new Error("Model not loaded");
    }

    // TODO: Replace with actual embedding generation
    // const embedding = await this.model.embed(text);
    
    // For MVP, generate a simple hash-based mock embedding
    // This is NOT suitable for real semantic search
    const mockEmbedding = this.generateMockEmbedding(text, 384);

    return {
      vector: mockEmbedding,
      model: "local-embedding",
    };
  }

  getCapabilities(): ModelCapabilities {
    return {
      maxContextLength: this.contextSize,
      supportsStreaming: true,
      supportsEmbedding: true,
      costPerToken: 0, // Free for local
    };
  }

  /**
   * Format messages into prompt text using ChatML format
   */
  private formatPrompt(prompt: Prompt): string {
    // ChatML format (used by many models)
    return prompt.messages
      .map((m) => {
        switch (m.role) {
          case "system":
            return `<|im_start|>system\n${m.content}<|im_end|>`;
          case "user":
            return `<|im_start|>user\n${m.content}<|im_end|>`;
          case "assistant":
            return `<|im_start|>assistant\n${m.content}<|im_end|>`;
          default:
            return m.content;
        }
      })
      .join("\n") + "\n<|im_start|>assistant\n";
  }

  /**
   * Generate a mock embedding (for MVP only)
   * NOT suitable for real semantic search
   */
  private generateMockEmbedding(text: string, dimensions: number): number[] {
    const embedding: number[] = [];
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }

    for (let i = 0; i < dimensions; i++) {
      // Generate deterministic pseudo-random values based on text hash
      const seed = hash + i * 31;
      embedding.push(Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.5);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / magnitude);
  }
}

