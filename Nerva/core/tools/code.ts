/**
 * Code tool — analysis, explanation, linting, and refactoring via LLM + filesystem
 */

import { promises as fs } from "fs";
import * as path from "path";
import { execFile } from "child_process";
import type { Tool, ToolResult } from "./types.js";

export interface CodeInput {
  action: "analyze" | "refactor" | "explain" | "lint" | "dependencies" | "complexity";
  path: string;
  language?: string;
  instruction?: string;
}

export class CodeTool implements Tool {
  name = "code";
  description = "Code analysis, explanation, linting, and refactoring";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["analyze", "refactor", "explain", "lint", "dependencies", "complexity"],
        description: "Code operation to perform",
      },
      path: { type: "string", description: "File or directory path" },
      language: { type: "string", description: "Programming language (auto-detected if omitted)" },
      instruction: { type: "string", description: "Instruction for refactor (e.g. 'rename X to Y')" },
    },
    required: ["action", "path"],
  };

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ci = input as CodeInput;

    try {
      if (!ci.action || !ci.path) throw new Error("Missing required parameters: action, path");

      let output: unknown;

      switch (ci.action) {
        case "analyze":
          output = await this.analyzeCode(ci.path);
          break;
        case "explain":
          output = await this.explainCode(ci.path);
          break;
        case "lint":
          output = await this.lintCode(ci.path);
          break;
        case "dependencies":
          output = await this.getDependencies(ci.path);
          break;
        case "complexity":
          output = await this.getComplexity(ci.path);
          break;
        case "refactor":
          output = await this.refactorCode(ci.path, ci.instruction || "");
          break;
        default:
          throw new Error(`Unknown code action: ${ci.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "CODE_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
      ".py": "python", ".rs": "rust", ".go": "go", ".java": "java",
      ".c": "c", ".cpp": "c++", ".h": "c", ".cs": "c#",
      ".rb": "ruby", ".php": "php", ".swift": "swift", ".kt": "kotlin",
      ".sh": "bash", ".yaml": "yaml", ".yml": "yaml", ".json": "json",
      ".md": "markdown", ".sql": "sql", ".html": "html", ".css": "css",
    };
    return langMap[ext] || "unknown";
  }

  private async analyzeCode(filePath: string): Promise<object> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const language = this.detectLanguage(filePath);

    const blankLines = lines.filter((l) => l.trim() === "").length;
    const commentLines = lines.filter((l) => {
      const t = l.trim();
      return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*");
    }).length;

    const importCount = lines.filter((l) => /^\s*(import|require|from|use)\b/.test(l)).length;
    const functionCount = lines.filter((l) => /\b(function|def|fn|func|=>)\b/.test(l)).length;
    const classCount = lines.filter((l) => /\b(class|struct|interface|enum|type)\b/.test(l)).length;

    return {
      file: filePath,
      language,
      totalLines: lines.length,
      codeLines: lines.length - blankLines - commentLines,
      blankLines,
      commentLines,
      imports: importCount,
      functions: functionCount,
      classes: classCount,
    };
  }

  private async explainCode(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, "utf-8");
    const language = this.detectLanguage(filePath);
    const lines = content.split("\n");

    const imports = lines.filter((l) => /^\s*(import|require|from|use)\b/.test(l));
    const functions = lines
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter((l) => /\b(function|def|fn|func|class|interface)\b/.test(l.text));

    let explanation = `File: ${filePath} (${language})\n`;
    explanation += `Lines: ${lines.length}\n\n`;
    explanation += `Imports (${imports.length}):\n${imports.map((i) => `  ${i.trim()}`).join("\n")}\n\n`;
    explanation += `Definitions (${functions.length}):\n${functions.map((f) => `  L${f.line}: ${f.text.trim()}`).join("\n")}`;

    return explanation;
  }

  private async lintCode(filePath: string): Promise<string> {
    const language = this.detectLanguage(filePath);
    let cmd: string;
    let args: string[];

    switch (language) {
      case "typescript":
      case "javascript":
        cmd = "npx";
        args = ["eslint", "--no-error-on-unmatched-pattern", filePath];
        break;
      case "python":
        cmd = "python3";
        args = ["-m", "flake8", filePath];
        break;
      default:
        return `No linter configured for ${language}. Supported: typescript, javascript, python.`;
    }

    return new Promise((resolve) => {
      execFile(cmd, args, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          resolve(stdout.trim() || stderr.trim() || "Lint completed with issues.");
          return;
        }
        resolve(stdout.trim() || "No lint issues found.");
      });
    });
  }

  private async getDependencies(dirPath: string): Promise<object> {
    const results: Record<string, unknown> = {};

    const tryRead = async (file: string, parser: (c: string) => unknown) => {
      try {
        const full = path.join(dirPath, file);
        const content = await fs.readFile(full, "utf-8");
        return parser(content);
      } catch {
        return null;
      }
    };

    const pkg = await tryRead("package.json", (c) => {
      const p = JSON.parse(c);
      return { dependencies: p.dependencies, devDependencies: p.devDependencies };
    });
    if (pkg) results["node"] = pkg;

    const reqs = await tryRead("requirements.txt", (c) =>
      c.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
    );
    if (reqs) results["python"] = reqs;

    const cargo = await tryRead("Cargo.toml", (c) => {
      const deps = c.match(/\[dependencies\]([\s\S]*?)(\[|$)/)?.[1];
      return deps
        ? deps.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
        : [];
    });
    if (cargo) results["rust"] = cargo;

    if (Object.keys(results).length === 0) {
      return { message: "No recognized dependency files found (package.json, requirements.txt, Cargo.toml)" };
    }

    return results;
  }

  private async getComplexity(filePath: string): Promise<object> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    let maxNesting = 0;
    let currentNesting = 0;
    let functionCount = 0;
    let branchCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/\b(function|def|fn|func|class|interface)\b/.test(trimmed)) functionCount++;
      if (/\b(if|else|switch|case|for|while|catch|&&|\|\|)\b/.test(trimmed)) branchCount++;

      const opens = (trimmed.match(/{/g) || []).length;
      const closes = (trimmed.match(/}/g) || []).length;
      currentNesting += opens - closes;
      if (currentNesting > maxNesting) maxNesting = currentNesting;
    }

    return {
      file: filePath,
      totalLines: lines.length,
      functions: functionCount,
      branches: branchCount,
      maxNestingDepth: maxNesting,
      cyclomaticComplexityEstimate: branchCount + 1,
      rating: branchCount < 10 ? "low" : branchCount < 20 ? "moderate" : "high",
    };
  }

  private async refactorCode(filePath: string, instruction: string): Promise<string> {
    if (!instruction) {
      return "Please provide a refactoring instruction (e.g. 'rename function X to Y', 'extract method').";
    }

    const content = await fs.readFile(filePath, "utf-8");
    const language = this.detectLanguage(filePath);

    return (
      `Refactoring request for ${filePath} (${language}):\n` +
      `Instruction: ${instruction}\n\n` +
      `File has ${content.split("\n").length} lines.\n` +
      `This operation requires LLM assistance. The code has been read and the instruction captured.\n` +
      `Pass this to the LLM for actual refactoring.`
    );
  }
}
