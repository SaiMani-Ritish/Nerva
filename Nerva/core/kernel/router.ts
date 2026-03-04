/**
 * Intent router - determines how to handle parsed intents
 */

import type { Intent, Context } from "./types.js";
import type { ToolRegistry } from "../tools/types.js";

export type RouteDecision =
  | { type: "direct"; tool: string; operation: string; inputs: Record<string, unknown> }
  | { type: "plan"; goal: string; availableTools: string[] }
  | { type: "clarify"; questions: string[] }
  | { type: "respond"; message: string };

export interface RouterConfig {
  complexityThreshold?: number;
  preferDirectExecution?: boolean;
}

export class Router {
  private toolRegistry?: ToolRegistry;
  private config: RouterConfig;

  constructor(config?: RouterConfig, toolRegistry?: ToolRegistry) {
    this.config = {
      complexityThreshold: config?.complexityThreshold ?? 0.7,
      preferDirectExecution: config?.preferDirectExecution ?? true,
    };
    this.toolRegistry = toolRegistry;
  }

  /**
   * Set the tool registry
   */
  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry;
  }

  /**
   * Decide how to handle an intent based on complexity and available tools
   */
  route(intent: Intent, context: Context): RouteDecision {
    // Check for clarification first
    if (intent.needsClarification) {
      return {
        type: "clarify",
        questions: intent.clarificationQuestions || [
          "Could you provide more details?",
        ],
      };
    }

    // Check for conversational/explanation requests
    if (this.isConversational(intent)) {
      return {
        type: "respond",
        message: this.buildConversationalResponse(intent, context),
      };
    }

    // Get available tools
    const availableTools = this.getAvailableTools();

    // Simple intents -> try direct tool execution
    if (intent.complexity === "simple" && this.config.preferDirectExecution) {
      const directRoute = this.tryDirectRoute(intent, availableTools);
      if (directRoute) {
        return directRoute;
      }
    }

    // Complex intents or no direct route -> planning
    return {
      type: "plan",
      goal: this.buildGoalDescription(intent, context),
      availableTools,
    };
  }

  /**
   * Check if this is a conversational/explanation request
   */
  private isConversational(intent: Intent): boolean {
    const conversationalActions = [
      // Questions/explanations
      "explain",
      "describe",
      "what",
      "how",
      "why",
      "help",
      "tell",
      "can",
      "do",
      // Greetings
      "hello",
      "hi",
      "hey",
      "greet",
      "chat",
      "talk",
      // General
      "unknown",
    ];
    
    const action = intent.action.toLowerCase();
    
    // Check if action matches conversational patterns
    if (conversationalActions.includes(action)) {
      return true;
    }
    
    // Check if target is about capabilities/self
    if (intent.target) {
      const target = intent.target.toLowerCase();
      if (target.includes("you") || target.includes("capability") || target.includes("help")) {
        return true;
      }
    }
    
    // No tool-specific target = likely conversational
    if (!intent.target || intent.target === "") {
      return true;
    }
    
    return false;
  }

  /**
   * Build a conversational response prompt
   * Returns the original user input with context for the LLM
   */
  private buildConversationalResponse(intent: Intent, _context: Context): string {
    // Return the original input for the LLM to respond to naturally
    // Combine action and target to reconstruct the user's question
    if (intent.target) {
      return `${intent.action} ${intent.target}`.trim();
    }
    return intent.action;
  }

  /**
   * Try to create a direct route to a tool
   */
  private tryDirectRoute(
    intent: Intent,
    availableTools: string[]
  ): RouteDecision | null {
    const { tool, operation } = this.selectToolAndOperation(intent);

    if (!tool) {
      return null;
    }

    // Verify tool is available
    if (!availableTools.includes(tool)) {
      return null;
    }

    // Build inputs from intent
    const inputs = this.buildToolInputs(intent, operation);

    return {
      type: "direct",
      tool,
      operation,
      inputs,
    };
  }

  /**
   * Select the appropriate tool and operation for an intent
   */
  private selectToolAndOperation(intent: Intent): {
    tool: string | null;
    operation: string;
  } {
    const actionMapping: Record<string, { tool: string; operation: string }> = {
      // Filesystem operations
      read: { tool: "fs", operation: "read" },
      write: { tool: "fs", operation: "write" },
      list: { tool: "fs", operation: "list" },
      search: { tool: "fs", operation: "search" },
      find: { tool: "fs", operation: "search" },
      create: { tool: "fs", operation: "write" },
      delete: { tool: "fs", operation: "delete" },
      copy: { tool: "fs", operation: "copy" },
      move: { tool: "fs", operation: "move" },
      open: { tool: "fs", operation: "read" },
      show: { tool: "fs", operation: "read" },

      // Web operations
      fetch: { tool: "web", operation: "fetch" },
      download: { tool: "web", operation: "fetch" },
      get: { tool: "web", operation: "fetch" },
      post: { tool: "web", operation: "fetch" },
      request: { tool: "web", operation: "fetch" },

      // Process operations
      run: { tool: "process", operation: "exec" },
      execute: { tool: "process", operation: "exec" },
      exec: { tool: "process", operation: "exec" },
      command: { tool: "process", operation: "exec" },

      // Git operations
      commit: { tool: "git", operation: "commit" },
      push: { tool: "git", operation: "push" },
      pull: { tool: "git", operation: "pull" },
      diff: { tool: "git", operation: "diff" },
      log: { tool: "git", operation: "log" },
      branch: { tool: "git", operation: "branch" },
      checkout: { tool: "git", operation: "checkout" },
      stage: { tool: "git", operation: "add" },
      clone: { tool: "git", operation: "clone" },

      // Docker operations
      container: { tool: "docker", operation: "ps" },
      deploy: { tool: "docker", operation: "build" },

      // Code operations
      analyze: { tool: "code", operation: "analyze" },
      refactor: { tool: "code", operation: "refactor" },
      lint: { tool: "code", operation: "lint" },

      // Clipboard operations
      paste: { tool: "clipboard", operation: "read" },
      clipboard: { tool: "clipboard", operation: "read" },

      // Database operations
      query: { tool: "database", operation: "query" },
      select: { tool: "database", operation: "query" },
      insert: { tool: "database", operation: "execute" },

      // PDF operations
      pdf: { tool: "pdf", operation: "read" },
      extract: { tool: "pdf", operation: "extract" },

      // SSH operations
      ssh: { tool: "ssh", operation: "exec" },
      remote: { tool: "ssh", operation: "exec" },

      // Email operations
      email: { tool: "email", operation: "list" },
      send: { tool: "email", operation: "send" },
      mail: { tool: "email", operation: "send" },

      // Calendar operations
      schedule: { tool: "calendar", operation: "create" },
      meeting: { tool: "calendar", operation: "create" },
      calendar: { tool: "calendar", operation: "today" },
      appointment: { tool: "calendar", operation: "create" },

      // Image operations
      describe: { tool: "image", operation: "describe" },
      ocr: { tool: "image", operation: "ocr" },
      image: { tool: "image", operation: "describe" },

      // Audio operations
      transcribe: { tool: "audio", operation: "transcribe" },
      speak: { tool: "audio", operation: "speak" },
      record: { tool: "audio", operation: "transcribe" },

      // Screenshot operations
      screenshot: { tool: "screenshot", operation: "capture" },
      capture: { tool: "screenshot", operation: "capture" },
    };

    const mapping = actionMapping[intent.action.toLowerCase()];
    if (mapping) {
      return mapping;
    }

    // Try to infer from target
    if (intent.target) {
      const target = intent.target.toLowerCase();

      // URL detection
      if (target.startsWith("http://") || target.startsWith("https://")) {
        return { tool: "web", operation: "fetch" };
      }

      // File extension detection
      if (/\.\w+$/.test(target)) {
        return { tool: "fs", operation: "read" };
      }

      // Directory detection
      if (target.endsWith("/") || target.includes("directory")) {
        return { tool: "fs", operation: "list" };
      }
    }

    return { tool: null, operation: "unknown" };
  }

  /**
   * Build tool inputs from intent
   */
  private buildToolInputs(
    intent: Intent,
    operation: string
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = { ...intent.parameters };

    // Add target as appropriate parameter based on tool/operation
    if (intent.target) {
      switch (operation) {
        case "read":
        case "write":
        case "delete":
        case "analyze":
        case "explain":
        case "lint":
        case "complexity":
        case "refactor":
          inputs.path = intent.target;
          break;
        case "list":
          inputs.directory = intent.target;
          break;
        case "search":
          inputs.pattern = intent.target;
          break;
        case "fetch":
          inputs.url = intent.target;
          break;
        case "exec":
          inputs.command = intent.target;
          break;
        case "commit":
          inputs.message = intent.target;
          break;
        case "checkout":
        case "branch":
          inputs.branch = intent.target;
          break;
        case "clone":
          inputs.url = intent.target;
          break;
        case "query":
        case "execute":
          inputs.sql = intent.target;
          break;
        case "transcribe":
        case "describe":
        case "ocr":
        case "extract":
          inputs.path = intent.target;
          break;
        case "speak":
          inputs.text = intent.target;
          break;
        case "send":
          inputs.to = intent.target;
          break;
        default:
          inputs.target = intent.target;
      }
    }

    return inputs;
  }

  /**
   * Build a goal description for the planner
   */
  private buildGoalDescription(intent: Intent, context: Context): string {
    let goal = `Action: ${intent.action}`;

    if (intent.target) {
      goal += ` on "${intent.target}"`;
    }

    if (Object.keys(intent.parameters).length > 0) {
      goal += ` with parameters: ${JSON.stringify(intent.parameters)}`;
    }

    // Add relevant context
    if (context.history.length > 0) {
      const lastMessage = context.history[context.history.length - 1];
      if (lastMessage.role === "assistant") {
        goal += `. Previous context: "${lastMessage.content.substring(0, 100)}..."`;
      }
    }

    return goal;
  }

  /**
   * Get list of available tool names
   */
  private getAvailableTools(): string[] {
    if (this.toolRegistry) {
      return this.toolRegistry.list().map((t) => t.name);
    }
    return ["fs", "web", "process", "git", "code", "clipboard", "docker", "database", "pdf", "ssh", "email", "calendar", "image", "audio", "screenshot"];
  }

  /**
   * Check if a specific tool is available
   */
  hasTools(toolNames: string[]): boolean {
    const available = this.getAvailableTools();
    return toolNames.every((name) => available.includes(name));
  }

  /**
   * Get tool descriptions for prompts
   */
  getToolDescriptions(): string {
    if (this.toolRegistry) {
      return this.toolRegistry
        .list()
        .map((t) => `- ${t.name}: ${t.description}`)
        .join("\n");
    }
    return `- fs: File system operations
- web: HTTP requests and web fetching
- process: Execute system commands
- git: Git version control operations
- code: Code analysis, linting, and refactoring
- clipboard: System clipboard read/write
- docker: Docker container management
- database: SQLite database queries
- pdf: PDF reading and extraction
- ssh: Remote server commands via SSH
- email: Send and read emails
- calendar: Calendar management
- image: Image analysis via vision models
- audio: Audio transcription and text-to-speech
- screenshot: Screen capture`;
  }
}
