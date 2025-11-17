# Contributing to Nerva

Thank you for your interest in contributing to Nerva! This guide will help you get started with development, understand our conventions, and contribute effectively.

## Table of Contents

- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Conventions](#commit-conventions)
- [Code Review Process](#code-review-process)
- [Prompt Hygiene](#prompt-hygiene)
- [Testing Guidelines](#testing-guidelines)

## Setup

### Prerequisites

- Node.js LTS (v18+)
- pnpm (recommended) or npm
- Python 3.10+ (optional, for examples)
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Nerva

# Install dependencies
pnpm install

# Set up pre-commit hooks
pnpm setup:hooks

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run tests to verify setup
pnpm test
```

### Development Environment

We recommend using:
- **VSCode** or **Cursor** with TypeScript and ESLint extensions
- **EditorConfig** support enabled
- **Prettier** for formatting

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write code following our [style guide](#code-style)
- Add tests for new functionality
- Update documentation as needed
- Keep changes focused and atomic

### 3. Test Your Changes

```bash
# Run unit tests
pnpm test:unit

# Run e2e tests
pnpm test:e2e

# Run linter
pnpm lint

# Type check
pnpm typecheck
```

### 4. Commit Your Changes

Follow our [commit conventions](#commit-conventions):

```bash
git add .
git commit -m "feat(kernel): add intent detection router"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title following commit conventions
- Description of changes
- Link to related issues
- Screenshots/demos if applicable

## Code Style

### TypeScript

- Use **strict TypeScript** mode
- Prefer **interfaces** over types for object shapes
- Use **explicit return types** for public functions
- Use **async/await** over raw promises
- Avoid `any`; use `unknown` if needed

```typescript
// Good
interface ToolInput {
  command: string;
  args: string[];
}

async function executeTool(input: ToolInput): Promise<ToolResult> {
  // ...
}

// Bad
async function executeTool(input: any) {
  // ...
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `intent-router.ts`)
- **Classes**: `PascalCase` (e.g., `IntentRouter`)
- **Functions**: `camelCase` (e.g., `parseIntent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_TOKENS`)
- **Interfaces**: `PascalCase` with descriptive names (e.g., `ToolAdapter`, not `ITool`)

### File Organization

```typescript
// 1. Imports (grouped: external, internal, types)
import { readFile } from "fs/promises";
import { parseInput } from "../utils/parser";
import type { ToolInput } from "../types";

// 2. Types and interfaces
interface LocalState {
  // ...
}

// 3. Constants
const MAX_RETRIES = 3;

// 4. Main implementation
export class ToolExecutor {
  // ...
}

// 5. Helper functions (internal)
function validateInput(input: unknown): ToolInput {
  // ...
}
```

### Error Handling

- Use custom error classes
- Always include context in errors
- Log errors before throwing

```typescript
export class ToolExecutionError extends Error {
  constructor(
    public toolName: string,
    public originalError: Error,
    message?: string
  ) {
    super(message || `Tool ${toolName} failed: ${originalError.message}`);
    this.name = "ToolExecutionError";
  }
}
```

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Scopes

Use component names:
- `kernel`, `memory`, `tools`, `agents`, `models`
- `shell`, `cli`, `sdk`
- `fs`, `web`, `process`
- `docs`, `config`

### Examples

```
feat(kernel): add intent detection with planning fallback
fix(tools): prevent path traversal in fs driver
docs(architecture): add sequence diagrams for agent flow
test(e2e): add golden transcript for multi-step planning
refactor(memory): extract vector store interface
```

## Code Review Process

### For Authors

- Keep PRs small and focused (< 400 lines changed)
- Write clear PR descriptions
- Respond to feedback promptly
- Mark conversations as resolved when addressed

### For Reviewers

- Review within 48 hours
- Be constructive and specific
- Test changes locally if needed
- Approve when satisfied, or request changes with clear guidance

### Review Checklist

- [ ] Code follows style guide
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No linter errors
- [ ] Type safety is maintained
- [ ] Error handling is appropriate
- [ ] Performance is acceptable
- [ ] Security considerations addressed

## Prompt Hygiene

Since Nerva is an LLM-native OS, prompt quality is critical.

### Prompt Design Principles

1. **Explicit state**: Always include relevant context
2. **Clear contracts**: Define input/output schemas
3. **Failure modes**: Document expected errors
4. **Examples**: Include few-shot examples for complex tasks
5. **Versioning**: Track prompt changes like code

### Prompt Template Structure

```typescript
export const TOOL_EXECUTOR_PROMPT = {
  version: "1.0.0",
  system: `You are a tool executor...`,
  user: (input: ToolInput) => `Execute: ${input.command}`,
  schema: {
    input: "ToolInput",
    output: "ToolResult"
  }
};
```

### Testing Prompts

- Write unit tests with fixed LLM responses (mocked)
- Write e2e tests with real LLM calls (golden transcripts)
- Test edge cases and failure modes
- Monitor latency and token usage

### Prompt Diffs

When changing prompts:
1. Document the change in `docs/prompts/CHANGELOG.md`
2. Run all affected e2e tests
3. Update golden transcripts if output changes
4. Review impact on latency and cost

## Testing Guidelines

### Unit Tests

- Test pure functions and isolated components
- Mock external dependencies (LLM, filesystem, network)
- Aim for 80%+ coverage on core modules

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseIntent } from "./intent-parser";

describe("parseIntent", () => {
  it("should extract command and arguments", () => {
    const result = parseIntent("search notes for meeting");
    expect(result.action).toBe("search");
    expect(result.target).toBe("notes");
  });
});
```

### E2E Tests

- Test complete user flows
- Use golden transcripts for deterministic outputs
- Enforce latency budgets (p95 < 2s for simple commands)
- Test both local and cloud model paths

```typescript
import { test } from "@playwright/test";
import { NervaShell } from "../helpers/shell";

test("multi-step planning task", async () => {
  const shell = new NervaShell();
  const result = await shell.execute("Index notes, create study plan");
  
  expect(result.steps).toHaveLength(3);
  expect(result.latency.p95).toBeLessThan(2000);
  expect(result.transcript).toMatchSnapshot();
});
```

### Performance Testing

- Track token usage per operation
- Monitor memory consumption
- Benchmark critical paths
- Set up regression detection

## Getting Help

- **Discord**: Join our community server
- **Issues**: Check existing issues or create new ones
- **Discussions**: For questions and ideas
- **Email**: maintainers@nerva.dev

## Recognition

Contributors are recognized in:
- Release notes
- Contributors page
- Annual reports

Thank you for helping build the future of LLM-native computing!

