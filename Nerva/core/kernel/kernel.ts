/**
 * Main Nerva kernel implementation
 * Orchestrates intent parsing, routing, tool/agent execution, and memory management
 */

import type { Context, Intent, Response, KernelConfig, Message } from "./types";
import { IntentParser } from "./intent-parser";
import { Router, RouteDecision } from "./router";
import { StateStore, TaskState } from "./state-store";
import { MessageBus } from "./message-bus";
import type { ToolRegistry, Tool, ToolResult } from "../tools/types";
import type { ModelAdapter } from "../models/types";
import { PlannerAgent } from "../agents/planner";
import { ExecutorAgent } from "../agents/executor";
import { SummarizerAgent } from "../agents/summarizer";
import { MemoryManager } from "../memory/memory-manager";

export interface KernelDependencies {
  modelAdapter: ModelAdapter;
  toolRegistry: ToolRegistry;
  memoryManager?: MemoryManager;
}

export type KernelEventType =
  | "intent_parsed"
  | "route_decided"
  | "tool_started"
  | "tool_completed"
  | "plan_created"
  | "step_started"
  | "step_completed"
  | "error"
  | "complete";

export interface KernelEvent {
  type: KernelEventType;
  data: unknown;
  timestamp: number;
}

export type KernelEventCallback = (event: KernelEvent) => void;

export class Kernel {
  private intentParser: IntentParser;
  private router: Router;
  private stateStore: StateStore;
  private messageBus: MessageBus;
  private modelAdapter: ModelAdapter;
  private toolRegistry: ToolRegistry;
  private memoryManager?: MemoryManager;
  private plannerAgent: PlannerAgent;
  private executorAgent: ExecutorAgent;
  private summarizerAgent: SummarizerAgent;
  private eventCallback?: KernelEventCallback;

  constructor(
    private config: KernelConfig,
    dependencies: KernelDependencies
  ) {
    this.modelAdapter = dependencies.modelAdapter;
    this.toolRegistry = dependencies.toolRegistry;
    this.memoryManager = dependencies.memoryManager;

    // Initialize components
    this.intentParser = new IntentParser(
      {
        availableTools: this.getToolNames(),
      },
      this.modelAdapter
    );

    this.router = new Router({}, this.toolRegistry);
    this.stateStore = new StateStore();
    this.messageBus = new MessageBus();

    // Initialize agents
    this.plannerAgent = new PlannerAgent(this.modelAdapter);
    this.executorAgent = new ExecutorAgent({
      getTool: (name: string) => this.toolRegistry.get(name),
      execute: (name: string, inputs: Record<string, unknown>) =>
        this.executeTool(name, inputs),
    });
    this.summarizerAgent = new SummarizerAgent(this.modelAdapter);

    // Connect summarizer to memory if available
    if (this.memoryManager) {
      this.memoryManager.setSummarizer((messages) =>
        this.summarizerAgent
          .compressConversation(messages)
          .then((s) => s.summary)
      );
    }
  }

  /**
   * Set event callback for progress updates
   */
  onEvent(callback: KernelEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Main processing loop: parse intent, route, execute, update memory
   */
  async process(input: string, context: Context): Promise<Response> {
    const startTime = Date.now();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create task state
    this.stateStore.create(taskId, { input, context });

    try {
      // Step 1: Parse intent
      const intent = await this.parseIntent(input);
      this.emit("intent_parsed", { intent });

      // Step 2: Check if clarification is needed
      if (intent.needsClarification) {
        return this.requestClarification(intent, startTime);
      }

      // Step 3: Route the intent
      const route = this.router.route(intent, context);
      this.emit("route_decided", { route });

      // Step 4: Execute based on route
      let result: unknown;
      switch (route.type) {
        case "direct":
          result = await this.executeDirectly(route, context);
          break;
        case "plan":
          result = await this.executePlan(route, context);
          break;
        case "clarify":
          return this.requestClarification(intent, startTime);
        case "respond":
          result = await this.generateResponse(route.message, context);
          break;
      }

      // Step 5: Update memory
      await this.updateMemory(input, intent, result, context);

      // Step 6: Complete task
      this.stateStore.update(taskId, {
        status: "completed",
        endTime: Date.now(),
        data: { result },
      });

      const response = this.buildSuccessResponse(result, startTime);
      this.emit("complete", { response });

      return response;
    } catch (error) {
      // Handle error
      this.stateStore.update(taskId, {
        status: "failed",
        endTime: Date.now(),
        data: { error: (error as Error).message },
      });

      const errorResponse = this.buildErrorResponse(error as Error, startTime);
      this.emit("error", { error: (error as Error).message });

      return errorResponse;
    }
  }

  /**
   * Parse intent from input
   */
  private async parseIntent(input: string): Promise<Intent> {
    return this.intentParser.parse(input);
  }

  /**
   * Request clarification from user
   */
  private requestClarification(intent: Intent, startTime: number): Response {
    const questions = intent.clarificationQuestions || [
      "Could you provide more details?",
    ];

    return {
      type: "clarification",
      content: questions.join("\n"),
      metadata: {
        duration_ms: Date.now() - startTime,
      },
    };
  }

  /**
   * Execute a direct tool call
   */
  private async executeDirectly(
    route: Extract<RouteDecision, { type: "direct" }>,
    _context: Context
  ): Promise<unknown> {
    this.emit("tool_started", { tool: route.tool, operation: route.operation });

    const result = await this.executeTool(route.tool, {
      operation: route.operation,
      ...route.inputs,
    });

    this.emit("tool_completed", { tool: route.tool, result });

    if (!result.success) {
      throw new Error(result.error?.message || "Tool execution failed");
    }

    return result.output;
  }

  /**
   * Execute tool by name
   */
  private async executeTool(
    toolName: string,
    inputs: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool not found: ${toolName}`,
          recoverable: false,
        },
        metadata: { duration_ms: 0 },
      };
    }

    try {
      return await tool.execute(inputs);
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: (error as Error).message,
          recoverable: true,
        },
        metadata: { duration_ms: 0 },
      };
    }
  }

  /**
   * Execute a multi-step plan
   */
  private async executePlan(
    route: Extract<RouteDecision, { type: "plan" }>,
    context: Context
  ): Promise<unknown> {
    // Step 1: Create a plan
    this.emit("plan_created", { goal: route.goal });

    const plan = await this.plannerAgent.createPlan({
      goal: route.goal,
      availableTools: route.availableTools,
      context: {
        threadId: context.threadId,
        historyLength: context.history.length,
      },
    });

    // Step 2: Execute the plan
    const result = await this.executorAgent.executePlan(plan, (update) => {
      if (update.type === "progress") {
        if (update.status === "running") {
          this.emit("step_started", {
            stepId: update.stepId,
            action: update.action,
          });
        } else if (update.status === "complete") {
          this.emit("step_completed", {
            stepId: update.stepId,
            action: update.action,
          });
        }
      }
    });

    return result;
  }

  /**
   * Generate a conversational response
   */
  private async generateResponse(
    prompt: string,
    context: Context
  ): Promise<string> {
    // Build conversation history for LLM
    const messages = context.history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    messages.push({
      role: "user" as const,
      content: prompt,
    });

    const response = await this.modelAdapter.generate(
      { messages },
      { maxTokens: 1000 }
    );

    return response.text;
  }

  /**
   * Update memory with interaction
   */
  private async updateMemory(
    input: string,
    intent: Intent,
    result: unknown,
    context: Context
  ): Promise<void> {
    if (!this.memoryManager) return;

    // Add user message
    await this.memoryManager.addUserMessage(context.threadId, input);

    // Add assistant response
    const responseContent = this.formatResult(result);
    await this.memoryManager.addAssistantMessage(
      context.threadId,
      responseContent
    );

    // Store in long-term memory if significant
    if (this.isSignificantInteraction(intent, result)) {
      await this.memoryManager.storeMemory({
        threadId: context.threadId,
        timestamp: Date.now(),
        content: `User: ${input}\nAssistant: ${responseContent.substring(0, 500)}`,
        metadata: {
          action: intent.action,
          complexity: intent.complexity,
        },
      });
    }
  }

  /**
   * Check if interaction is significant enough for long-term storage
   */
  private isSignificantInteraction(intent: Intent, _result: unknown): boolean {
    // Complex actions are always significant
    if (intent.complexity === "complex") {
      return true;
    }

    // Write/create/delete operations are significant
    const significantActions = ["write", "create", "delete", "execute", "run"];
    if (significantActions.includes(intent.action.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Build success response
   */
  private buildSuccessResponse(result: unknown, startTime: number): Response {
    return {
      type: "success",
      content: this.formatResult(result),
      metadata: {
        duration_ms: Date.now() - startTime,
      },
    };
  }

  /**
   * Build error response
   */
  private buildErrorResponse(error: Error, startTime: number): Response {
    return {
      type: "error",
      content: this.formatError(error),
      metadata: {
        duration_ms: Date.now() - startTime,
      },
    };
  }

  /**
   * Format result for display
   */
  private formatResult(result: unknown): string {
    if (typeof result === "string") {
      return result;
    }

    if (result === null || result === undefined) {
      return "Operation completed successfully.";
    }

    // Handle execution results
    if (
      typeof result === "object" &&
      "results" in (result as Record<string, unknown>)
    ) {
      const execResult = result as { results: unknown[]; summary: string };
      return execResult.summary;
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format error for display
   */
  private formatError(error: Error): string {
    // Provide user-friendly error messages
    const errorPatterns: Record<string, string> = {
      ENOENT: "File or directory not found",
      EACCES: "Permission denied",
      ECONNREFUSED: "Connection refused",
      ETIMEDOUT: "Request timed out",
      "TOOL_NOT_FOUND": "The requested tool is not available",
    };

    for (const [pattern, message] of Object.entries(errorPatterns)) {
      if (error.message.includes(pattern)) {
        return `${message}: ${error.message}`;
      }
    }

    return `Error: ${error.message}`;
  }

  /**
   * Emit kernel event
   */
  private emit(type: KernelEventType, data: unknown): void {
    if (this.eventCallback) {
      this.eventCallback({
        type,
        data,
        timestamp: Date.now(),
      });
    }

    // Also publish to message bus
    this.messageBus.publish(`kernel:${type}`, data);
  }

  /**
   * Get available tool names
   */
  private getToolNames(): string[] {
    return this.toolRegistry.list().map((t) => t.name);
  }

  /**
   * Get current task states
   */
  getActiveTasks(): TaskState[] {
    return this.stateStore.list().filter((t) => t.status === "running");
  }

  /**
   * Get memory manager instance
   */
  getMemoryManager(): MemoryManager | undefined {
    return this.memoryManager;
  }

  /**
   * Subscribe to kernel events via message bus
   */
  subscribe(event: string, handler: (data: unknown) => void): () => void {
    return this.messageBus.subscribe(`kernel:${event}`, handler);
  }

  /**
   * Cleanup old tasks
   */
  cleanup(): number {
    return this.stateStore.cleanup();
  }
}
