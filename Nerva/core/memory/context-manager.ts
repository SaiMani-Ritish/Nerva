/**
 * Context window manager with token budget enforcement
 */

import type { Message, MemoryConfig } from "./types";

export class ContextManager {
  private messages: Message[] = [];
  private currentTokens: number = 0;

  constructor(private config: MemoryConfig) {}

  /**
   * Add a message to the context
   */
  async addMessage(message: Message): Promise<void> {
    const tokens = this.estimateTokens(message.content);
    message.tokens = tokens;

    this.messages.push(message);
    this.currentTokens += tokens;

    // Check if we need to summarize
    if (
      this.currentTokens >
      this.config.tokenBudget * this.config.summaryThreshold
    ) {
      await this.prune();
    }
  }

  /**
   * Get current context messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.currentTokens;
  }

  /**
   * Prune old messages and summarize
   */
  private async prune(): Promise<void> {
    // TODO(cursor): Implement pruning strategy
    // Keep system message and recent messages
    // Summarize the middle portion
    // See: docs/architecture.md#memory-management

    // Keep first (system) and last 10 messages
    const systemMsg = this.messages[0];
    const recentMsgs = this.messages.slice(-10);
    const toSummarize = this.messages.slice(1, -10);

    // TODO(cursor): Call summarizer agent
    // For now, just keep recent messages
    this.messages = [systemMsg, ...recentMsgs];

    // Recalculate tokens
    this.currentTokens = this.messages.reduce(
      (sum, msg) => sum + (msg.tokens || 0),
      0
    );
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
    this.currentTokens = 0;
  }
}

