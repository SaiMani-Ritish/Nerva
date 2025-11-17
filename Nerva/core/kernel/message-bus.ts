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
  | "error.occurred";

export interface Event {
  type: EventType;
  timestamp: number;
  data: unknown;
}

type EventHandler = (event: Event) => void | Promise<void>;

export class MessageBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();

  /**
   * Subscribe to events of a specific type
   */
  on(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const filtered = handlers.filter((h) => h !== handler);
    this.handlers.set(eventType, filtered);
  }

  /**
   * Emit an event to all subscribed handlers
   */
  async emit(eventType: EventType, data: unknown): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    const event: Event = {
      type: eventType,
      timestamp: Date.now(),
      data,
    };

    // Execute handlers in parallel
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}

