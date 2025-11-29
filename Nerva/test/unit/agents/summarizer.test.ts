/**
 * Unit tests for SummarizerAgent
 */

import { describe, it, expect, vi } from "vitest";
import { SummarizerAgent, SummarizerInput } from "../../../core/agents/summarizer";
import type { ModelAdapter, LLMOutput, Message } from "../../../core/models/types";

// Mock model adapter
function createMockAdapter(response: string): ModelAdapter {
  return {
    generate: vi.fn().mockResolvedValue({
      text: response,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    } as LLMOutput),
    embed: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({
      maxContextLength: 4096,
      supportsStreaming: true,
      supportsEmbedding: true,
    }),
  };
}

describe("SummarizerAgent", () => {
  describe("summarize", () => {
    it("should summarize text and return structured output", async () => {
      const mockResponse = JSON.stringify({
        summary: "This is a summary of the text.",
        keyPoints: ["Point 1", "Point 2"],
        actionItems: ["Action 1"],
        openQuestions: ["Question 1"],
        contextHints: ["Hint 1"],
      });

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter);

      const input: SummarizerInput = {
        text: "This is a very long text that needs to be summarized. ".repeat(50),
        level: "standard",
      };

      const result = await summarizer.summarize(input);

      expect(result.summary).toBe("This is a summary of the text.");
      expect(result.keyPoints).toEqual(["Point 1", "Point 2"]);
      expect(result.actionItems).toEqual(["Action 1"]);
      expect(result.openQuestions).toEqual(["Question 1"]);
      expect(result.contextHints).toEqual(["Hint 1"]);
      expect(result.originalLength).toBeGreaterThan(0);
      expect(result.compressedLength).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(1);
    });

    it("should return short text as-is", async () => {
      const adapter = createMockAdapter("");
      const summarizer = new SummarizerAgent(adapter);

      const shortText = "Short text.";
      const result = await summarizer.summarize({
        text: shortText,
        level: "detailed", // 1000 char target
      });

      expect(result.summary).toBe(shortText);
      expect(result.compressionRatio).toBe(1);
      expect(adapter.generate).not.toHaveBeenCalled();
    });

    it("should parse JSON from markdown code blocks", async () => {
      const mockResponse = `Here's the summary:

\`\`\`json
{
  "summary": "Extracted summary",
  "keyPoints": [],
  "actionItems": [],
  "openQuestions": [],
  "contextHints": []
}
\`\`\``;

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter);

      const result = await summarizer.summarize({
        text: "Long text ".repeat(100),
        level: "brief",
      });

      expect(result.summary).toBe("Extracted summary");
    });

    it("should handle snake_case in response", async () => {
      const mockResponse = JSON.stringify({
        summary: "Test summary",
        key_points: ["Point 1"],
        action_items: ["Action 1"],
        open_questions: ["Question 1"],
        context_hints: ["Hint 1"],
      });

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter);

      const result = await summarizer.summarize({
        text: "Long text ".repeat(100),
        level: "standard",
      });

      expect(result.keyPoints).toEqual(["Point 1"]);
      expect(result.actionItems).toEqual(["Action 1"]);
    });

    it("should fall back to plain text on JSON parse failure", async () => {
      const plainResponse = "This is just a plain text summary.";
      const adapter = createMockAdapter(plainResponse);
      const summarizer = new SummarizerAgent(adapter);

      const result = await summarizer.summarize({
        text: "Long text ".repeat(100),
        level: "brief",
      });

      expect(result.summary).toBe(plainResponse);
      expect(result.keyPoints).toEqual([]);
    });

    it("should use correct target length for each level", async () => {
      const adapter = createMockAdapter(JSON.stringify({ summary: "Test" }));
      const summarizer = new SummarizerAgent(adapter);

      expect(summarizer.getTargetLength("brief")).toBe(200);
      expect(summarizer.getTargetLength("standard")).toBe(500);
      expect(summarizer.getTargetLength("detailed")).toBe(1000);
    });
  });

  describe("compressConversation", () => {
    it("should format messages and summarize", async () => {
      const mockResponse = JSON.stringify({
        summary: "User asked about X, assistant explained Y.",
        keyPoints: ["X was discussed", "Y was explained"],
        actionItems: [],
        openQuestions: [],
        contextHints: ["Technical discussion"],
      });

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter);

      // Use longer messages to exceed the target length threshold
      const messages: Message[] = [
        { role: "user", content: "What is X? ".repeat(50) },
        { role: "assistant", content: "X is a concept that means Y. ".repeat(50) },
        { role: "user", content: "Can you explain more? ".repeat(50) },
        { role: "assistant", content: "Sure, here are more details about Y. ".repeat(50) },
      ];

      const result = await summarizer.compressConversation(messages);

      expect(result.summary).toBe("User asked about X, assistant explained Y.");
      expect(adapter.generate).toHaveBeenCalled();

      // Check that the prompt includes formatted messages
      const call = (adapter.generate as ReturnType<typeof vi.fn>).mock.calls[0];
      const prompt = call[0];
      expect(prompt.messages[1].content).toContain("User:");
      expect(prompt.messages[1].content).toContain("Assistant:");
    });
  });

  describe("summarizeMultiple", () => {
    it("should summarize single text directly", async () => {
      const mockResponse = JSON.stringify({
        summary: "Single text summary",
        keyPoints: [],
        actionItems: [],
        openQuestions: [],
        contextHints: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter);

      const result = await summarizer.summarizeMultiple(
        ["Long text ".repeat(100)],
        "standard"
      );

      expect(result.summary).toBe("Single text summary");
      expect(adapter.generate).toHaveBeenCalledTimes(1);
    });

    it("should combine multiple texts", async () => {
      let callCount = 0;
      const adapter = {
        generate: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            // First two calls: brief summaries (return short summaries that will be combined)
            return Promise.resolve({
              text: JSON.stringify({
                summary: `Brief summary ${callCount} `.repeat(50), // Make it long enough
                keyPoints: [],
                actionItems: [],
                openQuestions: [],
                contextHints: [],
              }),
              finishReason: "stop",
              usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
            });
          }
          // Final call: combined summary
          return Promise.resolve({
            text: JSON.stringify({
              summary: "Combined summary of both texts",
              keyPoints: ["From text 1", "From text 2"],
              actionItems: [],
              openQuestions: [],
              contextHints: [],
            }),
            finishReason: "stop",
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          });
        }),
        embed: vi.fn(),
        getCapabilities: vi.fn().mockReturnValue({
          maxContextLength: 4096,
          supportsStreaming: true,
          supportsEmbedding: true,
        }),
      } as ModelAdapter;

      const summarizer = new SummarizerAgent(adapter);

      const result = await summarizer.summarizeMultiple(
        ["Long text one ".repeat(100), "Long text two ".repeat(100)],
        "standard"
      );

      expect(result.summary).toBe("Combined summary of both texts");
      expect(result.keyPoints).toContain("From text 1");
      expect(adapter.generate).toHaveBeenCalledTimes(3);
    });
  });

  describe("estimateCompressionRatio", () => {
    it("should calculate correct compression ratios", () => {
      const adapter = createMockAdapter("");
      const summarizer = new SummarizerAgent(adapter);

      // 1000 chars -> 200 target (brief) = 5x compression
      expect(summarizer.estimateCompressionRatio(1000, "brief")).toBe(5);

      // 2500 chars -> 500 target (standard) = 5x compression
      expect(summarizer.estimateCompressionRatio(2500, "standard")).toBe(5);

      // 5000 chars -> 1000 target (detailed) = 5x compression
      expect(summarizer.estimateCompressionRatio(5000, "detailed")).toBe(5);
    });
  });

  describe("configuration", () => {
    it("should use default level from config", async () => {
      const mockResponse = JSON.stringify({
        summary: "Test",
        keyPoints: [],
        actionItems: [],
        openQuestions: [],
        contextHints: [],
      });

      const adapter = createMockAdapter(mockResponse);
      const summarizer = new SummarizerAgent(adapter, { defaultLevel: "brief" });

      // Don't specify level, should use config default
      await summarizer.summarize({
        text: "Long text ".repeat(100),
      });

      // Brief level has 200 char target, so maxTokens should be ~300
      const call = (adapter.generate as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].maxTokens).toBe(300); // 200 * 1.5
    });
  });
});

