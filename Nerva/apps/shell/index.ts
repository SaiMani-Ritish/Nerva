/**
 * Nerva Shell - TUI application
 */

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Kernel } from "../../core/kernel/kernel";

export class NervaShell {
  constructor(private kernel: Kernel) {
    // TODO(cursor): Initialize TUI
    // Use blessed or ink for rendering
  }

  /**
   * Start the shell
   */
  async start(): Promise<void> {
    // TODO(cursor): Implement TUI
    // - Render input line
    // - Set up key bindings
    // - Connect to kernel
    // - Stream output
    console.log("Nerva Shell starting...");
    console.log("(TUI not yet implemented)");
    await Promise.resolve();
  }

  /**
   * Execute a command
   */
  async execute(input: string): Promise<unknown> {
    return await this.kernel.process(input, {
      threadId: "default",
      userId: "user",
      history: [],
      metadata: {},
    });
  }
}

