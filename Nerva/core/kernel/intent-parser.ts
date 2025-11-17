/**
 * Intent parser - converts natural language to structured intent
 */

import type { Intent } from "./types";

export class IntentParser {
  /**
   * Parse natural language input into structured intent
   */
  parse(input: string): Intent {
    // TODO(cursor): Implement intent parsing using LLM
    // Use system prompt from docs/prompts/system.md
    // Extract: action, target, parameters, complexity

    // Placeholder implementation with basic complexity detection
    const complexity = this.classifyComplexity(input);
    const confidence = input.length > 0 ? 0.5 : 0.1;

    return {
      action: "unknown",
      target: undefined,
      parameters: {},
      complexity,
      confidence,
      needsClarification: false,
    };
  }

  /**
   * Classify intent complexity
   */
  private classifyComplexity(input: string): "simple" | "complex" {
    // TODO(cursor): Detect multi-step or complex intents
    // Simple: single action, clear target
    // Complex: multiple steps, dependencies, planning needed

    // Heuristic: check for keywords like "and", "then", "after"
    const complexKeywords = ["and then", "after that", "first", "finally"];
    const hasComplexKeyword = complexKeywords.some((kw) =>
      input.toLowerCase().includes(kw)
    );

    return hasComplexKeyword ? "complex" : "simple";
  }
}

