import { describe, it, expect, vi, beforeEach } from "vitest";
import { FallbackAdapter } from "../../../core/models/fallback-adapter";
import type { ModelAdapter, LLMOutput, Embedding } from "../../../core/models/types";

describe("FallbackAdapter", () => {
  let localAdapter: ModelAdapter;
  let cloudAdapter: ModelAdapter;
  let fallbackAdapter: FallbackAdapter;

  const mockLocalOutput: LLMOutput = {
    text: "Local response",
    finishReason: "stop",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };

  const mockCloudOutput: LLMOutput = {
    text: "Cloud response",
    finishReason: "stop",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };

  const mockEmbedding: Embedding = {
    vector: [0.1, 0.2, 0.3],
    model: "test",
  };

  beforeEach(() => {
    localAdapter = {
      generate: vi.fn().mockResolvedValue(mockLocalOutput),
      embed: vi.fn().mockResolvedValue(mockEmbedding),
      getCapabilities: vi.fn().mockReturnValue({
        maxContextLength: 8192,
        supportsStreaming: true,
        supportsEmbedding: true,
        costPerToken: 0,
      }),
    };

    cloudAdapter = {
      generate: vi.fn().mockResolvedValue(mockCloudOutput),
      embed: vi.fn().mockResolvedValue(mockEmbedding),
      getCapabilities: vi.fn().mockReturnValue({
        maxContextLength: 128000,
        supportsStreaming: true,
        supportsEmbedding: false,
        costPerToken: 0.00003,
      }),
    };

    fallbackAdapter = new FallbackAdapter(localAdapter, cloudAdapter, 1000);
  });

  it("should use local adapter when it succeeds", async () => {
    const result = await fallbackAdapter.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.text).toBe("Local response");
    expect(localAdapter.generate).toHaveBeenCalled();
    expect(cloudAdapter.generate).not.toHaveBeenCalled();
  });

  it("should fallback to cloud when local fails", async () => {
    (localAdapter.generate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Local model error")
    );

    const result = await fallbackAdapter.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.text).toBe("Cloud response");
    expect(cloudAdapter.generate).toHaveBeenCalled();
  });

  it("should fallback to cloud when local times out", async () => {
    vi.useFakeTimers();

    (localAdapter.generate as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockLocalOutput), 2000))
    );

    const generatePromise = fallbackAdapter.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(1500);

    const result = await generatePromise;

    expect(result.text).toBe("Cloud response");

    vi.useRealTimers();
  });

  it("should fallback to cloud when local output quality is poor", async () => {
    (localAdapter.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockLocalOutput,
      finishReason: "length", // Indicates incomplete response
    });

    const result = await fallbackAdapter.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.text).toBe("Cloud response");
  });

  it("should use local embedding when available", async () => {
    const result = await fallbackAdapter.embed("Test text");

    expect(result.vector).toEqual([0.1, 0.2, 0.3]);
    expect(localAdapter.embed).toHaveBeenCalled();
    expect(cloudAdapter.embed).not.toHaveBeenCalled();
  });

  it("should fallback to cloud embedding when local fails", async () => {
    (localAdapter.embed as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Embedding error")
    );

    const result = await fallbackAdapter.embed("Test text");

    expect(result.vector).toEqual([0.1, 0.2, 0.3]);
    expect(cloudAdapter.embed).toHaveBeenCalled();
  });

  it("should return cloud capabilities", () => {
    const caps = fallbackAdapter.getCapabilities();

    expect(caps.maxContextLength).toBe(128000);
    expect(caps.costPerToken).toBe(0.00003);
  });
});

