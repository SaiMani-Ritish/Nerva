/**
 * Process tool - safe command execution with whitelist
 */

import { spawn } from "child_process";
import type { Tool, ToolResult } from "./types";

export interface ProcessExecInput {
  command: string;
  args: string[];
  cwd?: string;
  timeout?: number;
}

export interface ProcessExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessPolicy {
  whitelist: string[];
  blacklist: string[];
  timeout_seconds: number;
  max_output_size: number;
}

export class ProcessTool implements Tool {
  name = "process";
  description = "Execute system commands";
  parameters = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Command to execute",
      },
      args: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Command arguments",
      },
      cwd: {
        type: "string",
        description: "Current working directory",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds",
      },
    },
    required: ["command"],
  };

  constructor(private policy: ProcessPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const processInput = input as ProcessExecInput;

    try {
      if (!processInput.command) {
        throw new Error("Missing required parameter: command");
      }

      // Security check: blacklist first
      if (this.isBlacklisted(processInput.command)) {
        throw new Error(`Access denied: Command '${processInput.command}' is blacklisted`);
      }

      // Security check: whitelist
      if (!this.isWhitelisted(processInput.command)) {
        throw new Error(`Access denied: Command '${processInput.command}' is not whitelisted`);
      }

      // Execute command
      const output = await this.exec(processInput);

      return {
        success: output.exitCode === 0,
        output,
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "PROCESS_ERROR",
          message: (error as Error).message,
          recoverable: false,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute a command
   */
  private async exec(input: ProcessExecInput): Promise<ProcessExecOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn(input.command, input.args || [], {
        cwd: input.cwd,
        shell: false, // Security: disable shell execution
      });

      let stdout = "";
      let stderr = "";
      let outputLimitExceeded = false;

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        if (stdout.length + stderr.length > this.policy.max_output_size) {
          outputLimitExceeded = true;
          child.kill();
        }
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        if (stdout.length + stderr.length > this.policy.max_output_size) {
          outputLimitExceeded = true;
          child.kill();
        }
      });

      // Timeout handling
      const timeoutMs = input.timeout || this.policy.timeout_seconds * 1000;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (outputLimitExceeded) {
          reject(new Error(`Output size exceeded limit (${this.policy.max_output_size})`));
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code === null ? -1 : code,
        });
      });
    });
  }

  /**
   * Check if command is whitelisted
   */
  private isWhitelisted(command: string): boolean {
    return this.policy.whitelist.includes(command);
  }

  /**
   * Check if command is blacklisted
   */
  private isBlacklisted(command: string): boolean {
    return this.policy.blacklist.includes(command);
  }
}
