/**
 * Email tool — send and read emails
 *
 * Uses platform-native approaches:
 * - Sending: via `sendmail` CLI or SMTP with nodemailer (if installed)
 * - Reading: mock/placeholder for IMAP (requires nodemailer/imapflow which are optional deps)
 *
 * For MVP, sending uses a simple approach and reading returns mock data
 * until the user installs optional dependencies.
 */

import { execFile } from "child_process";
import type { Tool, ToolResult } from "./types.js";

export interface EmailInput {
  action: "send" | "read" | "list" | "search" | "reply";
  to?: string;
  subject?: string;
  body?: string;
  messageId?: string;
  query?: string;
  folder?: string;
  limit?: number;
}

export interface EmailPolicy {
  allowSend: boolean;
  allowedRecipients: string[];
  blockedRecipients: string[];
  maxAttachmentSize: number;
  requireConfirmation: boolean;
}

export class EmailTool implements Tool {
  name = "email";
  description = "Send and read emails";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["send", "read", "list", "search", "reply"],
        description: "Email operation to perform",
      },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Email body" },
      messageId: { type: "string", description: "Message ID for read/reply" },
      query: { type: "string", description: "Search query" },
      folder: { type: "string", description: "Email folder (default: INBOX)" },
      limit: { type: "number", description: "Max results (default: 10)" },
    },
    required: ["action"],
  };

  constructor(private policy: EmailPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ei = input as EmailInput;

    try {
      if (!ei.action) throw new Error("Missing required parameter: action");

      let output: unknown;

      switch (ei.action) {
        case "send":
          output = await this.sendEmail(ei);
          break;
        case "list":
          output = await this.listEmails(ei.folder || "INBOX", ei.limit || 10);
          break;
        case "read":
          if (!ei.messageId) throw new Error("Missing required parameter: messageId");
          output = await this.readEmail(ei.messageId);
          break;
        case "search":
          if (!ei.query) throw new Error("Missing required parameter: query");
          output = await this.searchEmails(ei.query, ei.limit || 10);
          break;
        case "reply":
          output = await this.sendEmail(ei);
          break;
        default:
          throw new Error(`Unknown email action: ${ei.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "EMAIL_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private async sendEmail(ei: EmailInput): Promise<string> {
    if (!this.policy.allowSend) {
      throw new Error("Email sending is disabled by policy. Enable it in policies.yaml under email.allow_send.");
    }
    if (!ei.to || !ei.subject || !ei.body) {
      throw new Error("Missing required parameters: to, subject, body");
    }

    this.validateRecipient(ei.to);

    if (this.policy.requireConfirmation) {
      return (
        `⚠️ Email confirmation required:\n` +
        `  To: ${ei.to}\n` +
        `  Subject: ${ei.subject}\n` +
        `  Body: ${ei.body.substring(0, 200)}${ei.body.length > 200 ? "..." : ""}\n\n` +
        `Confirm sending? (Set email.require_confirmation: false in policies.yaml to skip this)`
      );
    }

    return this.sendViaCli(ei.to, ei.subject, ei.body);
  }

  private validateRecipient(to: string): void {
    if (this.policy.blockedRecipients.length > 0) {
      for (const blocked of this.policy.blockedRecipients) {
        if (to.includes(blocked)) throw new Error(`Recipient '${to}' is blocked by policy`);
      }
    }
    if (this.policy.allowedRecipients.length > 0) {
      const allowed = this.policy.allowedRecipients.some((a) => to.includes(a));
      if (!allowed) throw new Error(`Recipient '${to}' is not in the allowed list`);
    }
  }

  private sendViaCli(to: string, subject: string, body: string): Promise<string> {
    const smtpHost = process.env.EMAIL_SMTP_HOST;
    const smtpUser = process.env.EMAIL_SMTP_USER;

    if (!smtpHost) {
      return Promise.resolve(
        "Email SMTP not configured. Set these environment variables:\n" +
        "  EMAIL_SMTP_HOST=smtp.gmail.com\n" +
        "  EMAIL_SMTP_PORT=587\n" +
        "  EMAIL_SMTP_USER=your@email.com\n" +
        "  EMAIL_SMTP_PASS=your-app-password\n\n" +
        "Or install nodemailer: pnpm add nodemailer"
      );
    }

    return new Promise((resolve, reject) => {
      const mailContent = `Subject: ${subject}\nTo: ${to}\nFrom: ${smtpUser || "nerva@localhost"}\n\n${body}`;
      const child = execFile(
        "sendmail",
        ["-t"],
        { timeout: 15_000 },
        (err, _stdout, stderr) => {
          if (err) {
            reject(new Error(`Failed to send email: ${stderr.trim() || err.message}`));
            return;
          }
          resolve(`Email sent to ${to}`);
        }
      );
      child.stdin?.write(mailContent);
      child.stdin?.end();
    });
  }

  private async listEmails(_folder: string, _limit: number): Promise<string> {
    const imapHost = process.env.EMAIL_IMAP_HOST;
    if (!imapHost) {
      return (
        "Email IMAP not configured. Set these environment variables:\n" +
        "  EMAIL_IMAP_HOST=imap.gmail.com\n" +
        "  EMAIL_IMAP_PORT=993\n" +
        "  EMAIL_SMTP_USER=your@email.com\n" +
        "  EMAIL_SMTP_PASS=your-app-password\n\n" +
        "Or install imapflow: pnpm add imapflow"
      );
    }
    return "IMAP email listing requires the imapflow package. Install with: pnpm add imapflow";
  }

  private async readEmail(_messageId: string): Promise<string> {
    return "Email reading requires the imapflow package. Install with: pnpm add imapflow";
  }

  private async searchEmails(_query: string, _limit: number): Promise<string> {
    return "Email searching requires the imapflow package. Install with: pnpm add imapflow";
  }
}
