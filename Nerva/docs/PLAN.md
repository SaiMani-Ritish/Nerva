# Nerva MVP Build Plan

**STATE**: APPROVED

## MVP Scope

Build a minimal but functional LLM-native OS with:
- Core kernel for routing and orchestration
- Three essential tools: fs (filesystem), web (HTTP), process (command execution)
- Three agents: planner, executor, summarizer
- TUI shell application with command palette
- Model adapters: local (llama.cpp) + cloud (OpenAI or Anthropic)
- Configuration system with security policies
- Test suite: unit tests + e2e golden transcripts

**Out of Scope for MVP**:
- GUI sketch app (TUI only)
- Multi-user support
- Real-time collaboration
- Mobile clients
- Plugin system

## Milestones

### Milestone 1: Foundation (Week 1)

**Goal**: Set up repository structure, TypeScript configuration, and basic kernel scaffold

**Acceptance Criteria**:
- [x] Repository structure created
- [ ] TypeScript, ESLint, Prettier configured
- [ ] Package.json with workspace setup
- [ ] Basic kernel module with message bus
- [ ] Development scripts (dev.sh, build, test)
- [ ] All files compile without errors

**Dependencies**: None

### Milestone 2: Tools Layer (Week 1-2)

**Goal**: Implement core tools with security policies

**Acceptance Criteria**:
- [ ] `fs` tool: read, write, list, search with sandbox
- [ ] `web` tool: fetch with allowlist and rate limiting
- [ ] `process` tool: exec with whitelist and timeout
- [ ] Policy enforcement layer
- [ ] Unit tests for each tool (>80% coverage)
- [ ] Security tests (path traversal, command injection, etc.)

**Dependencies**: Milestone 1

### Milestone 3: Model Adapters (Week 2)

**Goal**: Unified model interface with local and cloud adapters

**Acceptance Criteria**:
- [ ] Model adapter interface defined
- [ ] Local adapter: llama.cpp bindings
- [ ] Cloud adapter: OpenAI or Anthropic
- [ ] Fallback adapter: local-first with cloud-burst
- [ ] Model registry from config/models.yaml
- [ ] Unit tests with mocked responses
- [ ] Integration test with real models

**Dependencies**: Milestone 1

### Milestone 4: Memory System (Week 2-3)

**Goal**: Context window management and long-term storage

**Acceptance Criteria**:
- [ ] Context manager with token budget
- [ ] Rolling window with automatic pruning
- [ ] Vector store (simple JSON or sqlite)
- [ ] Embedding generation and similarity search
- [ ] Conversation logger
- [ ] Unit tests for memory operations
- [ ] Performance test (latency < 50ms for lookups)

**Dependencies**: Milestone 3

### Milestone 5: Agents (Week 3)

**Goal**: Implement three core agents

**Acceptance Criteria**:
- [ ] Planner agent with prompt template
- [ ] Executor agent with retry logic
- [ ] Summarizer agent with compression
- [ ] Agent tests with golden outputs
- [ ] Integration tests for agent orchestration
- [ ] Latency within budget (< 5s for planning)

**Dependencies**: Milestones 3, 4

### Milestone 6: Kernel Orchestration (Week 3-4)

**Goal**: Complete kernel loop with routing logic

**Acceptance Criteria**:
- [ ] Intent parser
- [ ] Router: simple vs. complex classification
- [ ] Tool invocation layer
- [ ] Agent delegation layer
- [ ] Memory update integration
- [ ] Error handling and recovery
- [ ] Unit tests for routing logic
- [ ] E2E tests for kernel loop

**Dependencies**: Milestones 2, 5

### Milestone 7: Shell TUI (Week 4)

**Goal**: Interactive terminal interface

**Acceptance Criteria**:
- [ ] Input line with streaming output
- [ ] Command palette (Ctrl+K)
- [ ] Thread management (Ctrl+T)
- [ ] Status bar with model/thread info
- [ ] Keyboard navigation (all features accessible)
- [ ] Scratchpad (Ctrl+P)
- [ ] User acceptance testing

**Dependencies**: Milestone 6

### Milestone 8: Configuration & Polish (Week 4-5)

**Goal**: Configuration system and developer experience

**Acceptance Criteria**:
- [ ] config/models.yaml loading
- [ ] config/tools.yaml loading
- [ ] config/policies.yaml enforcement
- [ ] Environment variable support
- [ ] CLI: `nerva run`, `nerva model pull`
- [ ] README Quickstart validated (can run in < 5 min)
- [ ] Error messages are actionable
- [ ] Documentation complete

**Dependencies**: All previous

### Milestone 9: Testing & Release (Week 5)

**Goal**: Comprehensive test coverage and initial release

**Acceptance Criteria**:
- [ ] Unit test coverage > 80% on core modules
- [ ] E2E golden transcripts for common flows
- [ ] Latency benchmarks meet budgets
- [ ] Security audit (basic threats)
- [ ] Performance profiling
- [ ] CHANGELOG updated
- [ ] v0.1.0 release tag
- [ ] Demo video created

**Dependencies**: All previous

## Technical Design

### Kernel Loop Pseudocode

```typescript
async function kernelLoop(input: string, context: Context): Promise<Response> {
  // 1. Parse intent
  const intent = await intentParser.parse(input);
  
  // 2. Check for clarification needs
  if (intent.needsClarification) {
    return askClarification(intent.questions);
  }
  
  // 3. Load relevant context from memory
  const relevantContext = await memory.retrieve(intent, context);
  
  // 4. Route based on complexity
  let result: Result;
  if (intent.complexity === "simple") {
    // Direct tool execution
    const tool = tools.get(intent.tool);
    result = await tool.execute(intent.inputs);
  } else {
    // Multi-step planning and execution
    const plan = await agents.planner.createPlan(intent, relevantContext);
    result = await agents.executor.executePlan(plan);
  }
  
  // 5. Update memory
  await memory.store({
    input,
    intent,
    result,
    timestamp: Date.now()
  });
  
  // 6. Summarize if context is getting full
  if (memory.contextSize > memory.tokenBudget * 0.8) {
    await agents.summarizer.compressContext();
  }
  
  // 7. Format response
  return formatResponse(result);
}
```

### Error Handling Strategy

```typescript
class ToolExecutionError extends Error {
  constructor(
    public tool: string,
    public code: string,
    public recoverable: boolean,
    message: string
  ) {
    super(message);
  }
}

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry permanent errors
      if (error instanceof ToolExecutionError && !error.recoverable) {
        throw error;
      }
      
      // Exponential backoff
      if (attempt < options.maxAttempts) {
        await sleep(options.baseDelay * Math.pow(2, attempt - 1));
      }
    }
  }
  
  throw lastError;
}
```

### Security Model

```typescript
interface SecurityPolicy {
  filesystem: {
    allowedRoots: string[];
    denyPatterns: RegExp[];
    maxFileSize: number;
  };
  network: {
    allowedHosts: string[];
    rateLimit: { requests: number; window: number };
  };
  commands: {
    whitelist: string[];
    timeout: number;
  };
}

function enforcePolicy(tool: string, inputs: unknown): void {
  const policy = policies[tool];
  
  if (tool === "fs") {
    const path = (inputs as any).path;
    
    // Check sandbox
    if (!isInSandbox(path, policy.filesystem.allowedRoots)) {
      throw new SecurityError("Path outside sandbox");
    }
    
    // Check deny patterns
    if (policy.filesystem.denyPatterns.some(p => p.test(path))) {
      throw new SecurityError("Path matches deny pattern");
    }
  }
  
  if (tool === "process") {
    const command = (inputs as any).command;
    
    // Check whitelist
    if (!policy.commands.whitelist.includes(command)) {
      throw new SecurityError("Command not in whitelist");
    }
  }
  
  // ... other policies
}
```

### Memory Management Strategy

```typescript
class ContextManager {
  private tokenBudget: number = 100000; // 100K tokens
  private currentTokens: number = 0;
  private messages: Message[] = [];
  
  async addMessage(msg: Message): Promise<void> {
    const tokens = estimateTokens(msg.content);
    this.currentTokens += tokens;
    this.messages.push(msg);
    
    // Prune if over budget
    if (this.currentTokens > this.tokenBudget * 0.8) {
      await this.prune();
    }
  }
  
  private async prune(): Promise<void> {
    // Keep system message and recent history
    const systemMsg = this.messages[0];
    const recentMsgs = this.messages.slice(-10);
    
    // Summarize the middle
    const toSummarize = this.messages.slice(1, -10);
    const summary = await summarizer.compress(toSummarize, {
      targetTokens: 2000
    });
    
    // Reconstruct messages
    this.messages = [
      systemMsg,
      { role: "system", content: `Previous context: ${summary.text}` },
      ...recentMsgs
    ];
    
    // Recalculate tokens
    this.currentTokens = this.messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe("IntentParser", () => {
  it("should parse simple file list command", () => {
    const intent = parse("list files in src/");
    expect(intent.action).toBe("list");
    expect(intent.tool).toBe("fs");
    expect(intent.inputs.path).toBe("src/");
    expect(intent.complexity).toBe("simple");
  });
  
  it("should detect complex multi-step intent", () => {
    const intent = parse("search my notes and create a study plan");
    expect(intent.complexity).toBe("complex");
    expect(intent.requiresPlanning).toBe(true);
  });
});

describe("FilesystemTool", () => {
  it("should prevent path traversal", () => {
    expect(() => {
      fs.read("../../etc/passwd");
    }).toThrow(SecurityError);
  });
  
  it("should read files within sandbox", async () => {
    const content = await fs.read("workspace/test.txt");
    expect(content).toBe("test content");
  });
});
```

### E2E Golden Transcripts

```typescript
test("golden: multi-step research task", async () => {
  const shell = new NervaShell();
  
  const transcript = [
    {
      input: "search arxiv for transformer papers",
      expectedSteps: ["web.search"],
      expectedOutputPattern: /Found \d+ papers/
    },
    {
      input: "summarize the top result",
      expectedSteps: ["web.fetch", "llm.summarize"],
      expectedOutputPattern: /Summary:/,
      maxLatency: 5000
    }
  ];
  
  for (const turn of transcript) {
    const start = Date.now();
    const result = await shell.execute(turn.input);
    const latency = Date.now() - start;
    
    expect(result.steps).toEqual(turn.expectedSteps);
    expect(result.output).toMatch(turn.expectedOutputPattern);
    if (turn.maxLatency) {
      expect(latency).toBeLessThan(turn.maxLatency);
    }
  }
});
```

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM hallucination causes incorrect tool calls | High | Medium | Schema validation, dry-run mode |
| Token budget exceeded causing errors | Medium | High | Automatic summarization, warnings |
| Security vulnerability in tool execution | High | Low | Comprehensive security tests, audit |
| Local model too slow for interactive use | Medium | Medium | Cloud fallback, smaller models |
| Dependencies break build | Low | Medium | Lock file, CI/CD |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Quickstart time | < 5 minutes | Timed manual test |
| Simple query latency (local) | p95 < 500ms | Benchmark |
| Complex query latency (local) | p95 < 5s | Benchmark |
| Test coverage (core) | > 80% | Coverage report |
| Security tests passing | 100% | Test suite |
| Documentation completeness | All API documented | Manual review |

## Next Steps

1. **Get plan approval**: Update STATE to APPROVED
2. **Set up project**: Milestone 1 tasks
3. **Implement incrementally**: One milestone at a time
4. **Test continuously**: Every PR includes tests
5. **Update docs**: Keep architecture docs current
6. **Review regularly**: Weekly progress review

---

**To approve this plan**: Change STATE at the top to `STATE: APPROVED`

**To request changes**: Add comments below and keep STATE as `NEEDS_PLAN_APPROVAL`

