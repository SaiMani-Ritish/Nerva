/**
 * Summarizer agent - compresses text while preserving key information
 */

import type { Summary } from "./types.js";
import type { ModelAdapter, Prompt, Message } from "../models/types.js";

export interface SummarizerInput {
  text: string;
  targetLength?: number;
  level?: "brief" | "standard" | "detailed";
}

export interface SummarizerConfig {
  defaultLevel?: "brief" | "standard" | "detailed";
}

const SUMMARIZER_SYSTEM_PROMPT = `You are the Summarizer Agent for Nerva OS. Your role is to compress information while preserving what matters.

## Responsibilities

1. Extract key information from long text
2. Compress to target length (tokens or words)
3. Preserve important details (decisions, action items, facts)
4. Generate continuation hints for resuming context
5. Maintain coherent narrative

## Summarization Levels

### Brief (100-200 tokens)
- Main topic and outcome
- Critical decisions only
- Use for memory snapshots

### Standard (200-500 tokens)
- Key points and context
- Important details
- Use for conversation summaries

### Detailed (500-1000 tokens)
- Full context preservation
- All important points
- Use for complex threads

## Output Format

Return a valid JSON object:

{
  "summary": string,
  "keyPoints": string[],
  "actionItems": string[],
  "openQuestions": string[],
  "contextHints": string[]
}

## Summarization Guidelines

1. **Preserve Decisions**: Never omit decisions or commitments
2. **Keep Context**: Maintain enough context for continuation
3. **Highlight Actions**: Emphasize what was done or needs doing
4. **Note Uncertainties**: Track open questions
5. **Be Objective**: Don't add interpretation`;

const LEVEL_LENGTHS: Record<"brief" | "standard" | "detailed", number> = {
  brief: 200,
  standard: 500,
  detailed: 1000,
};

export class SummarizerAgent {
  private config: SummarizerConfig;

  constructor(
    private modelAdapter: ModelAdapter,
    config?: SummarizerConfig
  ) {
    this.config = {
      defaultLevel: config?.defaultLevel ?? "standard",
    };
  }

  /**
   * Summarize text to target length
   */
  async summarize(input: SummarizerInput): Promise<Summary> {
    const level = input.level || this.config.defaultLevel!;
    const targetLength = input.targetLength || LEVEL_LENGTHS[level];
    const originalLength = input.text.length;

    // If text is already short enough, return as-is
    if (originalLength <= targetLength) {
      return {
        summary: input.text,
        keyPoints: [],
        actionItems: [],
        openQuestions: [],
        contextHints: [],
        originalLength,
        compressedLength: originalLength,
        compressionRatio: 1,
      };
    }

    const prompt = this.buildPrompt(input, targetLength);

    const response = await this.modelAdapter.generate(prompt, {
      maxTokens: Math.ceil(targetLength * 1.5), // Allow some overhead
      temperature: 0.3, // Lower temperature for consistent output
    });

    const parsed = this.parseResponse(response.text);

    return {
      ...parsed,
      originalLength,
      compressedLength: parsed.summary.length,
      compressionRatio: originalLength / parsed.summary.length,
    };
  }

  /**
   * Compress a conversation history
   */
  async compressConversation(messages: Message[]): Promise<Summary> {
    // Format messages into text
    const text = messages
      .map((msg) => {
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    return this.summarize({
      text,
      level: "standard",
    });
  }

  /**
   * Summarize multiple texts and combine
   */
  async summarizeMultiple(
    texts: string[],
    level: "brief" | "standard" | "detailed" = "standard"
  ): Promise<Summary> {
    // If only one text, summarize directly
    if (texts.length === 1) {
      return this.summarize({ text: texts[0], level });
    }

    // Summarize each text briefly
    const summaries = await Promise.all(
      texts.map((text) => this.summarize({ text, level: "brief" }))
    );

    // Combine and summarize again
    const combined = summaries.map((s) => s.summary).join("\n\n---\n\n");

    return this.summarize({ text: combined, level });
  }

  /**
   * Build summarization prompt
   */
  private buildPrompt(input: SummarizerInput, targetLength: number): Prompt {
    const level = input.level || this.config.defaultLevel!;

    const userMessage = `Please summarize the following text to approximately ${targetLength} characters.

Level: ${level}

Text to summarize:
---
${input.text}
---

Return your response as a JSON object with the required fields.`;

    return {
      messages: [
        { role: "system", content: SUMMARIZER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    };
  }

  /**
   * Parse the LLM response into Summary fields
   */
  private parseResponse(text: string): Omit<
    Summary,
    "originalLength" | "compressedLength" | "compressionRatio"
  > {
    // Try to extract JSON from the response
    let jsonStr = text;

    // Handle markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        summary: parsed.summary || "",
        keyPoints: parsed.keyPoints || parsed.key_points || [],
        actionItems: parsed.actionItems || parsed.action_items || [],
        openQuestions: parsed.openQuestions || parsed.open_questions || [],
        contextHints: parsed.contextHints || parsed.context_hints || [],
      };
    } catch {
      // If JSON parsing fails, treat the entire response as the summary
      return {
        summary: text.trim(),
        keyPoints: [],
        actionItems: [],
        openQuestions: [],
        contextHints: [],
      };
    }
  }

  /**
   * Get target length based on level
   */
  getTargetLength(level: "brief" | "standard" | "detailed"): number {
    return LEVEL_LENGTHS[level];
  }

  /**
   * Estimate compression ratio for given text and level
   */
  estimateCompressionRatio(
    textLength: number,
    level: "brief" | "standard" | "detailed"
  ): number {
    const targetLength = LEVEL_LENGTHS[level];
    return textLength / targetLength;
  }
}
