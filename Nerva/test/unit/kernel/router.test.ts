/**
 * Router Tests
 */

import { describe, it, expect, vi } from "vitest";
import { Router } from "../../../core/kernel/router";
import type { Intent, Context } from "../../../core/kernel/types";
import type { Tool, ToolRegistry } from "../../../core/tools/types";

// Mock tool registry
function createMockToolRegistry(toolNames: string[]): ToolRegistry {
  const tools = toolNames.map((name) => ({
    name,
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn(),
  }));
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return {
    register: vi.fn(),
    get: vi.fn((name: string) => toolMap.get(name)),
    list: vi.fn(() => Array.from(toolMap.values())),
  };
}

describe("Router", () => {
  const mockContext: Context = {
    threadId: "thread-1",
    userId: "user-1",
    history: [],
    metadata: {},
  };

  describe("basic routing", () => {
    const router = new Router();

    it("should route to clarification when needed", () => {
      const intent: Intent = {
        action: "search",
        parameters: {},
        complexity: "simple",
        confidence: 0.4,
        needsClarification: true,
        clarificationQuestions: ["Which directory should I search?"],
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("clarify");
      if (decision.type === "clarify") {
        expect(decision.questions).toContain("Which directory should I search?");
      }
    });

    it("should route simple intents to direct tool execution", () => {
      const intent: Intent = {
        action: "list",
        target: "/home",
        parameters: { path: "/home" },
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.tool).toBe("fs");
        expect(decision.operation).toBe("list");
      }
    });

    it("should route complex intents to planner", () => {
      const intent: Intent = {
        action: "analyze",
        parameters: {},
        complexity: "complex",
        confidence: 0.8,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("plan");
      if (decision.type === "plan") {
        expect(decision.goal).toContain("analyze");
        expect(decision.availableTools).toBeDefined();
      }
    });

    it("should route conversational intents to respond", () => {
      const intent: Intent = {
        action: "explain",
        target: "transformers",
        parameters: {},
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("respond");
      if (decision.type === "respond") {
        expect(decision.message).toContain("explain");
      }
    });
  });

  describe("tool selection", () => {
    const router = new Router();

    it("should select fs tool for file operations", () => {
      const fileActions = ["list", "read", "write", "search", "create", "delete"];

      fileActions.forEach((action) => {
        const intent: Intent = {
          action,
          parameters: {},
          complexity: "simple",
          confidence: 0.9,
          needsClarification: false,
        };

        const decision = router.route(intent, mockContext);

        expect(decision.type).toBe("direct");
        if (decision.type === "direct") {
          expect(decision.tool).toBe("fs");
        }
      });
    });

    it("should select web tool for HTTP operations", () => {
      const webActions = ["fetch", "download", "request"];

      webActions.forEach((action) => {
        const intent: Intent = {
          action,
          parameters: {},
          complexity: "simple",
          confidence: 0.9,
          needsClarification: false,
        };

        const decision = router.route(intent, mockContext);

        expect(decision.type).toBe("direct");
        if (decision.type === "direct") {
          expect(decision.tool).toBe("web");
        }
      });
    });

    it("should select process tool for command execution", () => {
      const processActions = ["run", "execute", "exec", "command"];

      processActions.forEach((action) => {
        const intent: Intent = {
          action,
          parameters: {},
          complexity: "simple",
          confidence: 0.9,
          needsClarification: false,
        };

        const decision = router.route(intent, mockContext);

        expect(decision.type).toBe("direct");
        if (decision.type === "direct") {
          expect(decision.tool).toBe("process");
        }
      });
    });
  });

  describe("target inference", () => {
    const router = new Router();

    it("should infer fs tool from file path targets", () => {
      const intent: Intent = {
        action: "unknown",
        target: "config.json",
        parameters: {},
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.tool).toBe("fs");
      }
    });

    it("should infer web tool from URL targets", () => {
      const intent: Intent = {
        action: "unknown",
        target: "https://api.example.com/data",
        parameters: {},
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.tool).toBe("web");
        expect(decision.operation).toBe("fetch");
      }
    });

    it("should infer fs tool from directory targets", () => {
      const intent: Intent = {
        action: "unknown",
        target: "/home/user/",
        parameters: {},
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.tool).toBe("fs");
        expect(decision.operation).toBe("list");
      }
    });
  });

  describe("input building", () => {
    const router = new Router();

    it("should build correct inputs for read operation", () => {
      const intent: Intent = {
        action: "read",
        target: "/path/to/file.txt",
        parameters: { encoding: "utf-8" },
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.inputs.path).toBe("/path/to/file.txt");
        expect(decision.inputs.encoding).toBe("utf-8");
      }
    });

    it("should build correct inputs for fetch operation", () => {
      const intent: Intent = {
        action: "fetch",
        target: "https://api.example.com/users",
        parameters: { method: "GET" },
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.inputs.url).toBe("https://api.example.com/users");
        expect(decision.inputs.method).toBe("GET");
      }
    });

    it("should build correct inputs for exec operation", () => {
      const intent: Intent = {
        action: "run",
        target: "npm test",
        parameters: { cwd: "/project" },
        complexity: "simple",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("direct");
      if (decision.type === "direct") {
        expect(decision.inputs.command).toBe("npm test");
        expect(decision.inputs.cwd).toBe("/project");
      }
    });
  });

  describe("with tool registry", () => {
    it("should check tool availability from registry", () => {
      const registry = createMockToolRegistry(["fs", "web"]);
      const router = new Router({}, registry);

      expect(router.hasTools(["fs", "web"])).toBe(true);
      expect(router.hasTools(["fs", "process"])).toBe(false);
    });

    it("should return available tools in plan route", () => {
      const registry = createMockToolRegistry(["fs", "web", "process"]);
      const router = new Router({}, registry);

      const intent: Intent = {
        action: "research",
        parameters: {},
        complexity: "complex",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("plan");
      if (decision.type === "plan") {
        expect(decision.availableTools).toContain("fs");
        expect(decision.availableTools).toContain("web");
        expect(decision.availableTools).toContain("process");
      }
    });

    it("should generate tool descriptions", () => {
      const registry = createMockToolRegistry(["fs", "web"]);
      const router = new Router({}, registry);

      const descriptions = router.getToolDescriptions();

      expect(descriptions).toContain("fs");
      expect(descriptions).toContain("web");
    });
  });

  describe("goal building", () => {
    it("should build goal description with target", () => {
      const router = new Router();
      const intent: Intent = {
        action: "refactor",
        target: "src/",
        parameters: { language: "typescript" },
        complexity: "complex",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, mockContext);

      expect(decision.type).toBe("plan");
      if (decision.type === "plan") {
        expect(decision.goal).toContain("refactor");
        expect(decision.goal).toContain("src/");
        expect(decision.goal).toContain("language");
      }
    });

    it("should include context history in goal", () => {
      const router = new Router();
      const contextWithHistory: Context = {
        ...mockContext,
        history: [
          { role: "user", content: "Help me with project setup", timestamp: Date.now() },
          { role: "assistant", content: "I can help with that. What kind of project?", timestamp: Date.now() },
        ],
      };

      const intent: Intent = {
        action: "create",
        target: "project",
        parameters: {},
        complexity: "complex",
        confidence: 0.9,
        needsClarification: false,
      };

      const decision = router.route(intent, contextWithHistory);

      expect(decision.type).toBe("plan");
      if (decision.type === "plan") {
        expect(decision.goal).toContain("context");
      }
    });
  });
});
