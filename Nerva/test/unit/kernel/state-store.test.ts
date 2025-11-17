/**
 * State Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StateStore } from "../../../core/kernel/state-store";

describe("StateStore", () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  it("should create a new task", () => {
    const task = store.create("task-1", { foo: "bar" });

    expect(task).toMatchObject({
      id: "task-1",
      status: "running",
      startTime: expect.any(Number),
      data: { foo: "bar" },
    });
    expect(task.endTime).toBeUndefined();
  });

  it("should get task by id", () => {
    store.create("task-1");
    const task = store.get("task-1");

    expect(task).toBeDefined();
    expect(task?.id).toBe("task-1");
  });

  it("should return undefined for non-existent task", () => {
    const task = store.get("non-existent");
    expect(task).toBeUndefined();
  });

  it("should update task state", () => {
    store.create("task-1");
    const updated = store.update("task-1", {
      status: "completed",
      endTime: Date.now(),
      progress: 100,
    });

    expect(updated).toBeDefined();
    expect(updated?.status).toBe("completed");
    expect(updated?.endTime).toBeDefined();
    expect(updated?.progress).toBe(100);
  });

  it("should return undefined when updating non-existent task", () => {
    const result = store.update("non-existent", { status: "completed" });
    expect(result).toBeUndefined();
  });

  it("should delete a task", () => {
    store.create("task-1");
    const deleted = store.delete("task-1");

    expect(deleted).toBe(true);
    expect(store.get("task-1")).toBeUndefined();
  });

  it("should return false when deleting non-existent task", () => {
    const deleted = store.delete("non-existent");
    expect(deleted).toBe(false);
  });

  it("should list all tasks", () => {
    store.create("task-1");
    store.create("task-2");
    store.create("task-3");

    const tasks = store.list();
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
  });

  it("should clean up old completed tasks", () => {
    const now = Date.now();

    // Create old completed task (2 hours ago)
    store.create("old-task");
    store.update("old-task", {
      status: "completed",
      endTime: now - 7200000, // 2 hours ago
    });

    // Create recent completed task (30 min ago)
    store.create("recent-task");
    store.update("recent-task", {
      status: "completed",
      endTime: now - 1800000, // 30 min ago
    });

    // Create running task
    store.create("running-task");

    // Clean up tasks older than 1 hour
    const cleaned = store.cleanup(3600000);

    expect(cleaned).toBe(1); // Only old-task should be cleaned
    expect(store.get("old-task")).toBeUndefined();
    expect(store.get("recent-task")).toBeDefined();
    expect(store.get("running-task")).toBeDefined();
  });

  it("should not clean up running tasks", () => {
    const now = Date.now();

    // Create old running task
    const task = store.create("running-task");
    task.startTime = now - 7200000; // Started 2 hours ago

    const cleaned = store.cleanup(3600000);

    expect(cleaned).toBe(0);
    expect(store.get("running-task")).toBeDefined();
  });

  it("should track task progress", () => {
    store.create("task-1");
    store.update("task-1", { progress: 0 });
    store.update("task-1", { progress: 50 });
    store.update("task-1", { progress: 100 });

    const task = store.get("task-1");
    expect(task?.progress).toBe(100);
  });

  it("should preserve existing data when updating", () => {
    store.create("task-1", { initial: "data" });
    store.update("task-1", { data: { additional: "info" } });

    const task = store.get("task-1");
    expect(task?.data).toEqual({
      initial: "data",
      additional: "info",
    });
  });
});

