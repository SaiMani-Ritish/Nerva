/**
 * Docker tool — container management via docker CLI
 */

import { execFile } from "child_process";
import type { Tool, ToolResult } from "./types.js";

export interface DockerInput {
  action: "ps" | "images" | "logs" | "start" | "stop" | "restart" | "build" | "pull" | "exec";
  container?: string;
  image?: string;
  command?: string;
  tail?: number;
  all?: boolean;
}

export interface DockerPolicy {
  allowStart: boolean;
  allowStop: boolean;
  allowBuild: boolean;
  allowExec: boolean;
  allowRemove: boolean;
  maxLogLines: number;
}

export class DockerTool implements Tool {
  name = "docker";
  description = "Docker container management (ps, images, logs, start, stop, etc.)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["ps", "images", "logs", "start", "stop", "restart", "build", "pull", "exec"],
        description: "Docker operation to perform",
      },
      container: { type: "string", description: "Container name or ID" },
      image: { type: "string", description: "Image name" },
      command: { type: "string", description: "Command for exec" },
      tail: { type: "number", description: "Number of log lines (default: 100)" },
      all: { type: "boolean", description: "Show all containers (including stopped)" },
    },
    required: ["action"],
  };

  constructor(private policy: DockerPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const di = input as DockerInput;

    try {
      if (!di.action) throw new Error("Missing required parameter: action");

      let output: unknown;

      switch (di.action) {
        case "ps":
          output = await this.run(di.all ? ["ps", "-a", "--format", "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"] : ["ps", "--format", "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"]);
          break;
        case "images":
          output = await this.run(["images", "--format", "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"]);
          break;
        case "logs":
          if (!di.container) throw new Error("Missing required parameter: container");
          output = await this.run(["logs", "--tail", String(Math.min(di.tail || 100, this.policy.maxLogLines)), di.container]);
          break;
        case "start":
          if (!this.policy.allowStart) throw new Error("Start is disabled by policy");
          if (!di.container) throw new Error("Missing required parameter: container");
          output = await this.run(["start", di.container]);
          break;
        case "stop":
          if (!this.policy.allowStop) throw new Error("Stop is disabled by policy");
          if (!di.container) throw new Error("Missing required parameter: container");
          output = await this.run(["stop", di.container]);
          break;
        case "restart":
          if (!this.policy.allowStop) throw new Error("Restart is disabled by policy");
          if (!di.container) throw new Error("Missing required parameter: container");
          output = await this.run(["restart", di.container]);
          break;
        case "build":
          if (!this.policy.allowBuild) throw new Error("Build is disabled by policy");
          output = await this.run(["build", "-t", di.image || "nerva-build", "."]);
          break;
        case "pull":
          if (!di.image) throw new Error("Missing required parameter: image");
          output = await this.run(["pull", di.image]);
          break;
        case "exec":
          if (!this.policy.allowExec) throw new Error("Exec is disabled by policy");
          if (!di.container || !di.command) throw new Error("Missing required parameters: container, command");
          output = await this.run(["exec", di.container, "sh", "-c", di.command]);
          break;
        default:
          throw new Error(`Unknown docker action: ${di.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "DOCKER_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile("docker", args, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(stdout.trim() || stderr.trim());
      });
    });
  }
}
