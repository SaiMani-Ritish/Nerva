/**
 * SSH tool — remote server commands via ssh CLI
 *
 * Uses the system ssh binary rather than a Node.js SSH library,
 * keeping dependencies minimal. Relies on SSH keys for auth.
 */

import { execFile } from "child_process";
import type { Tool, ToolResult } from "./types.js";

export interface SshInput {
  action: "exec" | "upload" | "download";
  host: string;
  command?: string;
  localPath?: string;
  remotePath?: string;
  port?: number;
  username?: string;
}

export interface SshPolicy {
  allowedHosts: string[];
  blockedCommands: string[];
  timeoutSeconds: number;
  allowUpload: boolean;
  allowDownload: boolean;
  maxTransferSize: number;
}

export class SshTool implements Tool {
  name = "ssh";
  description = "Execute commands on remote servers via SSH";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["exec", "upload", "download"],
        description: "SSH operation to perform",
      },
      host: { type: "string", description: "Remote host (e.g. user@server.com)" },
      command: { type: "string", description: "Command to execute remotely" },
      localPath: { type: "string", description: "Local file path for upload/download" },
      remotePath: { type: "string", description: "Remote file path for upload/download" },
      port: { type: "number", description: "SSH port (default: 22)" },
      username: { type: "string", description: "SSH username" },
    },
    required: ["action", "host"],
  };

  constructor(private policy: SshPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const si = input as SshInput;

    try {
      if (!si.action || !si.host) throw new Error("Missing required parameters: action, host");

      this.validateHost(si.host);

      let output: unknown;

      switch (si.action) {
        case "exec":
          if (!si.command) throw new Error("Missing required parameter: command");
          this.validateCommand(si.command);
          output = await this.remoteExec(si);
          break;
        case "upload":
          if (!this.policy.allowUpload) throw new Error("Upload is disabled by policy");
          if (!si.localPath || !si.remotePath) throw new Error("Missing required parameters: localPath, remotePath");
          output = await this.scpUpload(si);
          break;
        case "download":
          if (!this.policy.allowDownload) throw new Error("Download is disabled by policy");
          if (!si.remotePath || !si.localPath) throw new Error("Missing required parameters: remotePath, localPath");
          output = await this.scpDownload(si);
          break;
        default:
          throw new Error(`Unknown SSH action: ${si.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "SSH_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private validateHost(host: string): void {
    if (this.policy.allowedHosts.length === 0) {
      throw new Error(
        "SSH is disabled: no hosts are whitelisted. Add hosts to policies.yaml under ssh.allowed_hosts."
      );
    }
    const hostname = host.includes("@") ? host.split("@")[1] : host;
    const allowed = this.policy.allowedHosts.some((h) => {
      if (h === "*") return true;
      if (h.startsWith("*.")) return hostname.endsWith(h.slice(2));
      return hostname === h;
    });
    if (!allowed) throw new Error(`Host '${hostname}' is not in the allowed list`);
  }

  private validateCommand(command: string): void {
    for (const blocked of this.policy.blockedCommands) {
      if (command.includes(blocked)) {
        throw new Error(`Blocked command pattern: ${blocked}`);
      }
    }
  }

  private buildTarget(si: SshInput): string {
    return si.username ? `${si.username}@${si.host}` : si.host;
  }

  private remoteExec(si: SshInput): Promise<string> {
    const target = this.buildTarget(si);
    const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
    if (si.port) args.push("-p", String(si.port));
    args.push(target, si.command!);

    return new Promise((resolve, reject) => {
      execFile("ssh", args, { timeout: this.policy.timeoutSeconds * 1000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(stdout.trim() || stderr.trim());
      });
    });
  }

  private scpUpload(si: SshInput): Promise<string> {
    const target = this.buildTarget(si);
    const args = ["-o", "BatchMode=yes"];
    if (si.port) args.push("-P", String(si.port));
    args.push(si.localPath!, `${target}:${si.remotePath!}`);

    return new Promise((resolve, reject) => {
      execFile("scp", args, { timeout: this.policy.timeoutSeconds * 1000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(`Uploaded ${si.localPath} to ${target}:${si.remotePath}`);
      });
    });
  }

  private scpDownload(si: SshInput): Promise<string> {
    const target = this.buildTarget(si);
    const args = ["-o", "BatchMode=yes"];
    if (si.port) args.push("-P", String(si.port));
    args.push(`${target}:${si.remotePath!}`, si.localPath!);

    return new Promise((resolve, reject) => {
      execFile("scp", args, { timeout: this.policy.timeoutSeconds * 1000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(`Downloaded ${target}:${si.remotePath} to ${si.localPath}`);
      });
    });
  }
}
