/**
 * Web tool - HTTP requests with allowlist and rate limiting
 */

import type { Tool, ToolResult } from "./types";

export interface WebInput {
  action: "fetch" | "search";
  url?: string; // For fetch
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  query?: string; // For search
  limit?: number;
}

export interface NetworkPolicy {
  allowed_hosts: string[];
  blocked_hosts: string[];
  rate_limit: {
    requests: number;
    window_seconds: number;
  };
  timeout_seconds: number;
  max_response_size: number;
}

export class WebTool implements Tool {
  name = "web";
  description = "HTTP requests and web search";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["fetch", "search"],
        description: "Operation to perform",
      },
      url: {
        type: "string",
        description: "URL to fetch",
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "DELETE"],
        description: "HTTP method",
      },
      headers: {
        type: "object",
        description: "HTTP headers",
      },
      body: {
        type: "string",
        description: "Request body",
      },
      query: {
        type: "string",
        description: "Search query",
      },
      limit: {
        type: "number",
        description: "Max number of search results",
      },
    },
    required: ["action"],
  };

  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor(private policy: NetworkPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const webInput = input as WebInput;

    try {
      if (!this.checkRateLimit()) {
        throw new Error("Rate limit exceeded");
      }

      let output: unknown;

      switch (webInput.action) {
        case "fetch":
          if (!webInput.url) {
            throw new Error("Missing required parameter: url");
          }
          if (!this.isAllowedHost(webInput.url)) {
            throw new Error(`Access denied: Host not allowed or blocked for URL '${webInput.url}'`);
          }
          output = await this.fetch(webInput);
          break;

        case "search":
          if (!webInput.query) {
            throw new Error("Missing required parameter: query");
          }
          output = await this.search(webInput);
          break;

        default:
          throw new Error(`Unknown action: ${webInput.action}`);
      }

      return {
        success: true,
        output,
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "WEB_ERROR",
          message: (error as Error).message,
          recoverable: true,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Fetch a URL
   */
  private async fetch(input: WebInput): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.policy.timeout_seconds * 1000);

      const response = await fetch(input.url!, {
        method: input.method || "GET",
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > this.policy.max_response_size) {
        throw new Error(`Response size exceeds limit (${this.policy.max_response_size})`);
      }

      const text = await response.text();
      if (text.length > this.policy.max_response_size) {
        throw new Error(`Response size exceeds limit (${this.policy.max_response_size})`);
      }
      
      return text;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
         throw new Error(`Request timed out after ${this.policy.timeout_seconds}s`);
      }
      throw new Error(`Fetch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Search the web
   */
  private async search(input: WebInput): Promise<unknown[]> {
    // TODO: Integrate with real search API
    // For MVP, returning a mock response or using a public demo API
    // This is a placeholder as requested in the plan
    return [
      {
        title: `Results for "${input.query}"`,
        snippet: "Mock search result. Real search requires API integration.",
        url: "https://example.com/search",
      },
    ];
  }

  /**
   * Check if host is allowed
   */
  private isAllowedHost(urlStr: string): boolean {
    try {
      const url = new URL(urlStr);
      const hostname = url.hostname;

      // Check blocked hosts first
      const isBlocked = this.policy.blocked_hosts.some((blocked) => {
         if (blocked.startsWith("*.")) {
            return hostname.endsWith(blocked.slice(2));
         }
         return hostname === blocked;
      });

      if (isBlocked) return false;

      // Check allowed hosts
      return this.policy.allowed_hosts.some((allowed) => {
        if (allowed === "*") return true;
        if (allowed.startsWith("*.")) {
          return hostname.endsWith(allowed.slice(2));
        }
        return hostname === allowed;
      });
    } catch {
      return false;
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowMs = this.policy.rate_limit.window_seconds * 1000;
    
    if (now - this.lastResetTime > windowMs) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.policy.rate_limit.requests) {
      return false;
    }

    this.requestCount++;
    return true;
  }
}
