/**
 * Tools module exports
 */

import { FilesystemTool } from "./fs.js";
import { WebTool } from "./web.js";
import { ProcessTool } from "./process.js";
import { GitTool } from "./git.js";
import { DockerTool } from "./docker.js";
import { CodeTool } from "./code.js";
import { ClipboardTool } from "./clipboard.js";
import { DatabaseTool } from "./database.js";
import { PdfTool } from "./pdf.js";
import { SshTool } from "./ssh.js";
import { EmailTool } from "./email.js";
import { CalendarTool } from "./calendar.js";
import { ImageTool } from "./image.js";
import { AudioTool } from "./audio.js";
import { ScreenshotTool } from "./screenshot.js";
import { loadConfig } from "../config/index.js";
import type { Tool } from "./types.js";

export { FilesystemTool } from "./fs.js";
export { WebTool } from "./web.js";
export { ProcessTool } from "./process.js";
export { GitTool } from "./git.js";
export { DockerTool } from "./docker.js";
export { CodeTool } from "./code.js";
export { ClipboardTool } from "./clipboard.js";
export { DatabaseTool } from "./database.js";
export { PdfTool } from "./pdf.js";
export { SshTool } from "./ssh.js";
export { EmailTool } from "./email.js";
export { CalendarTool } from "./calendar.js";
export { ImageTool } from "./image.js";
export { AudioTool } from "./audio.js";
export { ScreenshotTool } from "./screenshot.js";
export { ToolRegistryImpl } from "./registry.js";
export type * from "./types.js";

/**
 * Initialize all tools with configuration.
 * Only enabled tools (from tools.yaml) are instantiated.
 */
export async function createTools(): Promise<Tool[]> {
  const config = await loadConfig();
  const toolsCfg = config.tools?.tools || {};
  const policies = config.policies as any;
  const tools: Tool[] = [];

  // Core tools — always loaded
  tools.push(new FilesystemTool(policies.filesystem));
  tools.push(new WebTool(policies.network));
  tools.push(new ProcessTool(policies.commands));

  if (toolsCfg.git?.enabled !== false) {
    tools.push(new GitTool(policies.git ?? { allowPush: false, allowForcePush: false, allowedRemotes: ["origin"], maxLogCount: 100 }));
  }
  if (toolsCfg.code?.enabled !== false) {
    tools.push(new CodeTool());
  }
  if (toolsCfg.clipboard?.enabled !== false) {
    tools.push(new ClipboardTool(policies.clipboard ?? { allowRead: true, allowWrite: true, maxContentSize: 1048576 }));
  }
  if (toolsCfg.docker?.enabled) {
    tools.push(new DockerTool(policies.docker ?? { allowStart: true, allowStop: true, allowBuild: false, allowExec: false, allowRemove: false, maxLogLines: 500 }));
  }
  if (toolsCfg.database?.enabled) {
    tools.push(new DatabaseTool(policies.database ?? { allowedDatabases: ["./workspace/*.db"], readOnly: true, allowWrite: false, maxRows: 1000, blockedOperations: ["DROP", "TRUNCATE", "ALTER"], maxQueryTimeSeconds: 10 }));
  }
  if (toolsCfg.pdf?.enabled !== false) {
    tools.push(new PdfTool());
  }
  if (toolsCfg.ssh?.enabled) {
    tools.push(new SshTool(policies.ssh ?? { allowedHosts: [], blockedCommands: ["rm -rf", "dd"], timeoutSeconds: 30, allowUpload: false, allowDownload: true, maxTransferSize: 52428800 }));
  }
  if (toolsCfg.email?.enabled) {
    tools.push(new EmailTool(policies.email ?? { allowSend: false, allowedRecipients: [], blockedRecipients: [], maxAttachmentSize: 10485760, requireConfirmation: true }));
  }
  if (toolsCfg.calendar?.enabled) {
    tools.push(new CalendarTool(policies.calendar ?? { allowCreate: true, allowDelete: false, allowUpdate: true, maxEventsFetch: 50, defaultCalendar: "primary" }));
  }
  if (toolsCfg.image?.enabled) {
    tools.push(new ImageTool(policies.image ?? { model: "llava:7b", maxImageSize: 20971520, supportedFormats: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] }));
  }
  if (toolsCfg.audio?.enabled) {
    tools.push(new AudioTool(policies.audio ?? { transcriptionModel: "whisper", ttsEnabled: false, maxAudioSize: 26214400, supportedFormats: ["mp3", "wav", "ogg", "m4a", "flac"] }));
  }
  if (toolsCfg.screenshot?.enabled) {
    tools.push(new ScreenshotTool(policies.screenshot ?? { allowCapture: true, outputDirectory: "./scratch", maxCapturesPerMinute: 10 }));
  }

  return tools;
}
