/**
 * Planner agent - decomposes goals into executable steps
 */

import type { Plan, PlanStep } from "./types";
import type { ModelAdapter, Prompt } from "../models/types";

export interface PlannerInput {
  goal: string;
  availableTools: string[];
  context?: Record<string, unknown>;
}

export interface PlannerConfig {
  maxSteps?: number;
  maxCost?: number;
  maxTimeMs?: number;
}

const PLANNER_SYSTEM_PROMPT = `You are the Planning Agent for Nerva OS. Your role is to analyze user goals and create detailed, executable plans.

## Responsibilities

1. Decompose complex goals into simple, atomic steps
2. Select appropriate tools for each step
3. Identify dependencies between steps
4. Estimate time and cost for the entire plan
5. Optimize for efficiency (parallel execution when possible)

## Output Format

Return a valid JSON plan:

{
  "steps": [
    {
      "id": number,
      "action": string,
      "tool": string,
      "inputs": object,
      "rationale": string,
      "dependsOn": number[] | null,
      "estimatedTimeMs": number
    }
  ],
  "totalEstimatedTimeMs": number,
  "totalEstimatedCost": number,
  "parallelizable": boolean,
  "risks": string[]
}

## Planning Guidelines

1. **Atomic Steps**: Each step should do one thing
2. **Explicit Dependencies**: Use dependsOn to order steps
3. **Error Handling**: Consider what could go wrong
4. **Optimization**: Parallelize independent steps
5. **Cost Awareness**: Prefer cheaper tools when possible

## Constraints

- Maximum 20 steps per plan
- Each step must use an available tool
- Total estimated time must be reasonable (< 5 minutes)`;

export class PlannerAgent {
  private config: PlannerConfig;

  constructor(
    private modelAdapter: ModelAdapter,
    config?: PlannerConfig
  ) {
    this.config = {
      maxSteps: config?.maxSteps ?? 20,
      maxCost: config?.maxCost ?? 10.0,
      maxTimeMs: config?.maxTimeMs ?? 300000, // 5 minutes
    };
  }

  /**
   * Create a plan for achieving the goal
   */
  async createPlan(input: PlannerInput): Promise<Plan> {
    const prompt = this.buildPrompt(input);

    const response = await this.modelAdapter.generate(prompt, {
      maxTokens: 2000,
      temperature: 0.3, // Lower temperature for structured output
    });

    const plan = this.parsePlanResponse(response.text);
    this.validatePlan(plan, input.availableTools);

    return plan;
  }

  /**
   * Parse the LLM response into a Plan object
   */
  private parsePlanResponse(text: string): Plan {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = text;

    // Try to extract JSON from code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Normalize the response to our Plan type
      return {
        steps: (parsed.steps || []).map((step: Record<string, unknown>) => ({
          id: step.id as number,
          action: step.action as string,
          tool: step.tool as string,
          inputs: (step.inputs || {}) as Record<string, unknown>,
          rationale: (step.rationale || "") as string,
          dependsOn: (step.dependsOn || step.depends_on || null) as
            | number[]
            | null,
          estimatedTimeMs: (step.estimatedTimeMs ||
            step.estimated_time_ms ||
            1000) as number,
        })),
        totalEstimatedTimeMs:
          parsed.totalEstimatedTimeMs || parsed.total_estimated_time_ms || 0,
        totalEstimatedCost:
          parsed.totalEstimatedCost || parsed.total_estimated_cost || 0,
        parallelizable: parsed.parallelizable ?? false,
        risks: parsed.risks || [],
      };
    } catch (error) {
      throw new Error(
        `Failed to parse plan response: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validate a plan structure
   */
  private validatePlan(plan: Plan, availableTools: string[]): void {
    const errors: string[] = [];

    // Check step count
    if (plan.steps.length > this.config.maxSteps!) {
      errors.push(
        `Plan has ${plan.steps.length} steps, exceeds max of ${this.config.maxSteps}`
      );
    }

    // Check step IDs are unique
    const stepIds = new Set<number>();
    for (const step of plan.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Check dependencies reference valid steps
    for (const step of plan.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            errors.push(
              `Step ${step.id} depends on non-existent step ${depId}`
            );
          }
          if (depId >= step.id) {
            errors.push(
              `Step ${step.id} depends on step ${depId} which comes after or is same`
            );
          }
        }
      }
    }

    // Check all tools are available
    const toolSet = new Set(availableTools);
    for (const step of plan.steps) {
      if (!toolSet.has(step.tool)) {
        errors.push(`Step ${step.id} uses unavailable tool: ${step.tool}`);
      }
    }

    // Check cost constraint
    if (
      this.config.maxCost &&
      plan.totalEstimatedCost > this.config.maxCost
    ) {
      errors.push(
        `Estimated cost ${plan.totalEstimatedCost} exceeds max of ${this.config.maxCost}`
      );
    }

    // Check time constraint
    if (
      this.config.maxTimeMs &&
      plan.totalEstimatedTimeMs > this.config.maxTimeMs
    ) {
      errors.push(
        `Estimated time ${plan.totalEstimatedTimeMs}ms exceeds max of ${this.config.maxTimeMs}ms`
      );
    }

    if (errors.length > 0) {
      throw new Error(`Plan validation failed:\n${errors.join("\n")}`);
    }
  }

  /**
   * Build the planning prompt
   */
  private buildPrompt(input: PlannerInput): Prompt {
    const userMessage = JSON.stringify(
      {
        goal: input.goal,
        available_tools: input.availableTools,
        context: {
          ...input.context,
          max_cost: this.config.maxCost,
          max_time_ms: this.config.maxTimeMs,
        },
      },
      null,
      2
    );

    return {
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    };
  }

  /**
   * Check if a plan can be parallelized
   */
  static canParallelize(plan: Plan): boolean {
    // A plan is parallelizable if there exist steps with no dependencies
    // that can run at the same time
    const levels = PlannerAgent.getExecutionLevels(plan);
    return levels.some((level) => level.length > 1);
  }

  /**
   * Get execution levels for parallel execution
   * Each level contains steps that can be executed in parallel
   */
  static getExecutionLevels(plan: Plan): PlanStep[][] {
    const levels: PlanStep[][] = [];
    const completed = new Set<number>();

    while (completed.size < plan.steps.length) {
      const level: PlanStep[] = [];

      for (const step of plan.steps) {
        if (completed.has(step.id)) continue;

        // Check if all dependencies are completed
        const depsComplete =
          !step.dependsOn || step.dependsOn.every((id) => completed.has(id));

        if (depsComplete) {
          level.push(step);
        }
      }

      if (level.length === 0) {
        throw new Error("Circular dependency detected in plan");
      }

      for (const step of level) {
        completed.add(step.id);
      }

      levels.push(level);
    }

    return levels;
  }
}
