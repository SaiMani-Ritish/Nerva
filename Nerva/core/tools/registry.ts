/**
 * Tool registry - manages available tools
 */

import type { Tool, ToolRegistry } from "./types";

export class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool descriptions for LLM prompt
   */
  getDescriptions(): string {
    return this.list()
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");
  }
}

