/**
 * Clipboard tool — system clipboard read/write
 *
 * Uses platform-native commands (pbcopy/pbpaste on macOS,
 * xclip on Linux, clip/powershell on Windows) so no npm deps needed.
 */

import { execFile, exec } from "child_process";
import { platform } from "os";
import type { Tool, ToolResult } from "./types.js";

export interface ClipboardInput {
  action: "read" | "write";
  content?: string;
}

export interface ClipboardPolicy {
  allowRead: boolean;
  allowWrite: boolean;
  maxContentSize: number;
}

export class ClipboardTool implements Tool {
  name = "clipboard";
  description = "Read from or write to the system clipboard";
  parameters = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["read", "write"], description: "Operation to perform" },
      content: { type: "string", description: "Content to write to clipboard" },
    },
    required: ["action"],
  };

  constructor(private policy: ClipboardPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ci = input as ClipboardInput;

    try {
      if (!ci.action) throw new Error("Missing required parameter: action");

      let output: unknown;

      switch (ci.action) {
        case "read":
          if (!this.policy.allowRead) throw new Error("Clipboard read is disabled by policy");
          output = await this.readClipboard();
          break;
        case "write":
          if (!this.policy.allowWrite) throw new Error("Clipboard write is disabled by policy");
          if (!ci.content) throw new Error("Missing required parameter: content");
          if (ci.content.length > this.policy.maxContentSize) {
            throw new Error(`Content size (${ci.content.length}) exceeds limit (${this.policy.maxContentSize})`);
          }
          await this.writeClipboard(ci.content);
          output = "Content written to clipboard";
          break;
        default:
          throw new Error(`Unknown clipboard action: ${ci.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "CLIPBOARD_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private readClipboard(): Promise<string> {
    const os = platform();
    return new Promise((resolve, reject) => {
      let cmd: string;
      let args: string[];

      if (os === "darwin") {
        cmd = "pbpaste";
        args = [];
      } else if (os === "win32") {
        cmd = "powershell";
        args = ["-NoProfile", "-Command", "Get-Clipboard"];
      } else {
        cmd = "xclip";
        args = ["-selection", "clipboard", "-o"];
      }

      execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
        if (err) {
          reject(new Error(`Failed to read clipboard: ${err.message}`));
          return;
        }
        resolve(stdout);
      });
    });
  }

  private writeClipboard(content: string): Promise<void> {
    const os = platform();
    return new Promise((resolve, reject) => {
      let child: ReturnType<typeof exec>;

      if (os === "darwin") {
        child = exec("pbcopy", { timeout: 5000 }, (err) => {
          if (err) reject(new Error(`Failed to write clipboard: ${err.message}`));
          else resolve();
        });
      } else if (os === "win32") {
        child = exec("clip", { timeout: 5000 }, (err) => {
          if (err) reject(new Error(`Failed to write clipboard: ${err.message}`));
          else resolve();
        });
      } else {
        child = exec("xclip -selection clipboard", { timeout: 5000 }, (err) => {
          if (err) reject(new Error(`Failed to write clipboard: ${err.message}`));
          else resolve();
        });
      }

      child.stdin?.write(content);
      child.stdin?.end();
    });
  }
}
