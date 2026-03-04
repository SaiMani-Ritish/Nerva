/**
 * Image tool — image analysis via Ollama vision models
 *
 * Sends images to a vision-capable LLM (e.g. llava) running on Ollama
 * for description, analysis, OCR, and comparison.
 */

import { promises as fs } from "fs";
import * as path from "path";
import type { Tool, ToolResult } from "./types.js";

export interface ImageInput {
  action: "analyze" | "describe" | "ocr" | "compare";
  path: string;
  question?: string;
  comparePath?: string;
}

export interface ImagePolicy {
  model: string;
  maxImageSize: number;
  supportedFormats: string[];
}

export class ImageTool implements Tool {
  name = "image";
  description = "Analyze images using vision models (describe, OCR, compare)";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["analyze", "describe", "ocr", "compare"],
        description: "Image operation to perform",
      },
      path: { type: "string", description: "Path to image file" },
      question: { type: "string", description: "Question about the image (for analyze)" },
      comparePath: { type: "string", description: "Second image path (for compare)" },
    },
    required: ["action", "path"],
  };

  private ollamaUrl: string;

  constructor(private policy: ImagePolicy) {
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  }

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ii = input as ImageInput;

    try {
      if (!ii.action || !ii.path) throw new Error("Missing required parameters: action, path");

      const ext = path.extname(ii.path).toLowerCase().replace(".", "");
      if (!this.policy.supportedFormats.includes(ext)) {
        throw new Error(`Unsupported image format: .${ext}. Supported: ${this.policy.supportedFormats.join(", ")}`);
      }

      const stat = await fs.stat(ii.path).catch(() => {
        throw new Error(`File not found: ${ii.path}`);
      });
      if (stat.size > this.policy.maxImageSize) {
        throw new Error(`Image too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: ${(this.policy.maxImageSize / 1024 / 1024).toFixed(1)}MB`);
      }

      const imageBase64 = await fs.readFile(ii.path, { encoding: "base64" });
      let output: unknown;

      switch (ii.action) {
        case "describe":
          output = await this.queryVision(imageBase64, "Describe this image in detail.");
          break;
        case "analyze":
          output = await this.queryVision(imageBase64, ii.question || "What do you see in this image?");
          break;
        case "ocr":
          output = await this.queryVision(imageBase64, "Extract all text visible in this image. Return only the text content.");
          break;
        case "compare":
          if (!ii.comparePath) throw new Error("Missing required parameter: comparePath");
          output = await this.compareImages(imageBase64, ii.comparePath);
          break;
        default:
          throw new Error(`Unknown image action: ${ii.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "IMAGE_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private async queryVision(imageBase64: string, prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.policy.model,
          prompt,
          images: [imageBase64],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 404 || errText.includes("not found")) {
          throw new Error(
            `Vision model '${this.policy.model}' not found. Install it:\n` +
            `  ollama pull ${this.policy.model}\n\n` +
            `Available vision models: llava, llava:13b, bakllava`
          );
        }
        throw new Error(`Ollama API error: ${response.status} - ${errText}`);
      }

      const data = await response.json() as { response: string };
      return data.response;
    } catch (error) {
      if ((error as Error).message.includes("ECONNREFUSED") || (error as Error).message.includes("fetch failed")) {
        throw new Error(
          "Ollama is not running. Start it with:\n" +
          "  ollama serve\n\n" +
          `Then pull a vision model: ollama pull ${this.policy.model}`
        );
      }
      throw error;
    }
  }

  private async compareImages(imageBase64: string, comparePath: string): Promise<string> {
    const compareBase64 = await fs.readFile(comparePath, { encoding: "base64" });

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.policy.model,
        prompt: "Compare these two images. Describe the differences and similarities.",
        images: [imageBase64, compareBase64],
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
    const data = await response.json() as { response: string };
    return data.response;
  }
}
