import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIAdapter } from "../../../core/models/openai-adapter";

// Mock global fetch
global.fetch = vi.fn();

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.resetAllMocks();
    adapter = new OpenAIAdapter({
      apiKey: "test-api-key",
      model: "gpt-4",
    });
  });

  it("should generate text from prompt", async () => {
    const mockResponse = {
      id: "chatcmpl-123",
      choices: [
        {
          message: { role: "assistant", content: "Hello! How can I help?" },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18,
      },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await adapter.generate({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
    });

    expect(result.text).toBe("Hello! How can I help?");
    expect(result.finishReason).toBe("stop");
    expect(result.usage.totalTokens).toBe(18);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
  });

  it("should handle API errors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Invalid API key"),
    });

    await expect(
      adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
      })
    ).rejects.toThrow("OpenAI API error: 401");
  });

  it("should generate embeddings", async () => {
    const mockResponse = {
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await adapter.embed("Hello world");

    expect(result.vector).toEqual([0.1, 0.2, 0.3]);
    expect(result.model).toBe("text-embedding-3-small");
  });

  it("should return correct capabilities for gpt-4", () => {
    const caps = adapter.getCapabilities();

    expect(caps.maxContextLength).toBe(128000);
    expect(caps.supportsStreaming).toBe(true);
    expect(caps.costPerToken).toBe(0.00003);
  });

  it("should pass generation options", async () => {
    const mockResponse = {
      id: "chatcmpl-123",
      choices: [
        {
          message: { role: "assistant", content: "Response" },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await adapter.generate(
      { messages: [{ role: "user", content: "Hi" }] },
      { maxTokens: 100, temperature: 0.5, stopSequences: ["END"] }
    );

    const callBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );

    expect(callBody.max_tokens).toBe(100);
    expect(callBody.temperature).toBe(0.5);
    expect(callBody.stop).toEqual(["END"]);
  });
});

