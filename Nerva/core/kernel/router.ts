/**
 * Intent router - determines how to handle parsed intents
 */

import type { Intent, Context } from "./types";

export type RouteDecision =
  | { type: "direct"; tool: string; inputs: Record<string, unknown> }
  | { type: "plan"; agent: "planner" }
  | { type: "clarify"; questions: string[] };

export class Router {
  /**
   * Decide how to handle an intent based on complexity and available tools
   */
  route(intent: Intent, _context: Context): RouteDecision {
    // TODO(cursor): Implement routing logic
    // Simple intents -> direct tool execution
    // Complex intents -> planning agent
    // Ambiguous intents -> clarification

    if (intent.needsClarification) {
      return {
        type: "clarify",
        questions: intent.clarificationQuestions || [],
      };
    }

    if (intent.complexity === "simple") {
      return {
        type: "direct",
        tool: this.selectTool(intent),
        inputs: intent.parameters,
      };
    }

    return {
      type: "plan",
      agent: "planner",
    };
  }

  private selectTool(intent: Intent): string {
    // Map actions to tools based on intent
    const actionToTool: Record<string, string> = {
      // File operations
      list: "fs",
      read: "fs",
      write: "fs",
      search: "fs",
      create: "fs",
      delete: "fs",
      find: "fs",
      copy: "fs",
      move: "fs",

      // Web operations
      fetch: "web",
      download: "web",
      request: "web",
      get: "web",
      post: "web",

      // Process operations
      run: "process",
      execute: "process",
      command: "process",
      exec: "process",
    };

    const tool = actionToTool[intent.action.toLowerCase()];

    if (tool) {
      return tool;
    }

    // Fallback: Try to infer from target
    if (intent.target) {
      const target = intent.target.toLowerCase();

      // File/directory indicators
      if (/file|dir|folder|path|\.txt|\.json|\.md/i.test(target)) {
        return "fs";
      }

      // URL indicators
      if (/http|url|web|site|api|\.com|\.org/i.test(target)) {
        return "web";
      }

      // Command indicators
      if (/command|script|bash|shell/i.test(target)) {
        return "process";
      }
    }

    // Final fallback: default to fs as most common
    return "fs";
  }
}

