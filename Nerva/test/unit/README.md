# Unit Tests

Fast, focused tests for individual components.

## Organization

- `kernel/` - Kernel, router, intent parser tests
- `memory/` - Context manager, vector store tests
- `tools/` - Tool implementation tests
- `agents/` - Agent tests (with mocked LLM)
- `models/` - Model adapter tests (with mocked APIs)

## Running Tests

```bash
# All unit tests
pnpm test:unit

# Specific test file
pnpm test:unit core/kernel/router.test.ts

# Watch mode
pnpm test:unit --watch

# Coverage
pnpm test:unit --coverage
```

## Writing Tests

Use `vitest` for test framework:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("MyComponent", () => {
  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

## Coverage Goals

- Core modules: > 80%
- Tools: > 90% (security-critical)
- Agents: > 70% (some LLM behavior hard to test)

