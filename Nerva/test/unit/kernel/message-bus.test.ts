/**
 * Message Bus Tests
 */

import { describe, it, expect, vi } from "vitest";
import { MessageBus } from "../../../core/kernel/message-bus";

describe("MessageBus", () => {
  it("should emit events to subscribed handlers", async () => {
    const bus = new MessageBus();
    const handler = vi.fn();

    bus.on("tool.called", handler);
    await bus.emit("tool.called", { tool: "fs", input: {} });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      type: "tool.called",
      timestamp: expect.any(Number),
      data: { tool: "fs", input: {} },
    });
  });

  it("should support multiple handlers for same event", async () => {
    const bus = new MessageBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on("tool.called", handler1);
    bus.on("tool.called", handler2);
    await bus.emit("tool.called", { tool: "web" });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("should unsubscribe handlers", async () => {
    const bus = new MessageBus();
    const handler = vi.fn();

    bus.on("tool.called", handler);
    bus.off("tool.called", handler);
    await bus.emit("tool.called", {});

    expect(handler).not.toHaveBeenCalled();
  });

  it("should not call handlers for different event types", async () => {
    const bus = new MessageBus();
    const handler = vi.fn();

    bus.on("tool.called", handler);
    await bus.emit("tool.completed", {});

    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle async handlers", async () => {
    const bus = new MessageBus();
    let resolved = false;

    const asyncHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      resolved = true;
    };

    bus.on("tool.called", asyncHandler);
    await bus.emit("tool.called", {});

    expect(resolved).toBe(true);
  });

  it("should execute handlers in parallel", async () => {
    const bus = new MessageBus();
    const order: number[] = [];

    const handler1 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push(1);
    };

    const handler2 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push(2);
    };

    bus.on("tool.called", handler1);
    bus.on("tool.called", handler2);
    await bus.emit("tool.called", {});

    // Handler 2 should complete first (shorter delay)
    expect(order).toEqual([2, 1]);
  });

  it("should include timestamp in events", async () => {
    const bus = new MessageBus();
    let capturedEvent: any;

    bus.on("tool.called", (event) => {
      capturedEvent = event;
    });

    const before = Date.now();
    await bus.emit("tool.called", {});
    const after = Date.now();

    expect(capturedEvent.timestamp).toBeGreaterThanOrEqual(before);
    expect(capturedEvent.timestamp).toBeLessThanOrEqual(after);
  });
});

