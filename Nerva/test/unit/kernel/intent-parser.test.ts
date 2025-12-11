/**
 * Intent Parser Tests
 */

import { describe, it, expect, vi } from "vitest";
import { IntentParser } from "../../../core/kernel/intent-parser";
import type { ModelAdapter, LLMOutput } from "../../../core/models/types";

// Mock model adapter
function createMockModelAdapter(response: string): ModelAdapter {
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

describe("IntentParser", () => {
  describe("heuristic parsing", () => {
    const parser = new IntentParser();

    it("should return a valid intent structure", () => {
      const intent = parser.parseHeuristic("list files in src/");

      expect(intent).toBeDefined();
      expect(intent).toHaveProperty("action");
      expect(intent).toHaveProperty("parameters");
      expect(intent).toHaveProperty("complexity");
      expect(intent).toHaveProperty("confidence");
      expect(intent).toHaveProperty("needsClarification");
      expect(typeof intent.action).toBe("string");
      expect(typeof intent.parameters).toBe("object");
      expect(typeof intent.confidence).toBe("number");
      expect(typeof intent.needsClarification).toBe("boolean");
    });

    it("should detect complex multi-step intents", () => {
      const complexInputs = [
        "first search my notes and then create a study plan",
        "read the file and then analyze it after that",
        "download the data, process it, and finally save the results",
      ];

      for (const input of complexInputs) {
        const intent = parser.parseHeuristic(input);
        expect(intent.complexity).toBe("complex");
      }
    });

    it("should classify simple single-step intents", () => {
      const simpleInputs = [
        "list files",
        "read config.json",
        "search for test files",
      ];

      for (const input of simpleInputs) {
        const intent = parser.parseHeuristic(input);
        expect(intent.complexity).toBe("simple");
      }
    });

    it("should have confidence between 0 and 1", () => {
      const intent = parser.parseHeuristic("do something");

      expect(intent.confidence).toBeGreaterThanOrEqual(0);
      expect(intent.confidence).toBeLessThanOrEqual(1);
    });

    it("should handle empty input gracefully", () => {
      const intent = parser.parseHeuristic("");

      expect(intent).toBeDefined();
      expect(intent.action).toBeDefined();
      expect(intent.confidence).toBeLessThan(1);
    });

    it("should handle very long input", () => {
      const longInput = "search for files ".repeat(100);
      const intent = parser.parseHeuristic(longInput);

      expect(intent).toBeDefined();
      expect(intent.action).toBeDefined();
    });

    it("should preserve case-insensitive complexity detection", () => {
      const inputs = [
        "FIRST do this AND THEN do that",
        "First Do This And Then Do That",
        "first do this and then do that",
      ];

      for (const input of inputs) {
        const intent = parser.parseHeuristic(input);
        expect(intent.complexity).toBe("complex");
      }
    });

    it("should extract action verbs", () => {
      const testCases: [string, string][] = [
        ["read file.txt", "read"],
        ["write data to output.json", "write"],
        ["search for todos", "search"],
        ["delete old-file.txt", "delete"],
        ["fetch https://api.com/data", "fetch"],
        ["run npm test", "run"],
      ];

      for (const [input, expectedAction] of testCases) {
        const intent = parser.parseHeuristic(input);
        expect(intent.action).toBe(expectedAction);
      }
    });

    it("should extract file path targets", () => {
      const intent = parser.parseHeuristic("read /path/to/file.txt");
      expect(intent.target).toBe("/path/to/file.txt");
    });

    it("should extract URL targets", () => {
      const intent = parser.parseHeuristic("fetch https://example.com/api");
      expect(intent.target).toBe("https://example.com/api");
    });

    it("should extract quoted targets", () => {
      const intent = parser.parseHeuristic('search for "important documents"');
      expect(intent.target).toBe("important documents");
    });

    it("should extract parameters from key=value patterns", () => {
      const intent = parser.parseHeuristic("list files limit=10 format=json");
      expect(intent.parameters.limit).toBe("10");
      expect(intent.parameters.format).toBe("json");
    });

    it("should detect common flags", () => {
      const intent = parser.parseHeuristic("list files -r --verbose");
      expect(intent.parameters.recursive).toBe(true);
      expect(intent.parameters.verbose).toBe(true);
    });

    it("should generate clarification questions for low confidence", () => {
      const parser = new IntentParser({ confidenceThreshold: 0.9 });
      const intent = parser.parseHeuristic("something");

      expect(intent.needsClarification).toBe(true);
      expect(intent.clarificationQuestions).toBeDefined();
      expect(intent.clarificationQuestions!.length).toBeGreaterThan(0);
    });
  });

  describe("LLM parsing", () => {
    it("should parse using LLM when adapter is provided", async () => {
      const mockResponse = JSON.stringify({
        action: "read",
        target: "/test/file.txt",
        parameters: { encoding: "utf-8" },
        complexity: "simple",
        confidence: 0.95,
        needsClarification: false,
        clarificationQuestions: [],
      });

      const modelAdapter = createMockModelAdapter(mockResponse);
      const parser = new IntentParser({}, modelAdapter);

      const intent = await parser.parse("read /test/file.txt");

      expect(intent.action).toBe("read");
      expect(intent.target).toBe("/test/file.txt");
      expect(intent.confidence).toBe(0.95);
      expect(modelAdapter.generate).toHaveBeenCalled();
    });

    it("should parse JSON from markdown code blocks", async () => {
      const mockResponse = `Here's the parsed intent:

\`\`\`json
{
  "action": "write",
  "target": "output.txt",
  "parameters": {},
  "complexity": "simple",
  "confidence": 0.9,
  "needsClarification": false,
  "clarificationQuestions": []
}
\`\`\``;

      const modelAdapter = createMockModelAdapter(mockResponse);
      const parser = new IntentParser({}, modelAdapter);

      const intent = await parser.parse("write to output.txt");

      expect(intent.action).toBe("write");
      expect(intent.target).toBe("output.txt");
    });

    it("should fall back to heuristic on LLM failure", async () => {
      const modelAdapter = createMockModelAdapter("");
      (modelAdapter.generate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("LLM unavailable")
      );

      const parser = new IntentParser({}, modelAdapter);

      const intent = await parser.parse("read file.txt");

      // Should still return a valid intent from heuristic parsing
      expect(intent).toBeDefined();
      expect(intent.action).toBe("read");
    });

    it("should fall back to heuristic on invalid JSON response", async () => {
      const modelAdapter = createMockModelAdapter("This is not valid JSON");
      const parser = new IntentParser({}, modelAdapter);

      const intent = await parser.parse("read file.txt");

      // Should fall back to heuristic
      expect(intent).toBeDefined();
      expect(intent.action).toBe("read");
    });

    it("should enforce confidence threshold", async () => {
      const mockResponse = JSON.stringify({
        action: "something",
        parameters: {},
        complexity: "simple",
        confidence: 0.4, // Below default threshold of 0.6
        needsClarification: false,
      });

      const modelAdapter = createMockModelAdapter(mockResponse);
      const parser = new IntentParser({}, modelAdapter);

      const intent = await parser.parse("vague input");

      expect(intent.needsClarification).toBe(true);
      expect(intent.clarificationQuestions!.length).toBeGreaterThan(0);
    });
  });
});
