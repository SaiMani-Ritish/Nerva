/**
 * Example unit test
 */

import { describe, it, expect } from "vitest";

describe("Example Test Suite", () => {
  it("should pass this basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should test async functions", async () => {
    const result = await Promise.resolve("hello");
    expect(result).toBe("hello");
  });
});

// TODO(cursor): Add real unit tests for components
// See test/unit/README.md for organization

