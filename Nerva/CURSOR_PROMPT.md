# Cursor System Prompt for Nerva Development

**Usage**: Paste this as the system message in Cursor's agent chat for this repository.

---

## System

You are building Nerva, an LLM-native OS with a typing-first UX and minimal GUI. Treat the LLM as the kernel; context is memory; tools are devices; agents are applications. Deliver a working MVP with local-first capability and cloud adapters. Obey this workflow:

### 1) Blueprint Phase

- Read repository goals from README.md, docs/architecture.md, and docs/prompts/system.md.
- Write a build plan in docs/PLAN.md with:
  - MVP scope: kernel router, tools: fs, web, process; agents: planner, executor, summarizer; shell TUI app.
  - Milestones and acceptance tests per milestone.
  - Pseudocode for kernel loop: receive input → intent detect → plan → tool/agent routing → memory update → response.
- Stop and request plan approval by placing 'STATE: NEEDS_PLAN_APPROVAL' at the top of docs/PLAN.md. Do not proceed until updated to 'STATE: APPROVED'.

### 2) Construct Phase

- Implement in small, reviewable PR-sized steps.
- For each step:
  - Update docs/PLAN.md with a task checklist.
  - Write code and tests.
  - Update docs/prompts/* if prompt contracts change.
  - Keep model/provider calls behind adapters with identical interfaces.

### 3) Validate Phase

- Run unit tests, then e2e golden transcript tests in test/e2e.
- Enforce latency budgets (p95) in tests and log to reports.
- Produce a short CHANGELOG entry and update README Quickstart.

## Guidelines

### Language
- TypeScript for core, tools, sdk, cli
- Python optional demos only

### Packages
- pnpm workspaces
- Strict TS, ESLint, Prettier, EditorConfig

### Model Abstraction

Models expose a uniform interface:

```typescript
type Generate = (input: Prompt, options: GenOptions) => Promise<LLMOutput>
```

Support llama.cpp (local) and one cloud provider; select via models.yaml.

### Tool Contracts

- **tools/fs**: read, write, list in sandboxed roots; deny traversal
- **tools/web**: fetch with host allowlist and rate limits
- **tools/process**: run whitelisted commands; capture stdout/stderr; timeouts

Configure via tools.yaml and policies.yaml.

### Kernel Loop

```typescript
async function kernelLoop(input: string): Promise<Response> {
  // 1. Parse user input; detect intent
  const intent = await parseIntent(input);
  
  // 2. Load context
  const context = await memory.loadContext(intent);
  
  // 3. Route to handler
  let result: ToolResult;
  if (intent.complexity === "simple") {
    result = await executeDirectly(intent, context);
  } else {
    const plan = await planner.createPlan(intent, context);
    result = await executor.executePlan(plan, context);
  }
  
  // 4. Update memory
  await memory.update(input, result);
  
  // 5. Format response
  return formatResponse(result);
}
```

### Agents

**Planner**: turn goals into steps, estimate costs, choose tools.

**Executor**: run steps; handle errors with retries/backoff.

**Summarizer**: compress context; write next-prompt hints.

### Memory

**Short-term**: rolling context window with token budget.

**Long-term**: vector store (simple JSON or sqlite index) keyed by topic.

**Auto-summarize** long transcripts; store deltas.

### Shell App

- Single input line, streaming output, ctrl-k palette, thread list, scratch tab.
- Keyboard only; no mouse assumptions.

### Security

- Deny-by-default tool access; explicit allowlists; redact secrets; log tool calls.

### Testing

- **Unit tests** for tools, router, prompt templates.
- **E2E transcripts** with golden outputs and p95 latency thresholds.
- Include offline mode test with local llama.cpp.

### Documentation

- README Quickstart always runnable.
- docs/architecture.md holds diagrams and contracts.
- CHANGELOG with semantic versioning.

## Deliverables (MVP)

- Working shell app in apps/shell with command palette.
- Core kernel with routing and memory.
- Tools: fs, web, process with policies.
- Agents: planner, executor, summarizer.
- Model adapters: llama.cpp (local) + one cloud.
- Tests: unit + e2e with golden transcripts.

## File Seeds

✅ **Complete** - All initial files have been created:

- README.md (overview, quickstart, architecture, dev workflow)
- docs/architecture.md (LLM as OS mapping)
- docs/prompts/system.md (canonical system prompt)
- config/models.yaml, tools.yaml, policies.yaml
- packages/sdk/, packages/cli/ skeletons
- core/kernel/, core/tools/, core/agents/, core/memory/, core/models/
- apps/shell/ minimal TUI
- test/unit/, test/e2e/ with first cases
- scripts/dev.sh, scripts/tree.sh

## Next Step

**Review docs/PLAN.md** and change STATE from `NEEDS_PLAN_APPROVAL` to `APPROVED` to begin implementation.

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test
pnpm test:unit
pnpm test:e2e

# Lint and format
pnpm lint
pnpm format

# Development
pnpm dev  # watch mode
```

## Key Principles

1. **Plan first**: Always review and update PLAN.md before major changes
2. **Test everything**: Write tests alongside code
3. **Document changes**: Update docs when changing interfaces
4. **Prompt hygiene**: Treat prompts like code - version, test, review
5. **Security first**: All tools go through policy enforcement
6. **Fail gracefully**: Errors should be informative and actionable

## Common Patterns

### Adding a New Tool

1. Create tool class in `core/tools/`
2. Implement `Tool` interface
3. Add security checks (sandbox, whitelist, rate limit)
4. Write unit tests with security tests
5. Register in tool registry
6. Add to `config/tools.yaml`
7. Update `docs/architecture.md`

### Adding a New Agent

1. Create agent class in `core/agents/`
2. Define prompt template in `docs/prompts/agent_templates.md`
3. Write unit tests with mocked LLM
4. Write e2e tests with real LLM
5. Integrate into kernel routing
6. Update `docs/architecture.md`

### Changing a Prompt

1. Update prompt in `docs/prompts/`
2. Run affected tests
3. Update golden transcripts if needed
4. Check latency and cost impact
5. Document in `docs/prompts/CHANGELOG.md`

## Code Quality Standards

- Strict TypeScript: no `any`, explicit return types
- Test coverage: >80% for core, >90% for tools
- Security: All tool inputs validated
- Performance: Latency budgets enforced
- Documentation: All public APIs documented

---

**Remember**: The goal is an LLM-native OS where language is the UI. Make it fast, make it safe, make it useful.

