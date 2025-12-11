/**
 * Logging system for Nerva
 */

import { promises as fs } from "fs";
import * as path from "path";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: unknown;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  console?: boolean;
  file?: string;
  json?: boolean;
  redactPatterns?: RegExp[];
}

/**
 * Logger class
 */
export class Logger {
  private level: LogLevel;
  private console: boolean;
  private filePath?: string;
  private json: boolean;
  private redactPatterns: RegExp[];
  private fileBuffer: string[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;

  constructor(
    private category: string,
    config: LoggerConfig = {}
  ) {
    this.level = config.level ?? LogLevel.INFO;
    this.console = config.console ?? true;
    this.filePath = config.file;
    this.json = config.json ?? false;
    this.redactPatterns = config.redactPatterns ?? [
      /api[_-]?key["']?\s*[:=]\s*["']?[\w-]+/gi,
      /password["']?\s*[:=]\s*["']?[^\s"']+/gi,
      /token["']?\s*[:=]\s*["']?[\w-]+/gi,
      /secret["']?\s*[:=]\s*["']?[\w-]+/gi,
      /bearer\s+[\w-]+/gi,
    ];

    // Set up file flush interval
    if (this.filePath) {
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  /**
   * Create a child logger with a sub-category
   */
  child(subCategory: string): Logger {
    return new Logger(`${this.category}:${subCategory}`, {
      level: this.level,
      console: this.console,
      file: this.filePath,
      json: this.json,
      redactPatterns: this.redactPatterns,
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      category: this.category,
      message: this.redact(message),
      data: data !== undefined ? this.redactData(data) : undefined,
    };

    if (this.console) {
      this.writeConsole(entry);
    }

    if (this.filePath) {
      this.fileBuffer.push(this.formatEntry(entry));
    }
  }

  /**
   * Write entry to console
   */
  private writeConsole(entry: LogEntry): void {
    const levelColors: Record<string, string> = {
      DEBUG: "\x1b[90m",  // Gray
      INFO: "\x1b[36m",   // Cyan
      WARN: "\x1b[33m",   // Yellow
      ERROR: "\x1b[31m",  // Red
    };
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";

    const color = levelColors[entry.level] || "";
    const time = dim + entry.timestamp.split("T")[1].split(".")[0] + reset;
    const level = color + entry.level.padEnd(5) + reset;
    const category = dim + `[${entry.category}]` + reset;

    let output = `${time} ${level} ${category} ${entry.message}`;

    if (entry.data !== undefined) {
      if (typeof entry.data === "object") {
        output += "\n" + JSON.stringify(entry.data, null, 2);
      } else {
        output += ` ${entry.data}`;
      }
    }

    switch (entry.level) {
      case "ERROR":
        console.error(output);
        break;
      case "WARN":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Format entry for file output
   */
  private formatEntry(entry: LogEntry): string {
    if (this.json) {
      return JSON.stringify(entry);
    }

    let line = `${entry.timestamp} [${entry.level}] ${entry.category}: ${entry.message}`;
    if (entry.data !== undefined) {
      line += ` ${JSON.stringify(entry.data)}`;
    }
    return line;
  }

  /**
   * Redact sensitive data from a string
   */
  private redact(text: string): string {
    let result = text;
    for (const pattern of this.redactPatterns) {
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }

  /**
   * Redact sensitive data from an object
   */
  private redactData(data: unknown): unknown {
    if (typeof data === "string") {
      return this.redact(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactData(item));
    }

    if (data && typeof data === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        // Redact sensitive keys
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("token") ||
          lowerKey.includes("apikey") ||
          lowerKey.includes("api_key")
        ) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = this.redactData(value);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Flush buffer to file
   */
  async flush(): Promise<void> {
    if (!this.filePath || this.fileBuffer.length === 0) return;

    const content = this.fileBuffer.join("\n") + "\n";
    this.fileBuffer = [];

    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.appendFile(this.filePath, content, "utf-8");
    } catch (error) {
      console.error("Failed to write log file:", error);
    }
  }

  /**
   * Close the logger
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(category: string, config?: LoggerConfig): Logger {
  // Check environment for log level
  const envLevel = process.env.NERVA_LOG_LEVEL?.toUpperCase();
  let level = config?.level ?? LogLevel.INFO;

  if (envLevel && envLevel in LogLevel) {
    level = LogLevel[envLevel as keyof typeof LogLevel];
  }

  return new Logger(category, {
    ...config,
    level,
  });
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create global logger
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger("nerva");
  }
  return globalLogger;
}

