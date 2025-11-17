# From Apps to Intents: Building an LLM-Native OS

## Introduction

For decades, operating systems have been built around the same core abstractions: files, processes, memory, and devices. User interfaces have evolved from command lines to GUIs to touch interfaces, but the fundamental model remains unchanged. What if we reimagined the OS with language as the primary interface and an LLM as the kernel?

This is the motivation behind Nerva: an operating system where you express **intent** rather than navigate **applications**.

## The Problem with Traditional OS Design

### Application-Centric Model

Traditional operating systems are organized around applications:

```
User Intent: "I want to organize my photos by date"
  ↓
Traditional OS Path:
  1. Open file browser
  2. Navigate to photos directory
  3. Sort by date (if lucky, built-in)
  4. If not, open terminal
  5. Google "bash script sort files by date"
  6. Copy-paste script
  7. Debug script
  8. Run script
  9. Verify results
```

This requires the user to:
- Know which application to use
- Understand how to navigate to the right state
- Bridge the gap between intent and execution
- Context-switch between multiple tools

### GUI Friction

Graphical interfaces promised to make computers easier, but they introduced new friction:

- **Hidden functionality**: Features buried in menus and dialogs
- **Mouse tax**: Constant switching between keyboard and mouse
- **Context switching**: Alt-tabbing between applications
- **Spatial memory**: Remembering where things are
- **Visual clutter**: Toolbars, sidebars, status bars

Research shows that expert users prefer keyboard interfaces because they:
- Maintain flow state
- Reduce decision fatigue
- Enable muscle memory
- Support composability

## LLM-Native Architecture

### Mapping OS Primitives to LLM Constructs

| Traditional OS | LLM-Native OS |
|----------------|---------------|
| Kernel | LLM (intent router) |
| RAM | Context window |
| Disk | Vector store + files |
| Device drivers | Tool adapters |
| Applications | Specialized agents |
| System calls | Tool calls |
| APIs | Prompt contracts |
| Processes | Conversation threads |
| Scheduling | Token budget management |

### LLM as Kernel

In a traditional OS, the kernel:
- Manages hardware resources
- Schedules processes
- Handles I/O
- Enforces security

In Nerva, the LLM kernel:
- **Manages cognitive resources** (context, attention, memory)
- **Schedules tasks** (planning, routing to agents)
- **Handles I/O** (tools for filesystem, network, processes)
- **Enforces security** (sandboxing, policies, validation)

### Context Window as Memory

Traditional OS memory hierarchy:

```
CPU Registers (fastest, smallest)
  ↓
L1/L2/L3 Cache
  ↓
RAM
  ↓
Disk (slowest, largest)
```

LLM-native memory hierarchy:

```
Current Input (immediate attention)
  ↓
Recent Context (active working memory)
  ↓
Summarized History (compressed memory)
  ↓
Vector Store (searchable long-term memory)
  ↓
Filesystem (permanent storage)
```

**Key insight**: Token budget management is analogous to memory management. Just as an OS must decide what to keep in RAM vs. swap to disk, an LLM-native OS must decide what to keep in context vs. summarize or store in long-term memory.

### Tool Calls as System Calls

Traditional system calls:
```c
int fd = open("/path/to/file", O_RDONLY);
char buffer[1024];
read(fd, buffer, sizeof(buffer));
close(fd);
```

LLM-native tool calls:
```typescript
const result = await tools.fs.read({
  path: "/path/to/file",
  encoding: "utf-8"
});
```

The LLM kernel translates natural language intent into tool calls:

```
User: "Show me the contents of README.md"
  ↓
LLM Kernel: {
  tool: "fs.read",
  parameters: {
    path: "README.md"
  }
}
  ↓
Tool Execution: "# Nerva\n\nAn LLM-native OS..."
```

### Prompts as APIs

In traditional software, APIs define interfaces:

```typescript
interface FileSystem {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(path: string): Promise<string[]>;
}
```

In LLM-native software, prompts define interfaces:

```typescript
const PLANNER_PROMPT = {
  system: `You are a planning agent. Given a goal, break it down into steps.
  
Output format:
{
  "steps": [
    {
      "action": "tool_name",
      "inputs": {...},
      "rationale": "why this step"
    }
  ],
  "estimated_time_ms": number,
  "estimated_cost": number
}`,
  
  input_schema: {
    goal: "string",
    available_tools: "Tool[]",
    context: "Context"
  },
  
  output_schema: "Plan"
};
```

Prompts are versioned, tested, and evolved like code.

## Minimizing GUI: Keystrokes, Transcripts, and Visible State

### Why Keyboard-First?

**Cognitive load**: Every time you reach for the mouse, you:
1. Break typing flow
2. Locate cursor position
3. Navigate to target
4. Switch back to keyboard

This takes 2-3 seconds and breaks flow state.

**Composability**: Keyboard interfaces enable composition:

```bash
# Traditional shell
find . -name "*.ts" | xargs grep "TODO" | wc -l

# Nerva
"count TODOs in TypeScript files"
```

Both are composable, but natural language is more intuitive.

### Transcripts as UI

The transcript is the primary UI because:

1. **Complete history**: Every interaction is preserved
2. **Searchable**: Find past conversations instantly
3. **Resumable**: Pick up where you left off
4. **Exportable**: Share or archive conversations
5. **Debuggable**: See exactly what happened

Traditional GUIs are ephemeral—once you navigate away, the state is lost. Transcripts make state permanent and reviewable.

### Visible State

Traditional GUIs often hide what's happening:

```
[Installing... ████████░░ 80%]
```

What's it doing? No idea. Just wait.

Nerva makes execution transparent:

```
[Step 1/4] Searching for markdown files...
  Found 23 files in workspace/
  
[Step 2/4] Extracting topics...
  Processing: notes/machine-learning.md (45 topics)
  Processing: notes/databases.md (32 topics)
  ...
  Identified 12 unique main topics
  
[Step 3/4] Analyzing knowledge gaps...
  Strong: Neural networks, Transformers
  Medium: Optimization, Regularization
  Weak: Reinforcement learning, GANs
  
[Step 4/4] Generating study schedule...
  Week 1-2: Reinforcement learning basics
  Week 3-4: GANs theory and practice
  Week 5: Project implementation
```

Users can:
- See progress in real-time
- Understand what's happening
- Intervene if needed
- Trust the system

## Local-First with Cloud-Burst

### The Privacy-Performance Tradeoff

**Cloud models**:
- ✓ State-of-the-art capabilities
- ✓ No local compute needed
- ✗ Privacy concerns
- ✗ Latency (network round-trip)
- ✗ Cost per token

**Local models**:
- ✓ Complete privacy
- ✓ No network latency
- ✓ No usage costs
- ✗ Limited capabilities
- ✗ Requires powerful hardware

### Hybrid Strategy

Nerva uses a **local-first, cloud-burst** strategy:

```
Simple queries → Local model (fast, private, free)
  ↓ (if insufficient)
Complex queries → Cloud model (capable, costly)
```

**Decision criteria**:
```typescript
function selectModel(intent: Intent): ModelAdapter {
  const complexity = estimateComplexity(intent);
  const localCapable = localModel.canHandle(complexity);
  const userPreference = config.modelPreference; // "local" | "cloud" | "auto"
  
  if (userPreference === "local" || 
      (userPreference === "auto" && localCapable)) {
    return localModel;
  }
  
  // Fallback to cloud for complex tasks
  return cloudModel;
}
```

**Examples**:

```
"list files" → Local (trivial routing)
"search files for TODO" → Local (simple tool call)
"summarize this paper" → Local if < 8K tokens, else cloud
"create a study plan from my notes" → Cloud (multi-step planning)
```

### Implementation

```typescript
class FallbackAdapter implements ModelAdapter {
  constructor(
    private local: LocalLLMAdapter,
    private cloud: CloudLLMAdapter
  ) {}
  
  async generate(prompt: Prompt, options: GenOptions): Promise<LLMOutput> {
    // Try local first
    try {
      const result = await this.local.generate(prompt, {
        ...options,
        timeout: 5000 // 5 second timeout for local
      });
      
      // Check quality threshold
      if (result.confidence > 0.8) {
        return result;
      }
    } catch (error) {
      console.log("Local model failed, falling back to cloud:", error);
    }
    
    // Fallback to cloud
    return await this.cloud.generate(prompt, options);
  }
}
```

## Prompt Contracts as APIs

### Why Prompt Engineering is Software Engineering

In traditional software:
```typescript
// API with typed interface
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

Test:
```typescript
test("calculateTotal", () => {
  expect(calculateTotal([
    { price: 10 },
    { price: 20 }
  ])).toBe(30);
});
```

In LLM-native software:
```typescript
// API with prompt interface
const CALCULATOR_PROMPT = {
  system: "Calculate the total price of items.",
  user: (items: Item[]) => 
    `Items: ${JSON.stringify(items)}\nTotal:`,
  parse: (output: string) => parseFloat(output)
};
```

Test:
```typescript
test("CALCULATOR_PROMPT", async () => {
  const result = await llm.generate(
    CALCULATOR_PROMPT.user([
      { price: 10 },
      { price: 20 }
    ])
  );
  expect(CALCULATOR_PROMPT.parse(result)).toBe(30);
});
```

Both are:
- Versioned
- Tested
- Documented
- Refactored

### Making Prompts Reliable

**1. Explicit schemas**:

```typescript
const INTENT_PARSER_PROMPT = {
  system: `Parse user intent into structured format.

Output JSON schema:
{
  "action": "list" | "search" | "create" | "delete" | ...,
  "target": string,
  "parameters": Record<string, unknown>,
  "complexity": "simple" | "complex",
  "confidence": number
}`,

  examples: [
    {
      input: "list files in src/",
      output: {
        action: "list",
        target: "files",
        parameters: { path: "src/" },
        complexity: "simple",
        confidence: 0.95
      }
    }
  ]
};
```

**2. Few-shot examples**:

Provide 3-5 examples of desired input/output pairs. This dramatically improves reliability.

**3. Chain-of-thought prompting**:

```typescript
const PLANNER_PROMPT = `Create a plan for the goal.

Think step-by-step:
1. What is the end goal?
2. What information is needed?
3. What tools are available?
4. What is the optimal sequence?
5. What could go wrong?

Then output the plan in JSON format.`;
```

**4. Output validation**:

```typescript
function validatePlan(output: unknown): Plan {
  const schema = z.object({
    steps: z.array(z.object({
      action: z.string(),
      inputs: z.record(z.unknown()),
      rationale: z.string()
    })),
    estimated_time_ms: z.number().positive(),
    estimated_cost: z.number().positive()
  });
  
  return schema.parse(output);
}
```

**5. Golden transcripts**:

Record successful interactions and replay them as regression tests:

```typescript
test("golden transcript: multi-step planning", async () => {
  const transcript = loadTranscript("golden/multi-step-planning.json");
  
  for (const turn of transcript) {
    const output = await kernel.process(turn.input);
    expect(output).toMatchSnapshot();
  }
});
```

### Prompt Diffs in Code Review

When a prompt changes, review should check:

1. **Intent preservation**: Does it still achieve the goal?
2. **Output format**: Are breaking changes documented?
3. **Test coverage**: Do tests pass with new prompt?
4. **Latency impact**: Did it get slower?
5. **Cost impact**: Does it use more tokens?

Example PR:

```diff
const SUMMARIZER_PROMPT = {
- system: "Summarize the conversation concisely."
+ system: `Summarize the conversation.
+ 
+ Guidelines:
+ - Extract key decisions
+ - Note open questions
+ - Highlight action items
+ - Keep under 200 words`
}
```

Review checklist:
- [ ] Tests updated for new output format
- [ ] Token usage within budget (measured)
- [ ] Latency acceptable (< 2s p95)
- [ ] Examples added to prompt template

## Making Cursor and Agents Reliable

### The Vision: Self-Improving Systems

Nerva aims to be **developed by AI**. To achieve this, we need:

1. **Clear specifications**: Architecture docs, requirements, tests
2. **Explicit contracts**: Prompt templates, schemas, APIs
3. **Verifiable outputs**: Tests, linters, type checkers
4. **Iterative refinement**: Continuous feedback loop

### Cursor-Friendly Development

**1. Structured repository**:

```
docs/
  architecture.md    ← High-level design
  ux.md             ← UX principles
  prompts/          ← Prompt templates
    system.md       ← Kernel system prompt
    agents.md       ← Agent prompt contracts
    
test/
  unit/             ← Fast, focused tests
  e2e/              ← End-to-end golden transcripts
  
core/
  kernel/
    README.md       ← Component documentation
    *.ts           ← Implementation
    *.test.ts      ← Co-located tests
```

**2. Explicit TODOs**:

```typescript
// TODO(cursor): Implement retry logic with exponential backoff
// See: docs/architecture.md#error-handling
// Test: test/unit/executor.test.ts#retry-logic
async function executeWithRetry(step: Step): Promise<Result> {
  throw new Error("Not implemented");
}
```

**3. Type-driven development**:

```typescript
// Define types first
interface Plan {
  steps: Step[];
  estimated_time_ms: number;
  estimated_cost: number;
}

interface Step {
  action: string;
  inputs: Record<string, unknown>;
  rationale: string;
}

// Implement with type safety
async function createPlan(intent: Intent): Promise<Plan> {
  // Type checker ensures we return valid Plan
}
```

**4. Test-driven prompts**:

```typescript
// Define test first
test("planner creates valid multi-step plan", async () => {
  const plan = await planner.createPlan({
    goal: "Index notes and create study plan",
    tools: [fs, llm, task]
  });
  
  expect(plan.steps).toHaveLength(4);
  expect(plan.steps[0].action).toBe("fs.search");
  expect(plan.estimated_time_ms).toBeGreaterThan(0);
});

// Then implement prompt to pass test
```

### Agent Autonomy

For agents to work reliably:

**1. Constrained action space**:

```typescript
// Good: Limited, well-defined actions
type AgentAction = 
  | { type: "call_tool"; tool: string; inputs: unknown }
  | { type: "ask_user"; question: string }
  | { type: "complete"; result: unknown };

// Bad: Unbounded action space
type AgentAction = string; // Anything goes!
```

**2. Explicit state machines**:

```typescript
type ExecutorState = 
  | { phase: "planning"; plan?: Plan }
  | { phase: "executing"; plan: Plan; currentStep: number }
  | { phase: "completed"; result: Result }
  | { phase: "failed"; error: Error };

async function executeStep(state: ExecutorState): Promise<ExecutorState> {
  switch (state.phase) {
    case "planning":
      // Can only transition to executing or failed
      return { phase: "executing", plan: state.plan!, currentStep: 0 };
    // ...
  }
}
```

**3. Sandboxed execution**:

```typescript
// All tool calls go through security layer
class ToolExecutor {
  async execute(tool: string, inputs: unknown): Promise<Result> {
    // 1. Validate tool exists
    // 2. Check permissions
    // 3. Validate inputs
    // 4. Execute with timeout
    // 5. Validate outputs
    // 6. Log for audit
  }
}
```

**4. Observability**:

```typescript
// Every agent action is logged
logger.info("agent:planner:start", { intent, context });
logger.info("agent:planner:step", { step, rationale });
logger.info("agent:planner:complete", { plan, time_ms });
```

This enables:
- Debugging when things go wrong
- Understanding agent behavior
- Improving prompts based on logs
- Cost and latency tracking

## Conclusion

Nerva represents a fundamental shift in OS design:

**From**: Applications, GUIs, mouse-driven navigation
**To**: Intents, transcripts, keyboard-driven flow

**From**: Processes and memory management
**To**: Context windows and token budgets

**From**: System calls and APIs
**To**: Tool calls and prompt contracts

**From**: Manual workflow orchestration
**To**: LLM-driven planning and execution

The result is an operating system that feels less like navigating a hierarchy of folders and windows, and more like having a conversation with an intelligent assistant that can actually **do** things.

This is the future of computing: not smarter applications, but a smarter operating system that understands your intent and makes it happen.

---

**Next Steps**:
1. Read [Architecture Documentation](architecture.md)
2. Try the [Quickstart](../README.md#quickstart)
3. Review [UX Principles](ux.md)
4. Contribute [Good First Issues](../CONTRIBUTING.md#good-first-issues)

