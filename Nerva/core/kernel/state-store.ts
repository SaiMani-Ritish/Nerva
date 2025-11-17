/**
 * In-memory state store for active tasks and sessions
 */

export interface TaskState {
  id: string;
  status: "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  progress?: number;
  data: Record<string, unknown>;
}

export class StateStore {
  private tasks: Map<string, TaskState> = new Map();

  /**
   * Create a new task
   */
  create(id: string, data: Record<string, unknown> = {}): TaskState {
    const task: TaskState = {
      id,
      status: "running",
      startTime: Date.now(),
      data,
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * Get task state by ID
   */
  get(id: string): TaskState | undefined {
    return this.tasks.get(id);
  }

  /**
   * Update task state
   */
  update(
    id: string,
    updates: Partial<Omit<TaskState, "id" | "startTime">>
  ): TaskState | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    // Merge data objects if data is being updated
    const updated = {
      ...task,
      ...updates,
      data: updates.data ? { ...task.data, ...updates.data } : task.data,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Delete task state
   */
  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Get all tasks
   */
  list(): TaskState[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(olderThan: number = 3600000): number {
    // Default: clean tasks older than 1 hour
    const cutoff = Date.now() - olderThan;
    let cleaned = 0;

    for (const [id, task] of this.tasks.entries()) {
      if (
        (task.status === "completed" || task.status === "failed") &&
        (task.endTime || task.startTime) < cutoff
      ) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

