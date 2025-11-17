/**
 * Intent Parser Tests
 */

import { describe, it, expect } from "vitest";
import { IntentParser } from "../../../core/kernel/intent-parser";

describe("IntentParser", () => {
  const parser = new IntentParser();

  it("should return a valid intent structure", () => {
    const intent = parser.parse("list files in src/");

    // Verify the intent has all required fields
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
      const intent = parser.parse(input);
      // The placeholder implementation should still detect complexity keywords
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
      const intent = parser.parse(input);
      // Should default to simple when no complexity keywords present
      expect(intent.complexity).toBe("simple");
    }
  });

  it("should have confidence between 0 and 1", () => {
    const intent = parser.parse("do something");

    expect(intent.confidence).toBeGreaterThanOrEqual(0);
    expect(intent.confidence).toBeLessThanOrEqual(1);
  });

  it("should handle empty input gracefully", () => {
    const intent = parser.parse("");

    expect(intent).toBeDefined();
    expect(intent.action).toBeDefined();
    expect(intent.confidence).toBeLessThan(1);
  });

  it("should handle very long input", () => {
    const longInput = "search for files ".repeat(100);
    const intent = parser.parse(longInput);

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
      const intent = parser.parse(input);
      expect(intent.complexity).toBe("complex");
    }
  });
});

