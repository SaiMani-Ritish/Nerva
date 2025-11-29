/**
 * Conversation logger - persists transcripts to disk
 */

import { promises as fs } from "fs";
import * as path from "path";
import type { Message } from "./types";

export interface Transcript {
  threadId: string;
  startTime: number;
  endTime?: number;
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface LoggerConfig {
  basePath: string;
  format: "json" | "markdown";
}

export class ConversationLogger {
  private transcripts: Map<string, Transcript> = new Map();
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      basePath: config?.basePath || "./scratch/transcripts",
      format: config?.format || "json",
    };
  }

  /**
   * Start a new transcript
   */
  start(threadId: string, metadata: Record<string, unknown> = {}): void {
    this.transcripts.set(threadId, {
      threadId,
      startTime: Date.now(),
      messages: [],
      metadata,
    });
  }

  /**
   * Log a message to the transcript
   */
  log(threadId: string, message: Message): void {
    let transcript = this.transcripts.get(threadId);
    if (!transcript) {
      this.start(threadId);
      transcript = this.transcripts.get(threadId)!;
    }

    transcript.messages.push(message);
  }

  /**
   * Log multiple messages
   */
  logMany(threadId: string, messages: Message[]): void {
    for (const msg of messages) {
      this.log(threadId, msg);
    }
  }

  /**
   * End a transcript
   */
  end(threadId: string): Transcript | undefined {
    const transcript = this.transcripts.get(threadId);
    if (transcript) {
      transcript.endTime = Date.now();
    }
    return transcript;
  }

  /**
   * Get a transcript
   */
  get(threadId: string): Transcript | undefined {
    return this.transcripts.get(threadId);
  }

  /**
   * Get all active thread IDs
   */
  getActiveThreads(): string[] {
    return Array.from(this.transcripts.keys()).filter(
      (id) => !this.transcripts.get(id)?.endTime
    );
  }

  /**
   * Save transcript to disk
   */
  async save(threadId: string, customPath?: string): Promise<string> {
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${threadId}`);
    }

    const basePath = customPath || this.config.basePath;
    await fs.mkdir(basePath, { recursive: true });

    const timestamp = new Date(transcript.startTime).toISOString().replace(/[:.]/g, "-");
    const extension = this.config.format === "json" ? "json" : "md";
    const filename = `${threadId}-${timestamp}.${extension}`;
    const filePath = path.join(basePath, filename);

    const content =
      this.config.format === "json"
        ? JSON.stringify(transcript, null, 2)
        : this.exportMarkdown(threadId);

    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  }

  /**
   * Load transcript from disk
   */
  async load(filePath: string): Promise<Transcript> {
    const content = await fs.readFile(filePath, "utf-8");
    
    if (filePath.endsWith(".json")) {
      const transcript = JSON.parse(content) as Transcript;
      this.transcripts.set(transcript.threadId, transcript);
      return transcript;
    } else {
      throw new Error("Can only load JSON transcripts");
    }
  }

  /**
   * List saved transcripts
   */
  async listSaved(basePath?: string): Promise<string[]> {
    const dir = basePath || this.config.basePath;
    try {
      const files = await fs.readdir(dir);
      return files.filter((f) => f.endsWith(".json") || f.endsWith(".md"));
    } catch {
      return [];
    }
  }

  /**
   * Export transcript as markdown
   */
  exportMarkdown(threadId: string): string {
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${threadId}`);
    }

    let md = `# Thread: ${threadId}\n\n`;
    md += `**Started**: ${new Date(transcript.startTime).toISOString()}\n`;
    
    if (transcript.endTime) {
      md += `**Ended**: ${new Date(transcript.endTime).toISOString()}\n`;
      const duration = (transcript.endTime - transcript.startTime) / 1000;
      md += `**Duration**: ${duration.toFixed(1)}s\n`;
    }
    
    if (Object.keys(transcript.metadata).length > 0) {
      md += `\n**Metadata**:\n`;
      for (const [key, value] of Object.entries(transcript.metadata)) {
        md += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    md += `\n---\n\n`;

    for (const msg of transcript.messages) {
      const roleIcon = msg.role === "user" ? "👤" : msg.role === "assistant" ? "🤖" : "⚙️";
      md += `## ${roleIcon} ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n`;
      md += `${msg.content}\n\n`;
      md += `*${new Date(msg.timestamp).toISOString()}*`;
      if (msg.tokens) {
        md += ` • ${msg.tokens} tokens`;
      }
      md += `\n\n---\n\n`;
    }

    return md;
  }

  /**
   * Export transcript as JSON
   */
  exportJSON(threadId: string): string {
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${threadId}`);
    }
    return JSON.stringify(transcript, null, 2);
  }

  /**
   * Get transcript statistics
   */
  getStats(threadId: string): {
    messageCount: number;
    totalTokens: number;
    duration: number | null;
    byRole: Record<string, number>;
  } {
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${threadId}`);
    }

    const byRole: Record<string, number> = {};
    let totalTokens = 0;

    for (const msg of transcript.messages) {
      byRole[msg.role] = (byRole[msg.role] || 0) + 1;
      totalTokens += msg.tokens || 0;
    }

    return {
      messageCount: transcript.messages.length,
      totalTokens,
      duration: transcript.endTime
        ? transcript.endTime - transcript.startTime
        : null,
      byRole,
    };
  }

  /**
   * Delete a transcript from memory
   */
  remove(threadId: string): boolean {
    return this.transcripts.delete(threadId);
  }

  /**
   * Clear all transcripts from memory
   */
  clear(): void {
    this.transcripts.clear();
  }
}

