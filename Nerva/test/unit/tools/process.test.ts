import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessTool } from "../../../core/tools/process";
import { EventEmitter } from "events";
import { spawn } from "child_process";

// Mock child_process
vi.mock("child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

describe("ProcessTool", () => {
  let tool: ProcessTool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockChildProcess: any;

  beforeEach(() => {
    tool = new ProcessTool({
      whitelist: ["echo", "ls"],
      blacklist: ["rm"],
      timeout_seconds: 1,
      max_output_size: 1024 * 1024,
    });
    vi.resetAllMocks();

    // Setup mock child process
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (spawn as any).mockReturnValue(mockChildProcess);
  });

  it("should execute whitelisted command", async () => {
    const executionPromise = tool.execute({
      command: "echo",
      args: ["hello"],
    });

    // Simulate process execution
    mockChildProcess.stdout.emit("data", "hello world");
    mockChildProcess.emit("close", 0);

    const result = await executionPromise;

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.output as any).stdout).toBe("hello world");
    expect(spawn).toHaveBeenCalledWith("echo", ["hello"], expect.anything());
  });

  it("should block blacklisted command", async () => {
    const result = await tool.execute({
      command: "rm",
      args: ["-rf", "/"],
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("blacklisted");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("should block non-whitelisted command", async () => {
    const result = await tool.execute({
      command: "wget",
      args: ["http://evil.com"],
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("not whitelisted");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("should handle timeout", async () => {
    vi.useFakeTimers();
    
    const executionPromise = tool.execute({
      command: "echo",
      args: ["slow"],
      timeout: 100,
    });

    // Fast forward time
    vi.advanceTimersByTime(200);

    const result = await executionPromise;

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain("timed out");
    expect(mockChildProcess.kill).toHaveBeenCalled();
    
    vi.useRealTimers();
  });

  it("should capture stderr", async () => {
    const executionPromise = tool.execute({
      command: "ls",
      args: ["invalid"],
    });

    mockChildProcess.stderr.emit("data", "No such file");
    mockChildProcess.emit("close", 1);

    const result = await executionPromise;

    expect(result.success).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.output as any).stderr).toBe("No such file");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.output as any).exitCode).toBe(1);
  });
});

