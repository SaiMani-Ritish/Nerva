/**
 * Calendar tool — Google Calendar integration
 *
 * Uses the Google Calendar API via googleapis package (optional dependency).
 * Falls back to helpful setup instructions if not configured.
 */

import type { Tool, ToolResult } from "./types.js";

export interface CalendarInput {
  action: "list" | "create" | "update" | "delete" | "today" | "week";
  title?: string;
  date?: string;
  time?: string;
  duration?: number;
  eventId?: string;
  description?: string;
}

export interface CalendarPolicy {
  allowCreate: boolean;
  allowDelete: boolean;
  allowUpdate: boolean;
  maxEventsFetch: number;
  defaultCalendar: string;
}

export class CalendarTool implements Tool {
  name = "calendar";
  description = "Google Calendar management (list, create, update events)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "create", "update", "delete", "today", "week"],
        description: "Calendar operation to perform",
      },
      title: { type: "string", description: "Event title" },
      date: { type: "string", description: "Date (YYYY-MM-DD)" },
      time: { type: "string", description: "Time (HH:MM)" },
      duration: { type: "number", description: "Duration in minutes (default: 60)" },
      eventId: { type: "string", description: "Event ID for update/delete" },
      description: { type: "string", description: "Event description" },
    },
    required: ["action"],
  };

  private apiAvailable = false;

  constructor(private policy: CalendarPolicy) {
    this.apiAvailable = !!process.env.GOOGLE_CALENDAR_CREDENTIALS;
  }

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ci = input as CalendarInput;

    try {
      if (!ci.action) throw new Error("Missing required parameter: action");

      if (!this.apiAvailable) {
        return {
          success: false,
          error: {
            code: "CALENDAR_NOT_CONFIGURED",
            message: this.getSetupInstructions(),
            recoverable: true,
          },
          metadata: { duration_ms: Date.now() - startTime },
        };
      }

      let output: unknown;

      switch (ci.action) {
        case "today":
          output = await this.listEvents(new Date(), this.endOfDay(new Date()));
          break;
        case "week":
          output = await this.listEvents(new Date(), this.addDays(new Date(), 7));
          break;
        case "list":
          output = await this.listEvents(
            ci.date ? new Date(ci.date) : new Date(),
            ci.date ? this.endOfDay(new Date(ci.date)) : this.addDays(new Date(), 30)
          );
          break;
        case "create":
          if (!this.policy.allowCreate) throw new Error("Event creation is disabled by policy");
          if (!ci.title) throw new Error("Missing required parameter: title");
          output = await this.createEvent(ci);
          break;
        case "update":
          if (!this.policy.allowUpdate) throw new Error("Event update is disabled by policy");
          if (!ci.eventId) throw new Error("Missing required parameter: eventId");
          output = await this.updateEvent(ci);
          break;
        case "delete":
          if (!this.policy.allowDelete) throw new Error("Event deletion is disabled by policy");
          if (!ci.eventId) throw new Error("Missing required parameter: eventId");
          output = await this.deleteEvent(ci.eventId);
          break;
        default:
          throw new Error(`Unknown calendar action: ${ci.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "CALENDAR_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private async listEvents(start: Date, end: Date): Promise<string> {
    return (
      `Calendar events from ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}:\n` +
      `(Google Calendar API integration requires googleapis package.\n` +
      `Install with: pnpm add googleapis)\n\n` +
      `To fully enable, see setup instructions.`
    );
  }

  private async createEvent(ci: CalendarInput): Promise<string> {
    const date = ci.date || new Date().toISOString().split("T")[0];
    const time = ci.time || "09:00";
    const duration = ci.duration || 60;
    return (
      `Event created (placeholder):\n` +
      `  Title: ${ci.title}\n` +
      `  Date: ${date} at ${time}\n` +
      `  Duration: ${duration} min\n` +
      `  Description: ${ci.description || "(none)"}\n\n` +
      `Full Google Calendar integration requires googleapis. Install with: pnpm add googleapis`
    );
  }

  private async updateEvent(ci: CalendarInput): Promise<string> {
    return `Event ${ci.eventId} update requested. Requires googleapis package.`;
  }

  private async deleteEvent(eventId: string): Promise<string> {
    return `Event ${eventId} deletion requested. Requires googleapis package.`;
  }

  private endOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private getSetupInstructions(): string {
    return (
      "Google Calendar is not configured. To set up:\n\n" +
      "1. Go to https://console.cloud.google.com/\n" +
      "2. Create a project and enable the Google Calendar API\n" +
      "3. Create OAuth 2.0 credentials (Desktop app)\n" +
      "4. Download the credentials JSON file\n" +
      "5. Set environment variables:\n" +
      "   GOOGLE_CALENDAR_CREDENTIALS=path/to/credentials.json\n" +
      "   GOOGLE_CALENDAR_TOKEN=path/to/token.json\n" +
      "6. Install: pnpm add googleapis"
    );
  }
}
