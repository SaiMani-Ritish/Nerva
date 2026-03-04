/**
 * Git tool — version control operations via git CLI
 */

import { execFile } from "child_process";
import type { Tool, ToolResult } from "./types.js";

export interface GitInput {
  action:
    | "status"
    | "commit"
    | "push"
    | "pull"
    | "diff"
    | "log"
    | "branch"
    | "checkout"
    | "add"
    | "clone";
  message?: string;
  branch?: string;
  remote?: string;
  path?: string;
  count?: number;
  url?: string;
}

export interface GitPolicy {
  allowPush: boolean;
  allowForcePush: boolean;
  allowedRemotes: string[];
  maxLogCount: number;
}

export class GitTool implements Tool {
  name = "git";
  description = "Git version control operations (status, commit, diff, log, branch, etc.)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["status", "commit", "push", "pull", "diff", "log", "branch", "checkout", "add", "clone"],
        description: "Git operation to perform",
      },
      message: { type: "string", description: "Commit message" },
      branch: { type: "string", description: "Branch name" },
      remote: { type: "string", description: "Remote name (default: origin)" },
      path: { type: "string", description: "File path for add/diff" },
      count: { type: "number", description: "Number of log entries" },
      url: { type: "string", description: "Repository URL for clone" },
    },
    required: ["action"],
  };

  constructor(private policy: GitPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const gi = input as GitInput;

    try {
      if (!gi.action) throw new Error("Missing required parameter: action");

      let output: unknown;

      switch (gi.action) {
        case "status":
          output = await this.run(["status", "--porcelain=v1"]);
          break;
        case "add":
          output = await this.run(["add", gi.path || "."]);
          break;
        case "commit":
          if (!gi.message) throw new Error("Missing required parameter: message");
          output = await this.run(["commit", "-m", gi.message]);
          break;
        case "push":
          if (!this.policy.allowPush) throw new Error("Push is disabled by policy");
          output = await this.run(["push", gi.remote || "origin", gi.branch || "HEAD"]);
          break;
        case "pull":
          output = await this.run(["pull", gi.remote || "origin", gi.branch || ""]);
          break;
        case "diff":
          output = await this.run(gi.path ? ["diff", gi.path] : ["diff"]);
          break;
        case "log": {
          const count = Math.min(gi.count || 10, this.policy.maxLogCount);
          output = await this.run(["log", `--oneline`, `-${count}`]);
          break;
        }
        case "branch":
          output = gi.branch
            ? await this.run(["branch", gi.branch])
            : await this.run(["branch", "-a"]);
          break;
        case "checkout":
          if (!gi.branch) throw new Error("Missing required parameter: branch");
          output = await this.run(["checkout", gi.branch]);
          break;
        case "clone":
          if (!gi.url) throw new Error("Missing required parameter: url");
          output = await this.run(["clone", gi.url, gi.path || ""]);
          break;
        default:
          throw new Error(`Unknown git action: ${gi.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "GIT_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private run(args: string[]): Promise<string> {
    const filtered = args.filter((a) => a !== "");
    return new Promise((resolve, reject) => {
      execFile("git", filtered, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(stdout.trim() || stderr.trim());
      });
    });
  }
}
