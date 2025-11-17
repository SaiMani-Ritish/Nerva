/**
 * Tool system types
 */

export interface Tool {
  name: string;
  description: string;
  parameters: unknown; // JSON Schema
  execute(input: unknown): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: ToolError;
  metadata: {
    duration_ms: number;
    tokens_used?: number;
    cost?: number;
  };
}

export interface ToolError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestions?: string[];
}

export class ToolExecutionError extends Error {
  constructor(
    public toolName: string,
    public code: string,
    public recoverable: boolean,
    message: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
}

