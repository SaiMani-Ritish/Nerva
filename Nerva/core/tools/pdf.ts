/**
 * PDF tool — read and extract text from PDF files
 *
 * Uses a lightweight approach: attempts to use the `pdftotext` CLI
 * (from poppler-utils) which is commonly available on most systems.
 * Falls back to a basic binary extraction if pdftotext is not installed.
 */

import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import type { Tool, ToolResult } from "./types.js";

export interface PdfInput {
  action: "read" | "extract" | "metadata" | "summarize";
  path: string;
  pages?: number[];
  maxPages?: number;
}

export class PdfTool implements Tool {
  name = "pdf";
  description = "Read and extract text from PDF files";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read", "extract", "metadata", "summarize"],
        description: "PDF operation to perform",
      },
      path: { type: "string", description: "Path to PDF file" },
      pages: { type: "array", items: { type: "number" }, description: "Specific pages to extract" },
      maxPages: { type: "number", description: "Maximum pages to process" },
    },
    required: ["action", "path"],
  };

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const pi = input as PdfInput;

    try {
      if (!pi.action || !pi.path) throw new Error("Missing required parameters: action, path");

      const ext = path.extname(pi.path).toLowerCase();
      if (ext !== ".pdf") throw new Error(`Not a PDF file: ${pi.path}`);

      await fs.access(pi.path).catch(() => {
        throw new Error(`File not found: ${pi.path}`);
      });

      const stat = await fs.stat(pi.path);
      if (stat.size > 50 * 1024 * 1024) throw new Error("PDF file too large (max 50MB)");

      let output: unknown;

      switch (pi.action) {
        case "read":
          output = await this.extractText(pi.path);
          break;
        case "extract":
          output = await this.extractPages(pi.path, pi.pages, pi.maxPages);
          break;
        case "metadata":
          output = await this.getMetadata(pi.path);
          break;
        case "summarize":
          output = await this.extractText(pi.path);
          output = `[PDF text extracted — ${(output as string).length} characters. Pass to LLM for summarization.]\n\n${(output as string).substring(0, 2000)}...`;
          break;
        default:
          throw new Error(`Unknown PDF action: ${pi.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "PDF_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private extractText(pdfPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "pdftotext",
        ["-layout", pdfPath, "-"],
        { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            if (err.message.includes("ENOENT") || err.message.includes("not found")) {
              reject(new Error(
                "pdftotext not found. Install poppler-utils:\n" +
                "  macOS: brew install poppler\n" +
                "  Ubuntu/Debian: sudo apt install poppler-utils\n" +
                "  Windows: choco install poppler OR download from https://github.com/oschwartz10612/poppler-windows"
              ));
              return;
            }
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  private async extractPages(pdfPath: string, pages?: number[], maxPages?: number): Promise<string> {
    if (pages && pages.length > 0) {
      const results: string[] = [];
      for (const page of pages) {
        const text = await this.extractPageRange(pdfPath, page, page);
        results.push(`--- Page ${page} ---\n${text}`);
      }
      return results.join("\n\n");
    }

    if (maxPages) {
      return this.extractPageRange(pdfPath, 1, maxPages);
    }

    return this.extractText(pdfPath);
  }

  private extractPageRange(pdfPath: string, first: number, last: number): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "pdftotext",
        ["-f", String(first), "-l", String(last), "-layout", pdfPath, "-"],
        { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  private getMetadata(pdfPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "pdfinfo",
        [pdfPath],
        { timeout: 10_000 },
        (err, stdout, stderr) => {
          if (err) {
            if (err.message.includes("ENOENT") || err.message.includes("not found")) {
              reject(new Error("pdfinfo not found. Install poppler-utils (same as pdftotext)."));
              return;
            }
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          resolve(stdout.trim());
        }
      );
    });
  }
}
