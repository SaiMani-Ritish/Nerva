/**
 * Context window manager with token budget enforcement
 */

import type { Message, MemoryConfig } from "./types";

export interface SummaryCallback {
  (messages: Message[]): Promise<string>;
}

export class ContextManager {
  private messages: Message[] = [];
  private currentTokens: number = 0;
  private summaryCallback?: SummaryCallback;

  constructor(private config: MemoryConfig) {}

  /**
   * Set the summarizer callback for context compression
   */
  setSummarizer(callback: SummaryCallback): void {
    this.summaryCallback = callback;
  }

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
   * Add multiple messages at once
   */
  async addMessages(messages: Message[]): Promise<void> {
    for (const msg of messages) {
      await this.addMessage(msg);
    }
  }

  /**
   * Get current context messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get messages formatted for LLM prompt
   */
  getPromptMessages(): { role: string; content: string }[] {
    return this.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.currentTokens;
  }

  /**
   * Get remaining token budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.config.tokenBudget - this.currentTokens);
  }

  /**
   * Check if context is near capacity
   */
  isNearCapacity(): boolean {
    return this.currentTokens > this.config.tokenBudget * 0.8;
  }

  /**
   * Prune old messages and summarize
   */
  private async prune(): Promise<void> {
    if (this.messages.length <= 3) {
      // Too few messages to prune
      return;
    }

    // Keep first (system) message if exists
    const systemMsg = this.messages[0]?.role === "system" ? this.messages[0] : null;
    const startIdx = systemMsg ? 1 : 0;

    // Keep last N messages (recent context)
    const keepRecent = Math.min(10, Math.floor(this.messages.length / 2));
    const recentMsgs = this.messages.slice(-keepRecent);

    // Messages to summarize
    const toSummarize = this.messages.slice(startIdx, -keepRecent);

    if (toSummarize.length === 0) {
      return;
    }

    let summaryMessage: Message | null = null;

    if (this.summaryCallback) {
      try {
        const summaryText = await this.summaryCallback(toSummarize);
        summaryMessage = {
          role: "system",
          content: `[Previous conversation summary]\n${summaryText}`,
          timestamp: Date.now(),
          tokens: this.estimateTokens(summaryText),
        };
      } catch (error) {
        console.warn("Summarization failed, using simple truncation:", error);
      }
    }

    // Rebuild messages array
    this.messages = [];
    if (systemMsg) {
      this.messages.push(systemMsg);
    }
    if (summaryMessage) {
      this.messages.push(summaryMessage);
    }
    this.messages.push(...recentMsgs);

    // Recalculate tokens
    this.currentTokens = this.messages.reduce(
      (sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)),
      0
    );
  }

  /**
   * Force summarization of current context
   */
  async forceSummarize(): Promise<void> {
    await this.prune();
  }

  /**
   * Estimate token count for text
   * Uses a more accurate approximation based on GPT tokenization patterns
   */
  private estimateTokens(text: string): number {
    // More accurate estimation:
    // - Average English word is ~1.3 tokens
    // - Special characters and punctuation add tokens
    // - Code tends to have more tokens per character
    
    const words = text.split(/\s+/).length;
    const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
    
    // Base estimate from words
    let tokens = Math.ceil(words * 1.3);
    
    // Add for special characters
    tokens += Math.ceil(specialChars * 0.5);
    
    // Minimum of length/4 as fallback
    return Math.max(tokens, Math.ceil(text.length / 4));
  }

  /**
   * Get the last N messages
   */
  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count);
  }

  /**
   * Remove the last message (for error recovery)
   */
  popMessage(): Message | undefined {
    const msg = this.messages.pop();
    if (msg) {
      this.currentTokens -= msg.tokens || 0;
    }
    return msg;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
    this.currentTokens = 0;
  }

  /**
   * Set system message (replaces existing if present)
   */
  setSystemMessage(content: string): void {
    const systemMsg: Message = {
      role: "system",
      content,
      timestamp: Date.now(),
      tokens: this.estimateTokens(content),
    };

    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.currentTokens -= this.messages[0].tokens || 0;
      this.messages[0] = systemMsg;
    } else {
      this.messages.unshift(systemMsg);
    }
    this.currentTokens += systemMsg.tokens!;
  }
}

