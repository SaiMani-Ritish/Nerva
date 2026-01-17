/**
 * Fallback adapter - tries local first, then cloud
 */

import type {
  ModelAdapter,
  Prompt,
  GenOptions,
  LLMOutput,
  Embedding,
  ModelCapabilities,
} from "./types.js";

export class FallbackAdapter implements ModelAdapter {
  constructor(
    private localAdapter: ModelAdapter,
    private cloudAdapter: ModelAdapter,
    private localTimeout: number = 5000
  ) {}

  async generate(prompt: Prompt, options: GenOptions = {}): Promise<LLMOutput> {
    // Try local first
    try {
      const result = await Promise.race([
        this.localAdapter.generate(prompt, options),
        this.timeout(this.localTimeout),
      ]);

      if (result && this.isGoodQuality(result)) {
        return result;
      }
    } catch (error) {
      console.log("Local model failed, falling back to cloud:", error);
    }

    // Fallback to cloud
    return await this.cloudAdapter.generate(prompt, options);
  }

  async embed(text: string): Promise<Embedding> {
    // Try local first, fallback to cloud
    try {
      return await this.localAdapter.embed(text);
    } catch {
      return await this.cloudAdapter.embed(text);
    }
  }

  getCapabilities(): ModelCapabilities {
    // Return cloud capabilities (more capable)
    return this.cloudAdapter.getCapabilities();
  }

  /**
   * Check if output quality is acceptable
   */
  private isGoodQuality(output: LLMOutput): boolean {
    // TODO(cursor): Implement quality check
    // Could check:
    // - Finish reason is "stop"
    // - Output length is reasonable
    // - No obvious errors
    return output.finishReason === "stop";
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    );
  }
}

