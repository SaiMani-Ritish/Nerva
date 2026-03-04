/**
 * Database tool — SQLite queries with security policies
 *
 * Uses the built-in Node.js child_process to run sqlite3 CLI,
 * so no native npm dependencies are required.
 */

import { execFile } from "child_process";
import * as path from "path";
import { promises as fs } from "fs";
import type { Tool, ToolResult } from "./types.js";

export interface DatabaseInput {
  action: "query" | "execute" | "tables" | "schema" | "connect";
  sql?: string;
  table?: string;
  database?: string;
  limit?: number;
}

export interface DatabasePolicy {
  allowedDatabases: string[];
  readOnly: boolean;
  allowWrite: boolean;
  maxRows: number;
  blockedOperations: string[];
  maxQueryTimeSeconds: number;
}

export class DatabaseTool implements Tool {
  name = "database";
  description = "SQLite database queries (query, tables, schema)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["query", "execute", "tables", "schema", "connect"],
        description: "Database operation to perform",
      },
      sql: { type: "string", description: "SQL query to execute" },
      table: { type: "string", description: "Table name for schema" },
      database: { type: "string", description: "Path to SQLite database file" },
      limit: { type: "number", description: "Max rows to return (default: 100)" },
    },
    required: ["action"],
  };

  private currentDb: string = "";

  constructor(private policy: DatabasePolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const di = input as DatabaseInput;

    try {
      if (!di.action) throw new Error("Missing required parameter: action");

      const dbPath = di.database || this.currentDb;

      if (di.action !== "connect" && !dbPath) {
        throw new Error("No database connected. Use action 'connect' with a database path first.");
      }

      if (dbPath) {
        this.validateDatabasePath(dbPath);
      }

      let output: unknown;

      switch (di.action) {
        case "connect":
          if (!di.database) throw new Error("Missing required parameter: database");
          await this.verifyDatabaseExists(di.database);
          this.currentDb = di.database;
          output = `Connected to ${di.database}`;
          break;
        case "tables":
          output = await this.runSql(dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
          break;
        case "schema":
          if (!di.table) throw new Error("Missing required parameter: table");
          output = await this.runSql(dbPath, `PRAGMA table_info(${di.table});`);
          break;
        case "query": {
          if (!di.sql) throw new Error("Missing required parameter: sql");
          this.validateSql(di.sql, false);
          const limit = Math.min(di.limit || 100, this.policy.maxRows);
          const sql = di.sql.replace(/;\s*$/, "");
          output = await this.runSql(dbPath, `${sql} LIMIT ${limit};`);
          break;
        }
        case "execute":
          if (!di.sql) throw new Error("Missing required parameter: sql");
          if (this.policy.readOnly && !this.policy.allowWrite) {
            throw new Error("Write operations are disabled by policy (read-only mode)");
          }
          this.validateSql(di.sql, true);
          output = await this.runSql(dbPath, di.sql);
          break;
        default:
          throw new Error(`Unknown database action: ${di.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private validateDatabasePath(dbPath: string): void {
    const resolved = path.resolve(dbPath);
    const allowed = this.policy.allowedDatabases.some((pattern) => {
      const globRegex = pattern
        .replace(/\*\*/g, ".*")
        .replace(/(?<!\.)\*/g, "[^/]*")
        .replace(/\?/g, ".");
      return new RegExp(globRegex).test(resolved) || new RegExp(globRegex).test(dbPath);
    });
    if (!allowed) {
      throw new Error(`Database path '${dbPath}' is not in the allowed list`);
    }
  }

  private async verifyDatabaseExists(dbPath: string): Promise<void> {
    try {
      await fs.access(dbPath);
    } catch {
      throw new Error(`Database file not found: ${dbPath}`);
    }
  }

  private validateSql(sql: string, isWrite: boolean): void {
    const upper = sql.toUpperCase().trim();
    for (const blocked of this.policy.blockedOperations) {
      if (upper.startsWith(blocked.toUpperCase())) {
        throw new Error(`Blocked SQL operation: ${blocked}`);
      }
    }
    if (!isWrite && (upper.startsWith("INSERT") || upper.startsWith("UPDATE") || upper.startsWith("DELETE"))) {
      throw new Error("Write operations require action 'execute', not 'query'");
    }
  }

  private runSql(dbPath: string, sql: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "sqlite3",
        ["-header", "-column", dbPath, sql],
        { timeout: this.policy.maxQueryTimeSeconds * 1000, maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          resolve(stdout.trim() || "Query executed successfully (no output).");
        }
      );
    });
  }
}
