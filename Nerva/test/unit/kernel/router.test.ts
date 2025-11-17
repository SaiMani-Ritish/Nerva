/**
 * Router Tests
 */

import { describe, it, expect } from "vitest";
import { Router } from "../../../core/kernel/router";
import type { Intent, Context } from "../../../core/kernel/types";

describe("Router", () => {
  const router = new Router();

  const mockContext: Context = {
    threadId: "thread-1",
    userId: "user-1",
    history: [],
    metadata: {},
  };

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
      target: "files",
      parameters: { path: "/home" },
      complexity: "simple",
      confidence: 0.9,
      needsClarification: false,
    };

    const decision = router.route(intent, mockContext);

    expect(decision.type).toBe("direct");
    if (decision.type === "direct") {
      expect(decision.tool).toBe("fs");
      expect(decision.inputs).toEqual({ path: "/home" });
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
      expect(decision.agent).toBe("planner");
    }
  });

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
    const processActions = ["run", "execute", "command"];

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

  it("should infer fs tool from file-related targets", () => {
    const fileTargets = ["config.json", "folder", "directory", "path"];

    fileTargets.forEach((target) => {
      const intent: Intent = {
        action: "unknown",
        target,
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

  it("should infer web tool from URL-related targets", () => {
    const webTargets = ["http://example.com", "website", "api.com"];

    webTargets.forEach((target) => {
      const intent: Intent = {
        action: "unknown",
        target,
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

  it("should default to fs tool when tool cannot be determined", () => {
    const intent: Intent = {
      action: "mystery",
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

