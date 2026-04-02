# What is Nerva?

Nerva is an **LLM-native Agent Runtime** — it uses an OS-inspired architecture where:

| OS Metaphor | Nerva |
|---|---|
| CPU executes code | LLM interprets your intent |
| RAM stores data | Context window is memory |
| System calls | Tool invocations |
| Applications | Agents (Planner, Executor, Summarizer) |
| Files | Knowledge |

In short: Nerva is an AI-powered agent runtime that orchestrates your tasks — you speak naturally, and it routes your requests to the right tools/agents.

---

## Tasks You Can Perform Right Now

### 1. File Operations (`fs` tool)
- `read package.json`
- `list files in src/`
- `search for "TODO" in the codebase`
- `write "hello" to test.txt`

### 2. Web Requests (`web` tool)
- `fetch https://api.github.com/users/octocat`
- `search the web for "TypeScript tutorials"`

### 3. System Commands (`process` tool)
- `run ls -la`
- `execute npm --version`

### 4. Conversational AI
- `Hello, what can you do?`
- `Help me understand this project`
- `Explain how context memory works`

### 5. Shell Features

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette |
| `Ctrl+T` | Thread selector (multiple conversations) |
| `Ctrl+P` | Scratchpad for notes |
| `↑` / `↓` | Browse command history |
| `?` | Help menu |
| `Ctrl+C` | Exit |

---

## Security Built-In

- **Sandboxed filesystem** — Only `./workspace` and `./scratch` accessible
- **Command whitelist** — Only approved commands (`ls`, `cat`, `npm`, etc.)
- **Rate limiting** — Protection against runaway requests

---

The LLM (currently `qwen2.5:1.5b` via Ollama) interprets what you want and orchestrates the right tools/agents to accomplish it.