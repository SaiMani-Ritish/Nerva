/**
 * Shell TUI Renderer
 * Handles all terminal output and screen management
 */

import { cursor, screen, fg, bg, style, colorize, padRight, drawBox, textLength } from "./ansi.js";
import type { ShellState, ThreadInfo, CommandPaletteItem, OutputChunk } from "./types.js";

export interface RendererConfig {
  showStatusBar?: boolean;
  showHelp?: boolean;
}

export class Renderer {
  private width: number = 80;
  private height: number = 24;
  private outputBuffer: OutputChunk[] = [];
  private maxOutputLines: number = 100;

  constructor(private config: RendererConfig = {}) {
    this.updateDimensions();
  }

  /**
   * Update terminal dimensions
   */
  updateDimensions(): void {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
  }

  /**
   * Get available height for output (excluding status bar and input)
   */
  getOutputHeight(): number {
    let height = this.height;
    if (this.config.showStatusBar) height -= 1;
    height -= 2; // Input line + spacing
    return Math.max(1, height);
  }

  /**
   * Write to stdout
   */
  write(text: string): void {
    process.stdout.write(text);
  }

  /**
   * Clear the entire screen
   */
  clear(): void {
    this.write(screen.clear + cursor.home);
  }

  /**
   * Clear the current line
   */
  clearLine(): void {
    this.write(screen.clearLine + cursor.column(1));
  }

  /**
   * Move cursor to position
   */
  moveTo(row: number, col: number): void {
    this.write(cursor.moveTo(row, col));
  }

  /**
   * Add output to buffer
   */
  addOutput(chunk: OutputChunk): void {
    this.outputBuffer.push(chunk);
    if (this.outputBuffer.length > this.maxOutputLines) {
      this.outputBuffer.shift();
    }
  }

  /**
   * Clear output buffer
   */
  clearOutput(): void {
    this.outputBuffer = [];
  }

  /**
   * Render the status bar
   */
  renderStatusBar(state: ShellState, modelInfo: string): void {
    this.moveTo(this.height, 1);
    this.write(screen.clearLine);

    const thread = state.threads.get(state.currentThreadId);
    const threadName = thread?.name || state.currentThreadId;
    const messageCount = thread?.messageCount || 0;

    // Left side: mode and thread info
    const leftContent = [
      colorize(` ${this.getModeIcon(state.mode)} `, fg.black, bg.cyan),
      colorize(` ${threadName} `, fg.white, bg.brightBlack),
      colorize(` ${messageCount} msgs `, fg.brightBlack),
    ].join("");

    // Right side: model info and status
    const statusIcon = state.isProcessing
      ? colorize(" ● ", fg.yellow)
      : colorize(" ○ ", fg.green);
    const rightContent = [
      statusIcon,
      colorize(modelInfo, fg.brightBlack),
      colorize(" ", fg.default),
    ].join("");

    // Calculate padding
    const leftLen = textLength(leftContent);
    const rightLen = textLength(rightContent);
    const padding = Math.max(0, this.width - leftLen - rightLen);

    this.write(bg.color(236)); // Dark gray background
    this.write(leftContent);
    this.write(" ".repeat(padding));
    this.write(rightContent);
    this.write(style.reset);
  }

  /**
   * Get icon for current mode
   */
  private getModeIcon(mode: string): string {
    const icons: Record<string, string> = {
      input: "λ",
      "command-palette": "⌘",
      "thread-selector": "⇄",
      scratchpad: "📝",
      help: "?",
    };
    return icons[mode] || "λ";
  }

  /**
   * Render the prompt/input line
   */
  renderPrompt(input: string, cursorPos: number, prompt: string = "› "): void {
    const row = this.config.showStatusBar ? this.height - 1 : this.height;
    this.moveTo(row, 1);
    this.write(screen.clearLine);

    const styledPrompt = colorize(prompt, fg.cyan, undefined, [style.bold]);
    this.write(styledPrompt);
    this.write(input);

    // Position cursor
    const cursorCol = textLength(prompt) + cursorPos + 1;
    this.moveTo(row, cursorCol);
  }

  /**
   * Render output messages
   */
  renderOutput(): void {
    const outputHeight = this.getOutputHeight();
    const startRow = 1;

    // Get last N lines that fit
    const visibleChunks = this.outputBuffer.slice(-outputHeight);

    for (let i = 0; i < outputHeight; i++) {
      this.moveTo(startRow + i, 1);
      this.write(screen.clearLine);

      if (i < visibleChunks.length) {
        const chunk = visibleChunks[i];
        this.write(this.formatChunk(chunk));
      }
    }
  }

  /**
   * Format an output chunk with styling
   */
  private formatChunk(chunk: OutputChunk): string {
    switch (chunk.type) {
      case "error":
        return colorize(chunk.content, fg.red);
      case "success":
        return colorize(chunk.content, fg.green);
      case "info":
        return colorize(chunk.content, fg.blue);
      case "streaming":
        return colorize(chunk.content, fg.brightWhite);
      default:
        return chunk.content;
    }
  }

  /**
   * Render the command palette
   */
  renderCommandPalette(
    items: CommandPaletteItem[],
    selectedIndex: number,
    filter: string
  ): void {
    const boxWidth = Math.min(60, this.width - 4);
    const boxHeight = Math.min(items.length + 2, this.height - 6);
    const startRow = Math.floor((this.height - boxHeight) / 2);
    const startCol = Math.floor((this.width - boxWidth) / 2);

    // Filter items
    const filteredItems = filter
      ? items.filter((item) =>
          item.label.toLowerCase().includes(filter.toLowerCase())
        )
      : items;

    // Build content lines
    const contentLines: string[] = [];

    // Search input
    contentLines.push(
      colorize("Search: ", fg.brightBlack) + colorize(filter + "█", fg.cyan)
    );
    contentLines.push("");

    // Items
    for (let i = 0; i < Math.min(filteredItems.length, boxHeight - 4); i++) {
      const item = filteredItems[i];
      const isSelected = i === selectedIndex;

      let line = "";
      if (isSelected) {
        line += colorize("› ", fg.cyan, undefined, [style.bold]);
        line += colorize(item.label, fg.white, undefined, [style.bold]);
      } else {
        line += "  ";
        line += item.label;
      }

      if (item.shortcut) {
        const shortcutLen = item.shortcut.length + 2;
        const labelLen = textLength(line);
        const padding = boxWidth - 4 - labelLen - shortcutLen;
        line += " ".repeat(Math.max(1, padding));
        line += colorize(item.shortcut, fg.brightBlack);
      }

      contentLines.push(line);
    }

    // Draw box
    const boxLines = drawBox(contentLines, boxWidth, "Command Palette (Ctrl+K)");

    // Render
    for (let i = 0; i < boxLines.length; i++) {
      this.moveTo(startRow + i, startCol);
      this.write(screen.clearLine);
      this.write(boxLines[i]);
    }
  }

  /**
   * Render thread selector
   */
  renderThreadSelector(
    threads: ThreadInfo[],
    selectedIndex: number,
    currentThreadId: string
  ): void {
    const boxWidth = Math.min(50, this.width - 4);
    const boxHeight = Math.min(threads.length + 3, this.height - 6);
    const startRow = Math.floor((this.height - boxHeight) / 2);
    const startCol = Math.floor((this.width - boxWidth) / 2);

    const contentLines: string[] = [];
    contentLines.push(colorize("Select a thread or create new", fg.brightBlack));
    contentLines.push("");

    for (let i = 0; i < Math.min(threads.length, boxHeight - 4); i++) {
      const thread = threads[i];
      const isSelected = i === selectedIndex;
      const isCurrent = thread.id === currentThreadId;

      let line = "";
      if (isSelected) {
        line += colorize("› ", fg.cyan, undefined, [style.bold]);
      } else {
        line += "  ";
      }

      if (isCurrent) {
        line += colorize("● ", fg.green);
      } else {
        line += "○ ";
      }

      line += thread.name;
      line += colorize(` (${thread.messageCount})`, fg.brightBlack);

      contentLines.push(line);
    }

    // Add "New Thread" option
    const newIndex = threads.length;
    const newSelected = selectedIndex === newIndex;
    contentLines.push("");
    contentLines.push(
      (newSelected ? colorize("› ", fg.cyan, undefined, [style.bold]) : "  ") +
        colorize("+ New Thread", fg.green)
    );

    const boxLines = drawBox(contentLines, boxWidth, "Threads (Ctrl+T)");

    for (let i = 0; i < boxLines.length; i++) {
      this.moveTo(startRow + i, startCol);
      this.write(screen.clearLine);
      this.write(boxLines[i]);
    }
  }

  /**
   * Render scratchpad
   */
  renderScratchpad(content: string[], cursorRow: number, cursorCol: number): void {
    const boxWidth = this.width - 4;
    const boxHeight = this.height - 4;
    const startRow = 2;
    const startCol = 2;

    const visibleLines = content.slice(0, boxHeight - 2);
    while (visibleLines.length < boxHeight - 2) {
      visibleLines.push("");
    }

    const boxLines = drawBox(visibleLines, boxWidth, "Scratchpad (Ctrl+P to close)");

    for (let i = 0; i < boxLines.length; i++) {
      this.moveTo(startRow + i, startCol);
      this.write(boxLines[i]);
    }

    // Position cursor inside scratchpad
    this.moveTo(startRow + 1 + cursorRow, startCol + 1 + cursorCol);
  }

  /**
   * Render help screen
   */
  renderHelp(): void {
    const helpContent = [
      colorize("Keyboard Shortcuts", fg.cyan, undefined, [style.bold]),
      "",
      `${colorize("Ctrl+K", fg.yellow)}  Command palette`,
      `${colorize("Ctrl+T", fg.yellow)}  Thread management`,
      `${colorize("Ctrl+P", fg.yellow)}  Scratchpad`,
      `${colorize("Ctrl+L", fg.yellow)}  Clear screen`,
      `${colorize("Ctrl+C", fg.yellow)}  Cancel / Exit`,
      "",
      `${colorize("Enter", fg.yellow)}   Submit input`,
      `${colorize("↑/↓", fg.yellow)}     History navigation`,
      `${colorize("Tab", fg.yellow)}     Autocomplete`,
      `${colorize("Esc", fg.yellow)}     Close modal`,
      "",
      colorize("Press any key to close", fg.brightBlack),
    ];

    const boxWidth = Math.min(50, this.width - 4);
    const startRow = Math.floor((this.height - helpContent.length - 2) / 2);
    const startCol = Math.floor((this.width - boxWidth) / 2);

    const boxLines = drawBox(helpContent, boxWidth, "Help (?)");

    for (let i = 0; i < boxLines.length; i++) {
      this.moveTo(startRow + i, startCol);
      this.write(screen.clearLine);
      this.write(boxLines[i]);
    }
  }

  /**
   * Render a streaming response character
   */
  appendStreamingChar(char: string): void {
    this.write(char);
  }

  /**
   * Show/hide cursor
   */
  showCursor(): void {
    this.write(cursor.show);
  }

  hideCursor(): void {
    this.write(cursor.hide);
  }

  /**
   * Full screen render
   */
  render(state: ShellState, input: string, cursorPos: number, modelInfo: string): void {
    this.updateDimensions();
    this.hideCursor();
    this.clear();

    // Render based on mode
    switch (state.mode) {
      case "help":
        this.renderHelp();
        break;
      default:
        this.renderOutput();
        this.renderPrompt(input, cursorPos);
        break;
    }

    if (this.config.showStatusBar) {
      this.renderStatusBar(state, modelInfo);
    }

    this.showCursor();
  }
}

