# Nerva

**An LLM-native Agent Runtime** — Uses an OS-inspired architecture where the LLM acts as a kernel, context is memory, tools are devices, and agents are applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Why Nerva?

I don't like how traditional interfaces force you through windows, menus, and mouse clicks. Nerva lets you express intent directly through natural language — the LLM kernel parses what you want and orchestrates the right tools and agents to make it happen. Typing-first, keyboard-driven, no GUI friction.

---

## Quickstart

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **pnpm** or **npm**
- **Ollama** — [Download](https://ollama.com/) for local LLM inference

### Install & Run

```bash
git clone https://github.com/SaiMani-Ritish/Nerva.git
cd Nerva/Nerva
pnpm install

# Pull a local model
ollama pull qwen2.5:1.5b

# Build and start
pnpm build
pnpm start
```

### First Commands

```
› read package.json
› git status
› analyze core/kernel/kernel.ts
› Hello, what can you do?
› help
```

---

## Architecture

Nerva uses an OS-inspired architecture with an LLM at the core:

```
┌─────────────────────────────────────────────────────┐
│                    User Input                       │
│                  (Natural Language)                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              LLM Kernel (Core)                      │
│  • Intent Detection                                 │
│  • Plan Generation                                  │
│  • Routing & Orchestration                          │
│  • Memory Management (Context Window)               │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    ┌───────┐ ┌───────┐ ┌─────────┐
    │ Tools │ │Agents │ │ Memory  │
    │(15    │ │(Plan, │ │(Vector, │
    │ total)│ │ Exec, │ │ Context,│
    │       │ │ Summ) │ │ Logger) │
    └───────┘ └───────┘ └─────────┘
```

| OS Metaphor | Nerva |
|-------------|-------|
| CPU executes code | LLM interprets intent |
| RAM stores data | Context window is memory |
| System calls | Tool invocations |
| Applications | Agents |
| Files | Knowledge |

### Core Concepts

- **LLM as kernel** — The language model is the central orchestrator
- **Context window as memory** — Active working memory with token budgets
- **Tool calls as device drivers** — Controlled access to 15 system capabilities
- **Agents as applications** — Planner, Executor, and Summarizer for complex tasks
- **Prompts as system contracts** — Well-defined interfaces between components
- **Model adapters** — Unified interface for Ollama (local) and cloud providers

---

## Built-in Tools (15)

| Tool | Description | Status |
|------|-------------|--------|
| `fs` | File operations (read, write, list, search) | Enabled |
| `web` | HTTP requests and web search | Enabled |
| `process` | Execute system commands | Enabled |
| `git` | Git version control (status, commit, diff, log, push, pull) | Enabled |
| `code` | Code analysis, linting, complexity, refactoring | Enabled |
| `clipboard` | System clipboard read/write | Enabled |
| `docker` | Container management (ps, images, logs, start, stop) | Opt-in |
| `database` | SQLite queries (query, tables, schema) | Opt-in |
| `pdf` | PDF reading and text extraction | Enabled |
| `ssh` | Remote server commands via SSH | Opt-in |
| `email` | Send and read emails via SMTP/IMAP | Opt-in |
| `calendar` | Google Calendar integration | Opt-in |
| `image` | Image analysis via Ollama vision models | Opt-in |
| `audio` | Transcription (Whisper) and text-to-speech | Opt-in |
| `screenshot` | Screen capture (full, window, region) | Opt-in |

> **Enabled** = works out of the box. **Opt-in** = needs external setup; toggle in `config/tools.yaml`.

---

## Security

- **Sandboxed filesystem** — Only access allowed directories
- **Command whitelist** — Only approved commands can run
- **Git push disabled by default** — Prevents accidental pushes
- **Database read-only by default** — No accidental writes
- **SSH hosts must be whitelisted** — No surprise connections
- **Email send disabled by default** — No spam risk
- **Rate limiting** — Protection against runaway requests
- **Secret redaction** — Sensitive data never logged

---

## Configuration

Config files live in `config/`:

```
config/
├── models.yaml      # Model definitions
├── tools.yaml       # Tool enable/disable + settings
└── policies.yaml    # Security policies for all 15 tools
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OLLAMA_MODEL` | Ollama model name (default: `qwen2.5:1.5b`) |
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |
| `NERVA_LOG_LEVEL` | Logging level (debug, info, warn, error) |
| `NERVA_CONFIG_DIR` | Custom config directory |

---

## Shell Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `Ctrl+T` | Thread selector (multiple conversations) |
| `Ctrl+P` | Scratchpad for notes |
| `↑` / `↓` | Browse command history |
| `?` | Help menu |
| `Ctrl+C` | Exit Nerva |

---

## Repository Structure

```
Nerva/
├── core/                 # Runtime core
│   ├── kernel/           # Intent parsing, routing, orchestration
│   ├── memory/           # Context manager, vector store, logger
│   ├── tools/            # 15 tool implementations
│   ├── agents/           # Planner, Executor, Summarizer
│   ├── models/           # Ollama, OpenAI, Gemini adapters
│   └── config/           # Config loader, types, defaults
├── apps/shell/           # Terminal UI (TUI)
├── packages/cli/         # CLI entry point
├── config/               # YAML configuration
├── docs/                 # Architecture & prompt docs
└── test/                 # Unit & E2E tests
```

---

## Contributing

See [CONTRIBUTING.md](Nerva/CONTRIBUTING.md) for setup instructions, code style, commit conventions, and prompt hygiene best practices.

## License

Licensed under [Apache-2.0](LICENSE).

---

**Building to understand AI workflows and learn something from it.**

