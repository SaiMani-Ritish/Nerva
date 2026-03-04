/**
 * Screenshot tool — screen capture using platform-native commands
 *
 * macOS: screencapture
 * Linux: import (ImageMagick) or gnome-screenshot
 * Windows: PowerShell with .NET
 */

import { execFile, exec } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { platform } from "os";
import type { Tool, ToolResult } from "./types.js";

export interface ScreenshotInput {
  action: "capture" | "window" | "region";
  outputPath?: string;
  windowTitle?: string;
  region?: { x: number; y: number; width: number; height: number };
}

export interface ScreenshotPolicy {
  allowCapture: boolean;
  outputDirectory: string;
  maxCapturesPerMinute: number;
}

export class ScreenshotTool implements Tool {
  name = "screenshot";
  description = "Capture screenshots of the screen, windows, or regions";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["capture", "window", "region"],
        description: "Screenshot operation to perform",
      },
      outputPath: { type: "string", description: "Output file path" },
      windowTitle: { type: "string", description: "Window title for window capture" },
      region: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        description: "Screen region to capture",
      },
    },
    required: ["action"],
  };

  private captureTimestamps: number[] = [];

  constructor(private policy: ScreenshotPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const si = input as ScreenshotInput;

    try {
      if (!si.action) throw new Error("Missing required parameter: action");
      if (!this.policy.allowCapture) throw new Error("Screenshot capture is disabled by policy");

      this.checkRateLimit();

      await fs.mkdir(path.resolve(this.policy.outputDirectory), { recursive: true });

      const outputPath = si.outputPath || path.join(
        this.policy.outputDirectory,
        `screenshot-${Date.now()}.png`
      );

      let output: string;

      switch (si.action) {
        case "capture":
          output = await this.captureScreen(outputPath);
          break;
        case "window":
          output = await this.captureWindow(outputPath, si.windowTitle);
          break;
        case "region":
          if (!si.region) throw new Error("Missing required parameter: region");
          output = await this.captureRegion(outputPath, si.region);
          break;
        default:
          throw new Error(`Unknown screenshot action: ${si.action}`);
      }

      this.captureTimestamps.push(Date.now());

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "SCREENSHOT_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private checkRateLimit(): void {
    const now = Date.now();
    this.captureTimestamps = this.captureTimestamps.filter((t) => now - t < 60_000);
    if (this.captureTimestamps.length >= this.policy.maxCapturesPerMinute) {
      throw new Error(`Rate limit exceeded: max ${this.policy.maxCapturesPerMinute} captures per minute`);
    }
  }

  private captureScreen(outputPath: string): Promise<string> {
    const os = platform();

    if (os === "darwin") {
      return this.execCmd("screencapture", ["-x", outputPath], outputPath);
    } else if (os === "win32") {
      return this.windowsCapture(outputPath);
    } else {
      return this.execCmd("import", ["-window", "root", outputPath], outputPath);
    }
  }

  private captureWindow(outputPath: string, windowTitle?: string): Promise<string> {
    const os = platform();

    if (os === "darwin") {
      return windowTitle
        ? this.execCmd("screencapture", ["-l", windowTitle, "-x", outputPath], outputPath)
        : this.execCmd("screencapture", ["-w", "-x", outputPath], outputPath);
    } else if (os === "win32") {
      return this.windowsCapture(outputPath);
    } else {
      return this.execCmd("import", [outputPath], outputPath);
    }
  }

  private captureRegion(
    outputPath: string,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    const os = platform();
    const { x, y, width, height } = region;

    if (os === "darwin") {
      return this.execCmd("screencapture", ["-R", `${x},${y},${width},${height}`, "-x", outputPath], outputPath);
    } else if (os === "win32") {
      return this.windowsCapture(outputPath, region);
    } else {
      return this.execCmd("import", ["-crop", `${width}x${height}+${x}+${y}`, outputPath], outputPath);
    }
  }

  private execCmd(cmd: string, args: string[], outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout: 10_000 }, (err, _stdout, stderr) => {
        if (err) {
          if (err.message.includes("ENOENT")) {
            reject(new Error(`${cmd} not found. Install the required screenshot tool for your platform.`));
            return;
          }
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(`Screenshot saved to ${outputPath}`);
      });
    });
  }

  private windowsCapture(
    outputPath: string,
    region?: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    const script = region
      ? `Add-Type -AssemblyName System.Windows.Forms; $b = New-Object System.Drawing.Bitmap(${region.width},${region.height}); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(${region.x},${region.y},0,0,$b.Size); $b.Save('${outputPath.replace(/'/g, "''")}'); $g.Dispose(); $b.Dispose()`
      : `Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b = New-Object System.Drawing.Bitmap($s.Width,$s.Height); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0,0,0,0,$s.Size); $b.Save('${outputPath.replace(/'/g, "''")}'); $g.Dispose(); $b.Dispose()`;

    return new Promise((resolve, reject) => {
      exec(`powershell -NoProfile -Command "${script}"`, { timeout: 10_000 }, (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(`Screenshot saved to ${outputPath}`);
      });
    });
  }
}
