/**
 * Nerva Shell - Interactive TUI Application
 */

import * as readline from "readline";
import { promises as fs } from "fs";
import * as path from "path";
import type { Kernel } from "../../core/kernel/kernel";
import type { Context } from "../../core/kernel/types";
import { Renderer } from "./renderer";
import { fg, colorize, style } from "./ansi";
import type {
  ShellConfig,
  ShellState,
  ThreadInfo,
  CommandPaletteItem,
  OutputChunk,
} from "./types";

/**
 * Main Nerva Shell class
 */
export class NervaShell {
  private renderer: Renderer;
  private state: ShellState;
  private inputBuffer: string = "";
  private cursorPos: number = 0;
  private history: string[] = [];
  private historyIndex: number = -1;
  private commandPaletteIndex: number = 0;
  private commandPaletteFilter: string = "";
  private threadSelectorIndex: number = 0;
  private scratchpadContent: string[] = [""];
  private scratchpadCursor: { row: number; col: number } = { row: 0, col: 0 };
  private config: Required<ShellConfig>;
  private isRunning: boolean = false;

  constructor(
    private kernel: Kernel,
    config: ShellConfig = {}
  ) {
    this.config = {
      prompt: config.prompt ?? "› ",
      historySize: config.historySize ?? 100,
      scratchpadPath: config.scratchpadPath ?? "./scratch/scratchpad.md",
      theme: config.theme ?? {
        primary: fg.cyan,
        secondary: fg.blue,
        success: fg.green,
        error: fg.red,
        warning: fg.yellow,
        muted: fg.brightBlack,
      },
    };

    this.renderer = new Renderer({ showStatusBar: true });

    this.state = {
      currentThreadId: this.generateThreadId(),
      threads: new Map(),
      mode: "input",
      isProcessing: false,
    };

    // Create initial thread
    this.createThread(this.state.currentThreadId, "Main");
  }

  /**
   * Start the shell
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Setup terminal
    this.setupTerminal();

    // Load history and scratchpad
    await this.loadHistory();
    await this.loadScratchpad();

    // Initial render
    this.render();

    // Welcome message
    this.addOutput({
      type: "info",
      content: colorize("Welcome to Nerva Shell", fg.cyan, undefined, [style.bold]),
      timestamp: Date.now(),
    });
    this.addOutput({
      type: "text",
      content: colorize("Type your request or press ? for help", fg.brightBlack),
      timestamp: Date.now(),
    });
    this.addOutput({ type: "text", content: "", timestamp: Date.now() });

    this.render();

    // Wait for exit
    return new Promise((resolve) => {
      const checkRunning = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(checkRunning);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Stop the shell
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Save history and scratchpad
    await this.saveHistory();
    await this.saveScratchpad();

    // Cleanup terminal
    this.cleanupTerminal();
  }

  /**
   * Setup terminal for raw mode input
   */
  private setupTerminal(): void {
    // Enable raw mode for key capture
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Handle input
    process.stdin.on("data", (key: string) => {
      this.handleKeypress(key);
    });

    // Handle resize
    process.stdout.on("resize", () => {
      this.renderer.updateDimensions();
      this.render();
    });

    // Handle exit signals
    process.on("SIGINT", () => {
      this.stop().then(() => process.exit(0));
    });
  }

  /**
   * Cleanup terminal
   */
  private cleanupTerminal(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.renderer.clear();
    this.renderer.showCursor();
    console.log("Goodbye!");
  }

  /**
   * Handle keypress
   */
  private handleKeypress(key: string): void {
    // Check for control sequences
    const keyCode = key.charCodeAt(0);

    // Ctrl+C - Exit or cancel
    if (key === "\x03") {
      if (this.state.isProcessing) {
        // Cancel current operation
        this.state.isProcessing = false;
        this.addOutput({ type: "info", content: "Cancelled", timestamp: Date.now() });
      } else if (this.state.mode !== "input") {
        this.state.mode = "input";
      } else {
        this.stop();
        return;
      }
      this.render();
      return;
    }

    // Route based on mode
    switch (this.state.mode) {
      case "input":
        this.handleInputKeypress(key, keyCode);
        break;
      case "command-palette":
        this.handleCommandPaletteKeypress(key, keyCode);
        break;
      case "thread-selector":
        this.handleThreadSelectorKeypress(key, keyCode);
        break;
      case "scratchpad":
        this.handleScratchpadKeypress(key, keyCode);
        break;
      case "help":
        this.state.mode = "input";
        this.render();
        break;
    }
  }

  /**
   * Handle input mode keypress
   */
  private handleInputKeypress(key: string, keyCode: number): void {
    // Ctrl+K - Command palette
    if (key === "\x0b") {
      this.state.mode = "command-palette";
      this.commandPaletteIndex = 0;
      this.commandPaletteFilter = "";
      this.render();
      this.renderer.renderCommandPalette(
        this.getCommandPaletteItems(),
        this.commandPaletteIndex,
        this.commandPaletteFilter
      );
      return;
    }

    // Ctrl+T - Thread selector
    if (key === "\x14") {
      this.state.mode = "thread-selector";
      this.threadSelectorIndex = 0;
      this.render();
      this.renderer.renderThreadSelector(
        this.getThreadList(),
        this.threadSelectorIndex,
        this.state.currentThreadId
      );
      return;
    }

    // Ctrl+P - Scratchpad
    if (key === "\x10") {
      this.state.mode = "scratchpad";
      this.render();
      this.renderer.renderScratchpad(
        this.scratchpadContent,
        this.scratchpadCursor.row,
        this.scratchpadCursor.col
      );
      return;
    }

    // Ctrl+L - Clear screen
    if (key === "\x0c") {
      this.renderer.clearOutput();
      this.render();
      return;
    }

    // ? - Help (only if input is empty)
    if (key === "?" && this.inputBuffer === "") {
      this.state.mode = "help";
      this.render();
      this.renderer.renderHelp();
      return;
    }

    // Enter - Submit
    if (key === "\r" || key === "\n") {
      if (this.inputBuffer.trim()) {
        this.submitInput();
      }
      return;
    }

    // Backspace
    if (key === "\x7f" || key === "\b") {
      if (this.cursorPos > 0) {
        this.inputBuffer =
          this.inputBuffer.slice(0, this.cursorPos - 1) +
          this.inputBuffer.slice(this.cursorPos);
        this.cursorPos--;
        this.render();
      }
      return;
    }

    // Arrow keys (escape sequences)
    if (key === "\x1b[A") {
      // Up arrow - history
      this.navigateHistory(-1);
      return;
    }
    if (key === "\x1b[B") {
      // Down arrow - history
      this.navigateHistory(1);
      return;
    }
    if (key === "\x1b[C") {
      // Right arrow
      if (this.cursorPos < this.inputBuffer.length) {
        this.cursorPos++;
        this.render();
      }
      return;
    }
    if (key === "\x1b[D") {
      // Left arrow
      if (this.cursorPos > 0) {
        this.cursorPos--;
        this.render();
      }
      return;
    }

    // Home/End
    if (key === "\x1b[H" || key === "\x01") {
      // Home or Ctrl+A
      this.cursorPos = 0;
      this.render();
      return;
    }
    if (key === "\x1b[F" || key === "\x05") {
      // End or Ctrl+E
      this.cursorPos = this.inputBuffer.length;
      this.render();
      return;
    }

    // Escape - clear input
    if (key === "\x1b" && this.inputBuffer) {
      this.inputBuffer = "";
      this.cursorPos = 0;
      this.render();
      return;
    }

    // Regular character input
    if (keyCode >= 32 && keyCode < 127) {
      this.inputBuffer =
        this.inputBuffer.slice(0, this.cursorPos) +
        key +
        this.inputBuffer.slice(this.cursorPos);
      this.cursorPos++;
      this.render();
    }
  }

  /**
   * Handle command palette keypress
   */
  private handleCommandPaletteKeypress(key: string, keyCode: number): void {
    const items = this.getCommandPaletteItems().filter((item) =>
      item.label.toLowerCase().includes(this.commandPaletteFilter.toLowerCase())
    );

    // Escape - close
    if (key === "\x1b") {
      this.state.mode = "input";
      this.render();
      return;
    }

    // Enter - select
    if (key === "\r" || key === "\n") {
      if (items[this.commandPaletteIndex]) {
        this.state.mode = "input";
        items[this.commandPaletteIndex].action();
        this.render();
      }
      return;
    }

    // Up arrow
    if (key === "\x1b[A") {
      this.commandPaletteIndex = Math.max(0, this.commandPaletteIndex - 1);
      this.render();
      this.renderer.renderCommandPalette(items, this.commandPaletteIndex, this.commandPaletteFilter);
      return;
    }

    // Down arrow
    if (key === "\x1b[B") {
      this.commandPaletteIndex = Math.min(items.length - 1, this.commandPaletteIndex + 1);
      this.render();
      this.renderer.renderCommandPalette(items, this.commandPaletteIndex, this.commandPaletteFilter);
      return;
    }

    // Backspace
    if (key === "\x7f" || key === "\b") {
      this.commandPaletteFilter = this.commandPaletteFilter.slice(0, -1);
      this.commandPaletteIndex = 0;
      this.render();
      this.renderer.renderCommandPalette(items, this.commandPaletteIndex, this.commandPaletteFilter);
      return;
    }

    // Regular character - filter
    if (keyCode >= 32 && keyCode < 127) {
      this.commandPaletteFilter += key;
      this.commandPaletteIndex = 0;
      this.render();
      this.renderer.renderCommandPalette(
        this.getCommandPaletteItems().filter((item) =>
          item.label.toLowerCase().includes(this.commandPaletteFilter.toLowerCase())
        ),
        this.commandPaletteIndex,
        this.commandPaletteFilter
      );
    }
  }

  /**
   * Handle thread selector keypress
   */
  private handleThreadSelectorKeypress(key: string, _keyCode: number): void {
    const threads = this.getThreadList();
    const maxIndex = threads.length; // +1 for "New Thread"

    // Escape - close
    if (key === "\x1b") {
      this.state.mode = "input";
      this.render();
      return;
    }

    // Enter - select
    if (key === "\r" || key === "\n") {
      if (this.threadSelectorIndex < threads.length) {
        this.state.currentThreadId = threads[this.threadSelectorIndex].id;
      } else {
        // Create new thread
        const newId = this.generateThreadId();
        this.createThread(newId, `Thread ${this.state.threads.size + 1}`);
        this.state.currentThreadId = newId;
      }
      this.state.mode = "input";
      this.render();
      return;
    }

    // Up arrow
    if (key === "\x1b[A") {
      this.threadSelectorIndex = Math.max(0, this.threadSelectorIndex - 1);
      this.render();
      this.renderer.renderThreadSelector(threads, this.threadSelectorIndex, this.state.currentThreadId);
      return;
    }

    // Down arrow
    if (key === "\x1b[B") {
      this.threadSelectorIndex = Math.min(maxIndex, this.threadSelectorIndex + 1);
      this.render();
      this.renderer.renderThreadSelector(threads, this.threadSelectorIndex, this.state.currentThreadId);
      return;
    }
  }

  /**
   * Handle scratchpad keypress
   */
  private handleScratchpadKeypress(key: string, keyCode: number): void {
    // Ctrl+P or Escape - close
    if (key === "\x10" || key === "\x1b") {
      this.state.mode = "input";
      this.render();
      return;
    }

    // Enter - new line
    if (key === "\r" || key === "\n") {
      const currentLine = this.scratchpadContent[this.scratchpadCursor.row];
      const before = currentLine.slice(0, this.scratchpadCursor.col);
      const after = currentLine.slice(this.scratchpadCursor.col);
      this.scratchpadContent[this.scratchpadCursor.row] = before;
      this.scratchpadContent.splice(this.scratchpadCursor.row + 1, 0, after);
      this.scratchpadCursor.row++;
      this.scratchpadCursor.col = 0;
      this.renderer.renderScratchpad(
        this.scratchpadContent,
        this.scratchpadCursor.row,
        this.scratchpadCursor.col
      );
      return;
    }

    // Backspace
    if (key === "\x7f" || key === "\b") {
      if (this.scratchpadCursor.col > 0) {
        const line = this.scratchpadContent[this.scratchpadCursor.row];
        this.scratchpadContent[this.scratchpadCursor.row] =
          line.slice(0, this.scratchpadCursor.col - 1) + line.slice(this.scratchpadCursor.col);
        this.scratchpadCursor.col--;
      } else if (this.scratchpadCursor.row > 0) {
        const prevLine = this.scratchpadContent[this.scratchpadCursor.row - 1];
        const currentLine = this.scratchpadContent[this.scratchpadCursor.row];
        this.scratchpadContent[this.scratchpadCursor.row - 1] = prevLine + currentLine;
        this.scratchpadContent.splice(this.scratchpadCursor.row, 1);
        this.scratchpadCursor.row--;
        this.scratchpadCursor.col = prevLine.length;
      }
      this.renderer.renderScratchpad(
        this.scratchpadContent,
        this.scratchpadCursor.row,
        this.scratchpadCursor.col
      );
      return;
    }

    // Arrow keys
    if (key === "\x1b[A" && this.scratchpadCursor.row > 0) {
      this.scratchpadCursor.row--;
      this.scratchpadCursor.col = Math.min(
        this.scratchpadCursor.col,
        this.scratchpadContent[this.scratchpadCursor.row].length
      );
    } else if (key === "\x1b[B" && this.scratchpadCursor.row < this.scratchpadContent.length - 1) {
      this.scratchpadCursor.row++;
      this.scratchpadCursor.col = Math.min(
        this.scratchpadCursor.col,
        this.scratchpadContent[this.scratchpadCursor.row].length
      );
    } else if (key === "\x1b[C") {
      const lineLen = this.scratchpadContent[this.scratchpadCursor.row].length;
      if (this.scratchpadCursor.col < lineLen) {
        this.scratchpadCursor.col++;
      }
    } else if (key === "\x1b[D") {
      if (this.scratchpadCursor.col > 0) {
        this.scratchpadCursor.col--;
      }
    }

    // Regular character
    if (keyCode >= 32 && keyCode < 127) {
      const line = this.scratchpadContent[this.scratchpadCursor.row];
      this.scratchpadContent[this.scratchpadCursor.row] =
        line.slice(0, this.scratchpadCursor.col) + key + line.slice(this.scratchpadCursor.col);
      this.scratchpadCursor.col++;
    }

    this.renderer.renderScratchpad(
      this.scratchpadContent,
      this.scratchpadCursor.row,
      this.scratchpadCursor.col
    );
  }

  /**
   * Submit input to kernel
   */
  private async submitInput(): Promise<void> {
    const input = this.inputBuffer.trim();
    if (!input) return;

    // Add to history
    this.history.push(input);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
    this.historyIndex = -1;

    // Clear input
    this.inputBuffer = "";
    this.cursorPos = 0;

    // Show user message
    this.addOutput({
      type: "text",
      content: colorize(`You: ${input}`, fg.brightWhite),
      timestamp: Date.now(),
    });
    this.render();

    // Process with kernel
    this.state.isProcessing = true;
    this.render();

    try {
      const context = this.buildContext();
      const response = await this.kernel.process(input, context);

      // Update thread message count
      const thread = this.state.threads.get(this.state.currentThreadId);
      if (thread) {
        thread.messageCount += 2;
        thread.lastActivityAt = Date.now();
      }

      // Show response
      const outputType = response.type === "error" ? "error" : "success";
      this.addOutput({
        type: outputType,
        content: colorize(`Nerva: ${response.content}`, outputType === "error" ? fg.red : fg.green),
        timestamp: Date.now(),
      });

      // Show timing
      this.addOutput({
        type: "info",
        content: colorize(`(${response.metadata.duration_ms}ms)`, fg.brightBlack),
        timestamp: Date.now(),
      });
    } catch (error) {
      this.addOutput({
        type: "error",
        content: colorize(`Error: ${(error as Error).message}`, fg.red),
        timestamp: Date.now(),
      });
    } finally {
      this.state.isProcessing = false;
      this.addOutput({ type: "text", content: "", timestamp: Date.now() });
      this.render();
    }
  }

  /**
   * Navigate command history
   */
  private navigateHistory(direction: number): void {
    if (this.history.length === 0) return;

    if (direction < 0) {
      // Up - older
      if (this.historyIndex < 0) {
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
    } else {
      // Down - newer
      if (this.historyIndex >= 0) {
        this.historyIndex++;
        if (this.historyIndex >= this.history.length) {
          this.historyIndex = -1;
          this.inputBuffer = "";
          this.cursorPos = 0;
          this.render();
          return;
        }
      }
    }

    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      this.inputBuffer = this.history[this.historyIndex];
      this.cursorPos = this.inputBuffer.length;
    }

    this.render();
  }

  /**
   * Build context for kernel
   */
  private buildContext(): Context {
    return {
      threadId: this.state.currentThreadId,
      userId: "shell-user",
      history: [],
      metadata: {
        shell: true,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Add output to renderer
   */
  private addOutput(chunk: OutputChunk): void {
    this.renderer.addOutput(chunk);
  }

  /**
   * Render the shell
   */
  private render(): void {
    this.renderer.render(
      this.state,
      this.inputBuffer,
      this.cursorPos,
      "local-model"
    );
  }

  /**
   * Get command palette items
   */
  private getCommandPaletteItems(): CommandPaletteItem[] {
    return [
      {
        id: "new-thread",
        label: "New Thread",
        shortcut: "Ctrl+Shift+T",
        action: () => {
          const id = this.generateThreadId();
          this.createThread(id, `Thread ${this.state.threads.size + 1}`);
          this.state.currentThreadId = id;
        },
        category: "Threads",
      },
      {
        id: "clear-screen",
        label: "Clear Screen",
        shortcut: "Ctrl+L",
        action: () => this.renderer.clearOutput(),
        category: "View",
      },
      {
        id: "clear-history",
        label: "Clear History",
        action: () => {
          this.history = [];
        },
        category: "History",
      },
      {
        id: "open-scratchpad",
        label: "Open Scratchpad",
        shortcut: "Ctrl+P",
        action: () => {
          this.state.mode = "scratchpad";
        },
        category: "Tools",
      },
      {
        id: "show-help",
        label: "Show Help",
        shortcut: "?",
        action: () => {
          this.state.mode = "help";
        },
        category: "Help",
      },
      {
        id: "exit",
        label: "Exit Nerva",
        shortcut: "Ctrl+C",
        action: () => this.stop(),
        category: "System",
      },
    ];
  }

  /**
   * Get thread list
   */
  private getThreadList(): ThreadInfo[] {
    return Array.from(this.state.threads.values()).sort(
      (a, b) => b.lastActivityAt - a.lastActivityAt
    );
  }

  /**
   * Create a new thread
   */
  private createThread(id: string, name: string): void {
    this.state.threads.set(id, {
      id,
      name,
      messageCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Generate a unique thread ID
   */
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Load command history from file
   */
  private async loadHistory(): Promise<void> {
    try {
      const historyPath = path.join(process.cwd(), ".nerva_history");
      const content = await fs.readFile(historyPath, "utf-8");
      this.history = content.split("\n").filter((line) => line.trim());
    } catch {
      // No history file, that's fine
    }
  }

  /**
   * Save command history to file
   */
  private async saveHistory(): Promise<void> {
    try {
      const historyPath = path.join(process.cwd(), ".nerva_history");
      await fs.writeFile(historyPath, this.history.join("\n"), "utf-8");
    } catch {
      // Failed to save history
    }
  }

  /**
   * Load scratchpad from file
   */
  private async loadScratchpad(): Promise<void> {
    try {
      const content = await fs.readFile(this.config.scratchpadPath, "utf-8");
      this.scratchpadContent = content.split("\n");
    } catch {
      this.scratchpadContent = ["# Scratchpad", "", ""];
    }
  }

  /**
   * Save scratchpad to file
   */
  private async saveScratchpad(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.config.scratchpadPath), { recursive: true });
      await fs.writeFile(
        this.config.scratchpadPath,
        this.scratchpadContent.join("\n"),
        "utf-8"
      );
    } catch {
      // Failed to save scratchpad
    }
  }
}

