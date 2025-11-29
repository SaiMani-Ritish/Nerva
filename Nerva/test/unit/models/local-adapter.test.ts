import { describe, it, expect } from "vitest";
import { LocalAdapter } from "../../../core/models/local-adapter";

describe("LocalAdapter", () => {
  let adapter: LocalAdapter;

  beforeEach(() => {
    adapter = new LocalAdapter({
      modelPath: "./models/test-model.gguf",
      contextSize: 4096,
    });
  });

  it("should generate mock response", async () => {
    const result = await adapter.generate({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    });

    expect(result.text).toContain("Local Model Response");
    expect(result.finishReason).toBe("stop");
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.metadata?.isMock).toBe(true);
  });

  it("should generate embeddings", async () => {
    const result = await adapter.embed("Test text for embedding");

    expect(result.vector).toHaveLength(384);
    expect(result.model).toBe("local-embedding");
    
    // Check normalization (magnitude should be ~1)
    const magnitude = Math.sqrt(
      result.vector.reduce((sum, v) => sum + v * v, 0)
    );
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("should generate consistent embeddings for same text", async () => {
    const result1 = await adapter.embed("Same text");
    const result2 = await adapter.embed("Same text");

    expect(result1.vector).toEqual(result2.vector);
  });

  it("should generate different embeddings for different text", async () => {
    const result1 = await adapter.embed("Text one");
    const result2 = await adapter.embed("Text two");

    expect(result1.vector).not.toEqual(result2.vector);
  });

  it("should return correct capabilities", () => {
    const caps = adapter.getCapabilities();

    expect(caps.maxContextLength).toBe(4096);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.supportsEmbedding).toBe(true);
    expect(caps.costPerToken).toBe(0);
  });

  it("should use default context size if not specified", () => {
    const defaultAdapter = new LocalAdapter({
      modelPath: "./models/test.gguf",
    });

    const caps = defaultAdapter.getCapabilities();
    expect(caps.maxContextLength).toBe(8192);
  });
});

