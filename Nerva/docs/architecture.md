# Nerva Architecture

## Overview

Nerva reimagines the operating system with the LLM at its core. Instead of a traditional kernel managing processes and memory, Nerva's kernel routes natural language intents to tools and agents, managing context windows as its primary memory abstraction.

## Core Principles

### LLM as Kernel

The language model is the central orchestrator that:
- Parses natural language input into structured intents
- Routes requests to appropriate tools and agents
- Manages context window as working memory
- Coordinates multi-step operations
- Handles errors and retries

### Context as Memory

```
┌─────────────────────────────────────┐
│      Context Window (Working)       │
│  • User input history               │
│  • Recent tool outputs              │
│  • Active task state                │
│  • Planning artifacts               │
└─────────────────────────────────────┘
            ↕
┌─────────────────────────────────────┐
│      Vector Store (Long-term)       │
│  • Summarized conversations         │
│  • Knowledge base                   │
│  • User preferences                 │
│  • Historical patterns              │
└─────────────────────────────────────┘
```

**Token Budget Management**:
- Rolling window with automatic summarization
- Priority-based context retention
- Lazy loading of historical context
- Explicit memory refresh commands

### Tools as Devices

Traditional OS device drivers map to Nerva tools:

| Traditional OS | Nerva Equivalent |
|----------------|------------------|
| Filesystem driver | `fs` tool |
| Network stack | `web` tool |
| Process manager | `process` tool |
| Clipboard API | `clipboard` tool |
| System info | `system` tool |

**Tool Interface**:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(input: unknown): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: ToolError;
  metadata: {
    duration_ms: number;
    tokens_used?: number;
    cost?: number;
  };
}
```

### Agents as Applications

Traditional applications become specialized agents:

```
┌──────────────────────────────────────────┐
│            Agent Hierarchy               │
├──────────────────────────────────────────┤
│  Planner Agent                           │
│  • Breaks goals into steps               │
│  • Estimates costs and time              │
│  • Selects appropriate tools             │
│  • Generates execution plan              │
├──────────────────────────────────────────┤
│  Executor Agent                          │
│  • Runs plan steps sequentially          │
│  • Handles tool invocations              │
│  • Manages retries and errors            │
│  • Reports progress                      │
├──────────────────────────────────────────┤
│  Summarizer Agent                        │
│  • Compresses conversation history       │
│  • Extracts key information              │
│  • Generates continuations               │
│  • Updates long-term memory              │
└──────────────────────────────────────────┘
```

### Prompts as Contracts

System prompts define interfaces between components:

```typescript
interface PromptContract {
  version: string;
  role: "system" | "user" | "assistant";
  template: string | ((vars: Record<string, unknown>) => string);
  input_schema: JSONSchema;
  output_schema: JSONSchema;
  examples?: Array<{ input: unknown; output: unknown }>;
  failure_modes?: string[];
}
```

## System Architecture

### High-Level Flow

```
┌─────────────┐
│    User     │
│   Input     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Intent Parser               │
│  • Extract action, target, params   │
│  • Classify complexity              │
│  • Detect ambiguity                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Router                      │
│  Simple? ──→ Direct tool execution  │
│  Complex? ─→ Planning agent         │
│  Ambiguous? → Clarification         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Orchestration Layer            │
│  • Execute plan steps               │
│  • Stream partial results           │
│  • Handle failures                  │
│  • Update memory                    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Response Formatter             │
│  • Format output for UI             │
│  • Add metadata (cost, time)        │
│  • Log transcript                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Shell     │
│   Display   │
└─────────────┘
```

### Kernel Loop

```typescript
async function kernelLoop(input: string): Promise<Response> {
  // 1. Parse intent
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

## Component Details

### Kernel (`core/kernel/`)

**Responsibilities**:
- Message bus for inter-component communication
- State store for active tasks
- Tool registry and invocation
- Routing policies (simple vs. complex, local vs. cloud)

**Key Files**:
- `kernel.ts`: Main orchestration loop
- `router.ts`: Intent classification and routing
- `message-bus.ts`: Event-driven communication
- `state-store.ts`: In-memory task state

### Memory (`core/memory/`)

**Responsibilities**:
- Context window management (rolling, pruning)
- Vector store for long-term memory
- Conversation logging and retrieval
- Automatic summarization

**Key Files**:
- `context-manager.ts`: Token budget and window management
- `vector-store.ts`: Embedding and similarity search
- `summarizer.ts`: Conversation compression
- `logger.ts`: Transcript persistence

### Tools (`core/tools/`)

**Standard Tools**:
- `fs.ts`: Filesystem operations (read, write, list, search)
- `web.ts`: HTTP requests and scraping
- `process.ts`: Command execution
- `clipboard.ts`: Clipboard read/write
- `system.ts`: System information

**Tool Security**:
- Sandboxed execution
- Resource limits (time, memory, network)
- Input validation
- Output sanitization
- Audit logging

### Agents (`core/agents/`)

**Planner Agent**:
```typescript
interface Plan {
  steps: Array<{
    action: string;
    tool: string;
    inputs: Record<string, unknown>;
    depends_on?: number[];
  }>;
  estimated_cost: number;
  estimated_duration_ms: number;
}

async function createPlan(
  intent: Intent,
  context: Context
): Promise<Plan>;
```

**Executor Agent**:
```typescript
async function executePlan(
  plan: Plan,
  context: Context
): Promise<ExecutionResult> {
  const results: StepResult[] = [];
  
  for (const step of plan.steps) {
    // Check dependencies
    if (step.depends_on) {
      await waitForSteps(step.depends_on, results);
    }
    
    // Execute step with retry logic
    const result = await executeStepWithRetry(step, context);
    results.push(result);
    
    // Stream partial result to UI
    await streamPartialResult(result);
  }
  
  return { steps: results, summary: summarize(results) };
}
```

**Summarizer Agent**:
```typescript
async function summarize(
  conversation: Message[],
  targetTokens: number
): Promise<Summary> {
  // Extract key information
  const keyPoints = extractKeyPoints(conversation);
  
  // Compress to target size
  const compressed = await compress(keyPoints, targetTokens);
  
  // Generate continuation hints
  const hints = generateHints(compressed);
  
  return { compressed, hints };
}
```

### Models (`core/models/`)

**Unified Interface**:
```typescript
interface ModelAdapter {
  generate(prompt: Prompt, options: GenOptions): Promise<LLMOutput>;
  embed(text: string): Promise<Embedding>;
  getCapabilities(): ModelCapabilities;
}

interface GenOptions {
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

interface LLMOutput {
  text: string;
  finish_reason: "stop" | "length" | "error";
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: Record<string, unknown>;
}
```

**Adapters**:
- `LocalLLMAdapter`: llama.cpp via node bindings
- `OpenAIAdapter`: OpenAI API
- `AnthropicAdapter`: Anthropic API
- `FallbackAdapter`: Cloud-burst on local failure

## Data Flow Diagrams

### Simple Query Flow

```
User: "What files are in the workspace?"
  │
  ├─→ Intent Parser
  │     └─→ { action: "list", target: "files", scope: "workspace" }
  │
  ├─→ Router
  │     └─→ [Simple] Direct tool execution
  │
  ├─→ fs.list("/workspace")
  │     └─→ ["README.md", "src/", "tests/"]
  │
  └─→ Response Formatter
        └─→ "Found 3 items: README.md, src/, tests/"
```

### Complex Multi-Step Flow

```
User: "Index my notes, create a study plan, and schedule tasks"
  │
  ├─→ Intent Parser
  │     └─→ { complexity: "complex", goals: [...] }
  │
  ├─→ Router
  │     └─→ [Complex] Planning agent
  │
  ├─→ Planner Agent
  │     └─→ Plan:
  │         1. fs.search("*.md") → notes
  │         2. llm.analyze(notes) → topics
  │         3. llm.plan(topics) → study_plan
  │         4. task.create(study_plan) → tasks
  │
  ├─→ Executor Agent
  │     ├─→ Execute step 1... ✓
  │     ├─→ Execute step 2... ✓
  │     ├─→ Execute step 3... ✓
  │     └─→ Execute step 4... ✓
  │
  ├─→ Summarizer Agent
  │     └─→ "Indexed 23 notes, created 5-week plan, added 12 tasks"
  │
  └─→ Memory Update
        └─→ Store in vector database
```

## Security Model

### Sandboxing

- Filesystem access limited to configured roots
- Network access via allowlist
- Command execution via whitelist
- No access to system directories

### Policy Enforcement

```yaml
# policies.yaml
filesystem:
  allow_roots:
    - ./workspace
    - ./scratch
  deny_patterns:
    - ".*"
    - "**/node_modules/**"
  max_file_size: 10MB

network:
  allowed_hosts:
    - "*.wikipedia.org"
    - "api.example.com"
  rate_limit: 10/minute

commands:
  whitelist:
    - git
    - npm
    - python
  timeout: 30s
```

## Performance Considerations

### Latency Budget

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Simple query (local) | 100ms | 300ms | 500ms |
| Simple query (cloud) | 500ms | 1500ms | 3000ms |
| Complex plan (local) | 2s | 5s | 10s |
| Complex plan (cloud) | 3s | 8s | 15s |

### Optimization Strategies

1. **Local-first**: Prefer local models for simple queries
2. **Streaming**: Stream partial results for long operations
3. **Caching**: Cache tool outputs and embeddings
4. **Batching**: Batch multiple tool calls
5. **Parallelization**: Execute independent steps in parallel

## Testing Strategy

### Unit Tests
- Tool implementations
- Router logic
- Memory management
- Prompt templates

### Integration Tests
- Agent orchestration
- Model adapters
- Multi-tool flows

### E2E Tests
- Golden transcripts
- Latency budgets
- Cost tracking
- Error handling

## Future Extensions

- Multi-user support with context isolation
- Plugin system for custom tools/agents
- Distributed execution across machines
- Real-time collaboration
- Mobile/web clients
- Visual programming interface

