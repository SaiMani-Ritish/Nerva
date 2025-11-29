import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebTool } from "../../../core/tools/web";

// Mock global fetch
global.fetch = vi.fn();

describe("WebTool", () => {
  let tool: WebTool;

  beforeEach(() => {
    vi.resetAllMocks();
    tool = new WebTool({
      allowed_hosts: ["example.com", "*.api.com"],
      blocked_hosts: ["bad.api.com"],
      rate_limit: { requests: 2, window_seconds: 1 },
      timeout_seconds: 5,
      max_response_size: 1024 * 1024,
    });
  });

  it("should block explicitly blocked host even if allowed by wildcard", async () => {
    const result = await tool.execute({
      action: "fetch",
      url: "https://bad.api.com/v1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Access denied");
  });


  it("should fetch allowed url", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => null,
      },
      text: () => Promise.resolve("mock response"),
    });

    const result = await tool.execute({
      action: "fetch",
      url: "https://example.com/data",
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("mock response");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/data",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should block disallowed host", async () => {
    const result = await tool.execute({
      action: "fetch",
      url: "https://evil.com/data",
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Access denied");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should support wildcard allowed hosts", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => null,
      },
      text: () => Promise.resolve("ok"),
    });

    const result = await tool.execute({
      action: "fetch",
      url: "https://sub.api.com/v1",
    });

    expect(result.success).toBe(true);
  });

  it("should enforce rate limit", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => null,
      },
      text: () => Promise.resolve("ok"),
    });

    // Request 1
    await tool.execute({ action: "fetch", url: "https://example.com/1" });
    // Request 2
    await tool.execute({ action: "fetch", url: "https://example.com/2" });
    
    // Request 3 (should fail)
    const result = await tool.execute({ action: "fetch", url: "https://example.com/3" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Rate limit exceeded");
  });

  it("should handle search placeholder", async () => {
    const result = await tool.execute({
      action: "search",
      query: "test query",
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.output)).toBe(true);
  });
});

