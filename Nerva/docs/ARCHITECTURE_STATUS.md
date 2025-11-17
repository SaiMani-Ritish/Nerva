# Nerva Architecture Status

**Last Updated**: November 14, 2025  
**Milestone**: 1 (Foundation) ✅ COMPLETE

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER INPUT                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      INTENT PARSER                           │
│  • Parses natural language → structured Intent              │
│  • Detects complexity (simple/complex)                       │
│  • Status: ✅ Placeholder with complexity detection         │
│  • Coverage: 100% (7 tests)                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         ROUTER                               │
│  • Routes based on intent complexity                         │
│  • Simple → Direct tool execution                            │
│  • Complex → Planner agent                                   │
│  • Ambiguous → Clarification                                 │
│  • Status: ✅ Fully implemented                             │
│  • Coverage: 95% (9 tests)                                   │
└─────┬─────────────────────┬─────────────────────┬───────────┘
      │                     │                     │
      │ Direct              │ Plan                │ Clarify
      ▼                     ▼                     ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│ TOOL        │   │ PLANNER      │   │ CLARIFICATION    │
│ REGISTRY    │   │ AGENT        │   │ HANDLER          │
│             │   │              │   │                  │
│ • fs        │   │ Status: 🔨  │   │ Status: 📋      │
│ • web       │   │ Stubbed      │   │ TODO             │
│ • process   │   │              │   │                  │
│             │   │              │   │                  │
│ Status: ✅  │   │              │   │                  │
│ Coverage:   │   │              │   │                  │
│ 100%        │   │              │   │                  │
│ (5 tests)   │   │              │   │                  │
└─────────────┘   └──────────────┘   └──────────────────┘
```

---

## Core Components Status

### ✅ Completed & Tested

#### 1. Message Bus
**Purpose**: Event-driven communication between components

**Features**:
- Subscribe/unsubscribe to events
- Parallel handler execution
- Multiple handlers per event type
- Async handler support
- Automatic timestamping

**Events Supported**:
- `intent.parsed`
- `tool.called`
- `tool.completed`
- `agent.started`
- `agent.completed`
- `memory.updated`
- `error.occurred`

**Tests**: 7 tests, 100% coverage

---

#### 2. State Store
**Purpose**: In-memory state management for tasks and sessions

**Features**:
- CRUD operations for task states
- Task lifecycle tracking (running/completed/failed)
- Progress tracking (0-100%)
- Automatic cleanup of old tasks
- Data merging on updates

**API**:
```typescript
create(id: string, data?: Record<string, unknown>): TaskState
get(id: string): TaskState | undefined
update(id: string, updates: Partial<TaskState>): TaskState | undefined
delete(id: string): boolean
list(): TaskState[]
cleanup(olderThan?: number): number
```

**Tests**: 12 tests, 100% coverage

---

#### 3. Tool Registry
**Purpose**: Manage and discover available tools

**Features**:
- Register tools dynamically
- Retrieve tools by name
- List all available tools
- Generate LLM-friendly descriptions
- Replace existing tools

**API**:
```typescript
register(tool: Tool): void
get(name: string): Tool | undefined
list(): Tool[]
getDescriptions(): string
```

**Tests**: 5 tests, 100% coverage

---

#### 4. Router
**Purpose**: Route intents to appropriate execution path

**Features**:
- Complexity-based routing
- Intelligent tool selection (18+ action mappings)
- Target-based inference (URLs, file paths, commands)
- Fallback strategies

**Action Mappings**:
- **File ops**: `list`, `read`, `write`, `search`, `create`, `delete`, `find`, `copy`, `move` → `fs`
- **Web ops**: `fetch`, `download`, `request`, `get`, `post` → `web`
- **Process ops**: `run`, `execute`, `command`, `exec` → `process`

**Target Inference**:
- File extensions (`.json`, `.txt`, etc.) → `fs`
- URLs (`http://`, `.com`, `.org`) → `web`
- Commands (`bash`, `script`) → `process`

**Tests**: 9 tests, 95% coverage

---

#### 5. Intent Parser
**Purpose**: Convert natural language to structured intents

**Current Status**: Placeholder with complexity detection

**Features**:
- Complexity classification (simple/complex)
- Keyword-based multi-step detection
- Case-insensitive pattern matching
- Confidence scoring

**Complexity Keywords**:
- `"and then"`
- `"after that"`
- `"first"`
- `"finally"`

**Future**: Will integrate with LLM for full parsing

**Tests**: 7 tests, 100% coverage

---

## Data Flow Example

### Simple Intent: "list files in src/"

```
1. Intent Parser
   ├─ Input: "list files in src/"
   └─ Output: Intent {
        action: "list",
        target: "files",
        parameters: { path: "src/" },
        complexity: "simple"
      }

2. Router
   ├─ Detects: complexity = "simple"
   ├─ Selects: tool = "fs" (based on action "list")
   └─ Decides: RouteDecision { type: "direct", tool: "fs", inputs: {...} }

3. Tool Execution
   ├─ Registry.get("fs")
   └─ fs.execute({ path: "src/" })

4. Message Bus
   ├─ Emit: "tool.called"
   └─ Emit: "tool.completed"

5. State Store
   └─ Update: task progress/status
```

### Complex Intent: "first search notes then create a plan"

```
1. Intent Parser
   ├─ Input: "first search notes then create a plan"
   └─ Output: Intent {
        action: "analyze",
        complexity: "complex"  ← Detected "first...then"
      }

2. Router
   ├─ Detects: complexity = "complex"
   └─ Decides: RouteDecision { type: "plan", agent: "planner" }

3. Planner Agent (TODO: Milestone 5)
   ├─ Creates multi-step plan
   └─ Delegates to Executor
```

---

## Test Coverage Summary

| Component | Files | Tests | Coverage |
|-----------|-------|-------|----------|
| Message Bus | 1 | 7 | 100% |
| State Store | 1 | 12 | 100% |
| Tool Registry | 1 | 5 | 100% |
| Router | 1 | 9 | 95% |
| Intent Parser | 1 | 7 | 100% |
| **Total** | **5** | **40** | **~98%** |

*Note: Example tests add 3 more for 43 total tests*

---

## Type Definitions

### Core Types

```typescript
// Intent - Structured representation of user input
interface Intent {
  action: string;               // "list", "read", "search", etc.
  target?: string;              // "files", "config.json", etc.
  parameters: Record<string, unknown>;
  complexity: "simple" | "complex";
  confidence: number;           // 0.0 - 1.0
  needsClarification: boolean;
  clarificationQuestions?: string[];
}

// Route Decision - Router output
type RouteDecision =
  | { type: "direct"; tool: string; inputs: Record<string, unknown> }
  | { type: "plan"; agent: "planner" }
  | { type: "clarify"; questions: string[] };

// Task State - State Store entity
interface TaskState {
  id: string;
  status: "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  progress?: number;            // 0-100
  data: Record<string, unknown>;
}

// Event - Message Bus entity
interface Event {
  type: EventType;
  timestamp: number;
  data: unknown;
}

// Tool - Registry entity
interface Tool {
  name: string;
  description: string;
  parameters: unknown;          // JSON Schema
  execute(input: unknown): Promise<ToolResult>;
}
```

---

## Next Steps: Milestone 2

### Goals
1. Implement **Filesystem Tool** (`fs`)
2. Implement **Web Tool** (`web`)
3. Implement **Process Tool** (`process`)
4. Build **Security Policy** enforcement
5. Add **20+ tests** for tools

### Security Focus
- Path traversal prevention
- Command injection protection
- URL allowlist enforcement
- Rate limiting
- Timeout enforcement
- Sandbox isolation

### Target
- **Total Tests**: 62-68 tests
- **Tool Coverage**: >80%
- **Security Tests**: 100% passing

---

## Commands Reference

```bash
# Development
npm run dev          # Watch mode compilation
npm run build        # Production build
npm run typecheck    # Type checking

# Testing
npm run test:unit    # Run unit tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

# Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code
```

---

**Status**: Foundation complete! Ready for Milestone 2. 🚀

