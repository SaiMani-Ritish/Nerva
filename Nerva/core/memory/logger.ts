/**
 * Conversation logger - persists transcripts to disk
 */

import type { Message } from "./types";

export interface Transcript {
  threadId: string;
  startTime: number;
  endTime?: number;
  messages: Message[];
  metadata: Record<string, unknown>;
}

export class ConversationLogger {
  private transcripts: Map<string, Transcript> = new Map();

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
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      this.start(threadId);
    }

    this.transcripts.get(threadId)!.messages.push(message);
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
   * Save transcript to disk
   */
  async save(threadId: string, path: string): Promise<void> {
    // TODO(cursor): Implement filesystem persistence
    // Use fs tool to write transcript as JSON or markdown
    const transcript = this.transcripts.get(threadId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${threadId}`);
    }

    // Placeholder
    console.log(`Would save transcript ${threadId} to ${path}`);
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
    md += `**Started**: ${new Date(transcript.startTime).toISOString()}\n\n`;

    for (const msg of transcript.messages) {
      md += `## ${msg.role}\n\n`;
      md += `${msg.content}\n\n`;
      md += `*${new Date(msg.timestamp).toISOString()}*\n\n`;
      md += `---\n\n`;
    }

    return md;
  }
}

