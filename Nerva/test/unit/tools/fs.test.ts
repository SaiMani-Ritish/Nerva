import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FilesystemTool } from "../../../core/tools/fs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("FilesystemTool", () => {
  let tool: FilesystemTool;
  let tempDir: string;
  let sandboxRoot: string;

  beforeEach(() => {
    // Create a temporary directory for sandboxed tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nerva-fs-test-"));
    sandboxRoot = path.join(tempDir, "workspace");
    fs.mkdirSync(sandboxRoot);
    
    tool = new FilesystemTool({
        allow_roots: [sandboxRoot],
        deny_patterns: [],
        deny_paths: [],
        max_file_size: 1024 * 1024,
    });
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should write and read a file within sandbox", async () => {
    const filePath = path.join(sandboxRoot, "test.txt");
    const content = "Hello Nerva";

    // Write
    const writeResult = await tool.execute({
      action: "write",
      path: filePath,
      content,
    });
    expect(writeResult.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(content);

    // Read
    const readResult = await tool.execute({
      action: "read",
      path: filePath,
    });
    expect(readResult.success).toBe(true);
    expect(readResult.output).toBe(content);
  });

  it("should prevent access outside sandbox", async () => {
    const outsidePath = path.join(tempDir, "secret.txt");
    fs.writeFileSync(outsidePath, "secret");

    const result = await tool.execute({
      action: "read",
      path: outsidePath,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Access denied");
  });

  it("should prevent path traversal", async () => {
    const traversalPath = path.join(sandboxRoot, "../secret.txt");
    
    // Even though we construct it relative to sandbox, it resolves to outside
    const result = await tool.execute({
        action: "read",
        path: traversalPath
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Access denied");
  });

  it("should list files in directory", async () => {
    fs.writeFileSync(path.join(sandboxRoot, "a.txt"), "a");
    fs.writeFileSync(path.join(sandboxRoot, "b.txt"), "b");
    fs.mkdirSync(path.join(sandboxRoot, "subdir"));

    const result = await tool.execute({
      action: "list",
      path: sandboxRoot,
    });

    expect(result.success).toBe(true);
    const files = result.output as string[];
    expect(files).toContain("a.txt");
    expect(files).toContain("b.txt");
    expect(files).toContain("subdir");
  });

  it("should search for files matching pattern", async () => {
    fs.writeFileSync(path.join(sandboxRoot, "match1.ts"), "");
    fs.writeFileSync(path.join(sandboxRoot, "ignore.js"), "");
    const subDir = path.join(sandboxRoot, "src");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "match2.ts"), "");

    const result = await tool.execute({
      action: "search",
      path: sandboxRoot,
      pattern: "\\.ts$",
    });

    expect(result.success).toBe(true);
    const files = result.output as string[];
    // Normalize paths for cross-platform comparison
    const normalizedFiles = files.map(f => f.replace(/\\/g, "/"));
    expect(normalizedFiles).toContain("match1.ts");
    expect(normalizedFiles).toContain("src/match2.ts");
    expect(normalizedFiles).not.toContain("ignore.js");
  });

  it("should enforce max file size on write", async () => {
    const filePath = path.join(sandboxRoot, "large.txt");
    const largeContent = "a".repeat(1024 * 1024 + 1); // 1MB + 1 byte

    const result = await tool.execute({
      action: "write",
      path: filePath,
      content: largeContent,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("exceeds limit");
  });

  it("should enforce deny patterns", async () => {
    const secretPath = path.join(sandboxRoot, "id_rsa"); // Matches deny pattern? No, we didn't add one.
    // We need to re-init tool with deny patterns for this test
    const policyTool = new FilesystemTool({
        allow_roots: [sandboxRoot],
        deny_patterns: ["id_rsa", ".*\\.key"],
        deny_paths: [],
        max_file_size: 1024 * 1024,
    });

    const result = await policyTool.execute({
        action: "write",
        path: secretPath,
        content: "secret",
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("Access denied");
  });
});

