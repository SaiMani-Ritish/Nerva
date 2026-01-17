/**
 * Filesystem tool - sandboxed file operations
 */

import { promises as fs } from "fs";
import * as path from "path";
import type { Tool, ToolResult } from "./types.js";

export interface FsInput {
  action: "read" | "write" | "list" | "search";
  path: string;
  content?: string;
  pattern?: string;
  encoding?: string;
}

export interface FilesystemPolicy {
  allowRoots: string[];
  denyPatterns: string[];
  denyPaths: string[];
  maxFileSize: number;
}

export class FilesystemTool implements Tool {
  name = "fs";
  description = "Filesystem operations (read, write, list, search)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read", "write", "list", "search"],
        description: "Operation to perform",
      },
      path: {
        type: "string",
        description: "File or directory path",
      },
      content: {
        type: "string",
        description: "Content to write (for write action)",
      },
      pattern: {
        type: "string",
        description: "Search pattern (regex) (for search action)",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf-8)",
      },
    },
    required: ["action", "path"],
  };

  private absoluteSandboxRoots: string[];
  private denyPatterns: RegExp[];
  private absoluteDenyPaths: string[];

  constructor(private policy: FilesystemPolicy) {
    this.absoluteSandboxRoots = policy.allowRoots.map((root) =>
      path.resolve(process.cwd(), root)
    );
    this.absoluteDenyPaths = policy.denyPaths.map((p) =>
      path.resolve(process.cwd(), p)
    );
    this.denyPatterns = policy.denyPatterns.map((p) => {
        // Simple glob-to-regex conversion for common cases
        // Replace ** with .* and * with [^/]*
        const regexStr = p
            .replace(/\*\*/g, ".*")
            .replace(/(?<!\.)\*/g, "[^/]*")
            .replace(/\?/g, ".");
        return new RegExp(regexStr);
    });
  }

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const fsInput = input as FsInput;

    try {
      if (!fsInput.action || !fsInput.path) {
        throw new Error("Missing required parameters: action, path");
      }

      const resolvedPath = path.resolve(fsInput.path);
      
      // Security check
      if (!this.isInSandbox(resolvedPath)) {
        throw new Error(`Access denied: Path '${fsInput.path}' is outside sandbox`);
      }

      let output: unknown;

      switch (fsInput.action) {
        case "read":
          output = await this.read(resolvedPath, fsInput.encoding || "utf-8");
          break;
        case "write":
          if (fsInput.content === undefined) {
            throw new Error("Missing required parameter: content");
          }
          await this.write(resolvedPath, fsInput.content, fsInput.encoding || "utf-8");
          output = "File written successfully";
          break;
        case "list":
          output = await this.list(resolvedPath);
          break;
        case "search":
          if (!fsInput.pattern) {
            throw new Error("Missing required parameter: pattern");
          }
          output = await this.search(resolvedPath, fsInput.pattern);
          break;
        default:
          throw new Error(`Unknown action: ${fsInput.action}`);
      }

      return {
        success: true,
        output,
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FS_ERROR",
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
   * Check if path is within sandbox roots and allowed by policy
   */
  private isInSandbox(resolvedPath: string): boolean {
    const isAllowed = this.absoluteSandboxRoots.some((root) =>
      resolvedPath.startsWith(root)
    );

    if (!isAllowed) return false;

    // Check deny paths
    if (this.absoluteDenyPaths.some((deny) => resolvedPath.startsWith(deny))) {
      return false;
    }

    // Check deny patterns
    // We check against the relative path from the sandbox root for pattern matching
    // or just the full path? Typically patterns match filenames or relative paths.
    // Let's check against the filename and the full path
    if (this.denyPatterns.some((regex) => regex.test(resolvedPath))) {
      return false;
    }

    return true;
  }

  private validatePath(targetPath: string): void {
    const resolvedPath = path.resolve(process.cwd(), targetPath);
    if (!this.isInSandbox(resolvedPath)) {
      throw new Error(`Access denied: Path '${targetPath}' is outside sandbox or blocked by policy`);
    }
  }

  /**
   * Read a file
   */
  private async read(resolvedPath: string, encoding: string): Promise<string> {
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.size > this.policy.maxFileSize) {
        throw new Error(`File size (${stats.size}) exceeds limit (${this.policy.maxFileSize})`);
      }

      const content = await fs.readFile(resolvedPath, {
        encoding: encoding as BufferEncoding,
      });
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  /**
   * Write a file
   */
  private async write(
    resolvedPath: string,
    content: string,
    encoding: string
  ): Promise<void> {
    try {
      if (content.length > this.policy.maxFileSize) {
        throw new Error(`Content size (${content.length}) exceeds limit (${this.policy.maxFileSize})`);
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, {
        encoding: encoding as BufferEncoding,
      });
    } catch (error) {
      throw new Error(`Failed to write file: ${(error as Error).message}`);
    }
  }

  /**
   * List directory contents
   */
  private async list(resolvedPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(resolvedPath);
      return files;
    } catch (error) {
       // If it's a file, return the filename
       try {
         const stat = await fs.stat(resolvedPath);
         if (stat.isFile()) {
             return [path.basename(resolvedPath)];
         }
       } catch {
         // Ignore stat error, bubble original error
       }
       throw new Error(`Failed to list directory: ${(error as Error).message}`);
    }
  }

  /**
   * Search for files matching pattern
   */
  private async search(resolvedPath: string, pattern: string): Promise<string[]> {
    try {
      const results: string[] = [];
      const regex = new RegExp(pattern);

      // Recursive search function
      const walk = async (dir: string) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isDirectory()) {
            await walk(filePath);
          } else {
            if (regex.test(file) || regex.test(filePath)) {
              // Return path relative to search root for cleaner output
              results.push(path.relative(resolvedPath, filePath));
            }
          }
        }
      };

      // Check if path exists
      await fs.access(resolvedPath);
      
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        await walk(resolvedPath);
      } else {
         // If it's a file, check if it matches
         if (regex.test(path.basename(resolvedPath))) {
             results.push(path.basename(resolvedPath));
         }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to search: ${(error as Error).message}`);
    }
  }
}
