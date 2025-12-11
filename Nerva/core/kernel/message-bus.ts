/**
 * Message bus for event-driven communication between components
 */

export type EventType =
  | "intent.parsed"
  | "tool.called"
  | "tool.completed"
  | "agent.started"
  | "agent.completed"
  | "memory.updated"
  | "error.occurred"
  | string; // Allow dynamic event types

export interface Event {
  type: string;
  timestamp: number;
  data: unknown;
}

type EventHandler = (event: Event) => void | Promise<void>;
type DataHandler = (data: unknown) => void | Promise<void>;

export class MessageBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private dataHandlers: Map<string, DataHandler[]> = new Map();

  /**
   * Subscribe to events of a specific type (receives full Event object)
   */
  on(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const filtered = handlers.filter((h) => h !== handler);
    this.handlers.set(eventType, filtered);
  }

  /**
   * Emit an event to all subscribed handlers
   */
  async emit(eventType: string, data: unknown): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    const event: Event = {
      type: eventType,
      timestamp: Date.now(),
      data,
    };

    // Execute handlers in parallel
    await Promise.all(handlers.map((handler) => handler(event)));

    // Also call data handlers
    const dataHandlers = this.dataHandlers.get(eventType) || [];
    await Promise.all(dataHandlers.map((handler) => handler(data)));
  }

  /**
   * Subscribe to events (receives only data, returns unsubscribe function)
   */
  subscribe(eventType: string, handler: DataHandler): () => void {
    const handlers = this.dataHandlers.get(eventType) || [];
    handlers.push(handler);
    this.dataHandlers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.dataHandlers.get(eventType) || [];
      const filtered = current.filter((h) => h !== handler);
      this.dataHandlers.set(eventType, filtered);
    };
  }

  /**
   * Publish an event (alias for emit)
   */
  publish(eventType: string, data: unknown): Promise<void> {
    return this.emit(eventType, data);
  }

  /**
   * Subscribe once (automatically unsubscribes after first event)
   */
  once(eventType: string, handler: DataHandler): () => void {
    const wrappedHandler: DataHandler = async (data) => {
      unsubscribe();
      await handler(data);
    };
    const unsubscribe = this.subscribe(eventType, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Wait for an event (Promise-based)
   */
  waitFor(eventType: string, timeoutMs?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.once(eventType, (data) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      });

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Clear all handlers for an event type
   */
  clear(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
      this.dataHandlers.delete(eventType);
    } else {
      this.handlers.clear();
      this.dataHandlers.clear();
    }
  }

  /**
   * Get count of handlers for an event type
   */
  listenerCount(eventType: string): number {
    const eventHandlers = this.handlers.get(eventType)?.length || 0;
    const dataHandlers = this.dataHandlers.get(eventType)?.length || 0;
    return eventHandlers + dataHandlers;
  }
}
