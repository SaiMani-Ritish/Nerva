/**
 * Intent parser - converts natural language to structured intent
 */

import type { Intent } from "./types.js";
import type { ModelAdapter, Prompt } from "../models/types.js";

export interface IntentParserConfig {
  confidenceThreshold?: number;
  availableTools?: string[];
}

const INTENT_SYSTEM_PROMPT = `You are an intent parser for Nerva OS. Your role is to analyze user input and extract structured intent.

## Output Format

Return a valid JSON object:

{
  "action": string,           // The primary action (e.g., "read", "write", "search", "fetch", "run")
  "target": string | null,    // The target of the action (e.g., file path, URL, command)
  "parameters": object,       // Additional parameters for the action
  "complexity": "simple" | "complex",  // Whether this needs planning
  "confidence": number,       // 0-1 confidence in the interpretation
  "needsClarification": boolean,
  "clarificationQuestions": string[]   // Questions if clarification needed
}

## Classification Rules

### Simple (Direct Execution)
- Single, clear action
- Explicit target
- No dependencies between steps
- Examples: "read file.txt", "list files in /home", "fetch https://api.com"

### Complex (Needs Planning)
- Multiple steps required
- Dependencies between actions
- Vague or high-level goals
- Keywords: "and then", "after", "first...then", "research", "analyze", "create project"
- Examples: "research transformers and summarize", "refactor all JS files to TypeScript"

### Needs Clarification
- Ambiguous target
- Missing required information
- Multiple interpretations possible
- confidence < 0.6

## Action Mapping

Common actions to extract:
- read, write, list, search, create, delete, copy, move (file operations)
- fetch, download, request, get, post (web operations)
- run, execute, command (process operations)
- summarize, explain, analyze (LLM operations)
- plan, research, build (complex multi-step operations)`;

export class IntentParser {
  private modelAdapter?: ModelAdapter;
  private config: IntentParserConfig;

  constructor(config?: IntentParserConfig, modelAdapter?: ModelAdapter) {
    this.config = {
      confidenceThreshold: config?.confidenceThreshold ?? 0.6,
      availableTools: config?.availableTools ?? [],
    };
    this.modelAdapter = modelAdapter;
  }

  /**
   * Set the model adapter for LLM-based parsing
   */
  setModelAdapter(adapter: ModelAdapter): void {
    this.modelAdapter = adapter;
  }

  /**
   * Parse natural language input into structured intent
   */
  async parse(input: string): Promise<Intent> {
    // If no model adapter, use heuristic parsing
    if (!this.modelAdapter) {
      return this.parseHeuristic(input);
    }

    try {
      return await this.parseLLM(input);
    } catch (error) {
      // Fallback to heuristic on LLM failure
      console.warn("LLM parsing failed, using heuristic:", error);
      return this.parseHeuristic(input);
    }
  }

  /**
   * Parse using LLM
   */
  private async parseLLM(input: string): Promise<Intent> {
    const prompt = this.buildPrompt(input);

    const response = await this.modelAdapter!.generate(prompt, {
      maxTokens: 500,
      temperature: 0.1, // Low temperature for structured output
    });

    return this.parseResponse(response.text, input);
  }

  /**
   * Build the LLM prompt
   */
  private buildPrompt(input: string): Prompt {
    let userMessage = `Parse this user input:\n\n"${input}"`;

    if (this.config.availableTools && this.config.availableTools.length > 0) {
      userMessage += `\n\nAvailable tools: ${this.config.availableTools.join(", ")}`;
    }

    return {
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    };
  }

  /**
   * Parse LLM response into Intent
   */
  private parseResponse(text: string, originalInput: string): Intent {
    // Extract JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      const intent: Intent = {
        action: parsed.action || "unknown",
        target: parsed.target || undefined,
        parameters: parsed.parameters || {},
        complexity: parsed.complexity || "simple",
        confidence: parsed.confidence ?? 0.5,
        needsClarification:
          parsed.needsClarification ||
          parsed.confidence < this.config.confidenceThreshold!,
        clarificationQuestions: parsed.clarificationQuestions || [],
      };

      // Validate confidence threshold
      if (intent.confidence < this.config.confidenceThreshold!) {
        intent.needsClarification = true;
        if (intent.clarificationQuestions!.length === 0) {
          intent.clarificationQuestions = [
            "Could you be more specific about what you want to do?",
          ];
        }
      }

      return intent;
    } catch {
      // If JSON parsing fails, return heuristic result
      return this.parseHeuristic(originalInput);
    }
  }

  /**
   * Heuristic-based parsing (fallback when LLM unavailable)
   */
  parseHeuristic(input: string): Intent {
    const normalized = input.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    // Extract action from first verb-like word
    const action = this.extractAction(words);

    // Extract target (file path, URL, etc.)
    const target = this.extractTarget(input);

    // Classify complexity
    const complexity = this.classifyComplexity(normalized);

    // Extract parameters
    const parameters = this.extractParameters(input);

    // Calculate confidence
    const confidence = this.calculateConfidence(action, target, normalized);

    // Determine if clarification needed
    const needsClarification = confidence < this.config.confidenceThreshold!;

    return {
      action,
      target,
      parameters,
      complexity,
      confidence,
      needsClarification,
      clarificationQuestions: needsClarification
        ? this.generateClarificationQuestions(action, target)
        : [],
    };
  }

  /**
   * Extract action from input words
   */
  private extractAction(words: string[]): string {
    const actionVerbs = [
      "read",
      "write",
      "create",
      "delete",
      "list",
      "search",
      "find",
      "copy",
      "move",
      "fetch",
      "download",
      "get",
      "post",
      "run",
      "execute",
      "summarize",
      "explain",
      "analyze",
      "plan",
      "research",
      "build",
      "open",
      "show",
      "display",
    ];

    for (const word of words) {
      if (actionVerbs.includes(word)) {
        return word;
      }
    }

    // Check for common patterns
    if (words.includes("what") || words.includes("how")) {
      return "explain";
    }
    if (words.includes("make") || words.includes("generate")) {
      return "create";
    }

    return "unknown";
  }

  /**
   * Extract target from input
   */
  private extractTarget(input: string): string | undefined {
    // Match file paths
    const pathMatch = input.match(
      /(?:^|\s)((?:\.{0,2}\/)?[\w\-./]+\.\w+)(?:\s|$)/
    );
    if (pathMatch) {
      return pathMatch[1];
    }

    // Match URLs
    const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Match quoted strings
    const quotedMatch = input.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    // Match directory paths
    const dirMatch = input.match(/(?:^|\s)((?:\.{0,2}\/)?[\w\-./]+\/)(?:\s|$)/);
    if (dirMatch) {
      return dirMatch[1];
    }

    return undefined;
  }

  /**
   * Classify intent complexity
   */
  private classifyComplexity(input: string): "simple" | "complex" {
    const complexPatterns = [
      /and\s+then/i,
      /after\s+that/i,
      /first\s+.+\s+then/i,
      /finally/i,
      /research/i,
      /analyze/i,
      /refactor/i,
      /convert\s+all/i,
      /summarize\s+.+\s+and/i,
      /create\s+a\s+project/i,
      /build\s+.+\s+with/i,
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(input)) {
        return "complex";
      }
    }

    // Check for multiple actions
    const actionCount = (
      input.match(
        /\b(read|write|create|delete|search|fetch|run|summarize)\b/gi
      ) || []
    ).length;
    if (actionCount > 1) {
      return "complex";
    }

    return "simple";
  }

  /**
   * Extract parameters from input
   */
  private extractParameters(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract key=value patterns
    const kvMatches = input.matchAll(/(\w+)\s*=\s*["']?([^"'\s]+)["']?/g);
    for (const match of kvMatches) {
      params[match[1]] = match[2];
    }

    // Extract common flags
    if (/--?recursive|-r\b/i.test(input)) {
      params.recursive = true;
    }
    if (/--?verbose|-v\b/i.test(input)) {
      params.verbose = true;
    }
    if (/--?force|-f\b/i.test(input)) {
      params.force = true;
    }

    // Extract numeric values
    const numMatch = input.match(/\b(\d+)\s*(lines?|bytes?|mb|kb|gb)/i);
    if (numMatch) {
      params.limit = parseInt(numMatch[1], 10);
      params.limitUnit = numMatch[2].toLowerCase();
    }

    return params;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    action: string,
    target: string | undefined,
    input: string
  ): number {
    let confidence = 0.3; // Base confidence

    // Known action increases confidence
    if (action !== "unknown") {
      confidence += 0.3;
    }

    // Having a target increases confidence
    if (target) {
      confidence += 0.2;
    }

    // Longer, more specific input increases confidence
    if (input.length > 20) {
      confidence += 0.1;
    }

    // Question marks reduce confidence (might need explanation)
    if (input.includes("?")) {
      confidence -= 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Generate clarification questions
   */
  private generateClarificationQuestions(
    action: string,
    target: string | undefined
  ): string[] {
    const questions: string[] = [];

    if (action === "unknown") {
      questions.push("What would you like me to do?");
    }

    if (!target) {
      if (["read", "write", "create", "delete"].includes(action)) {
        questions.push("Which file or directory?");
      } else if (["fetch", "download", "get"].includes(action)) {
        questions.push("What URL should I access?");
      } else if (["run", "execute"].includes(action)) {
        questions.push("What command should I run?");
      }
    }

    if (questions.length === 0) {
      questions.push("Could you provide more details?");
    }

    return questions;
  }
}
