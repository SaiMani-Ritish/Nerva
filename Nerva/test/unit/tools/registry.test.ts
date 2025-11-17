/**
 * Tool Registry Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistryImpl } from "../../../core/tools/registry";
import type { Tool } from "../../../core/tools/types";

describe("ToolRegistry", () => {
  let registry: ToolRegistryImpl;

  const mockTool: Tool = {
    name: "test-tool",
    description: "A test tool",
    parameters: {},
    execute: async () => ({
      success: true,
      metadata: { duration_ms: 0 },
    }),
  };

  beforeEach(() => {
    registry = new ToolRegistryImpl();
  });

  it("should register a tool", () => {
    registry.register(mockTool);
    const tool = registry.get("test-tool");

    expect(tool).toBeDefined();
    expect(tool?.name).toBe("test-tool");
  });

  it("should return undefined for non-existent tool", () => {
    const tool = registry.get("non-existent");
    expect(tool).toBeUndefined();
  });

  it("should list all registered tools", () => {
    const tool1: Tool = { ...mockTool, name: "tool-1" };
    const tool2: Tool = { ...mockTool, name: "tool-2" };

    registry.register(tool1);
    registry.register(tool2);

    const tools = registry.list();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["tool-1", "tool-2"])
    );
  });

  it("should replace tool if registered twice", () => {
    registry.register(mockTool);

    const updatedTool: Tool = {
      ...mockTool,
      description: "Updated description",
    };
    registry.register(updatedTool);

    const tool = registry.get("test-tool");
    expect(tool?.description).toBe("Updated description");
  });

  it("should generate tool descriptions for LLM", () => {
    registry.register({
      ...mockTool,
      name: "fs",
      description: "File system operations",
    });
    registry.register({
      ...mockTool,
      name: "web",
      description: "HTTP requests",
    });

    const descriptions = registry.getDescriptions();
    expect(descriptions).toContain("- fs: File system operations");
    expect(descriptions).toContain("- web: HTTP requests");
  });
});

