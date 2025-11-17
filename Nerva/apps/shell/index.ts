/**
 * Nerva Shell - TUI application
 */

export class NervaShell {
  constructor(private kernel: any) {
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

