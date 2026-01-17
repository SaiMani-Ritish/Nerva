/**
 * Shell TUI types
 */

export interface ShellConfig {
  prompt?: string;
  historySize?: number;
  scratchpadPath?: string;
  theme?: ShellTheme;
  modelName?: string;
}

export interface ShellTheme {
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  muted: string;
}

export interface ThreadInfo {
  id: string;
  name: string;
  messageCount: number;
  createdAt: number;
  lastActivityAt: number;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  category?: string;
}

export interface ShellState {
  currentThreadId: string;
  threads: Map<string, ThreadInfo>;
  mode: ShellMode;
  isProcessing: boolean;
  lastError?: string;
}

export type ShellMode =
  | "input"
  | "command-palette"
  | "thread-selector"
  | "scratchpad"
  | "help";

export interface OutputChunk {
  type: "text" | "error" | "info" | "success" | "streaming";
  content: string;
  timestamp: number;
}

