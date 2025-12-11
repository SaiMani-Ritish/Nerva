# Nerva

**An LLM-native Operating System** — Where the LLM is the kernel, context is memory, tools are devices, and agents are applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## ⚡ Quickstart (< 5 minutes)

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **pnpm** — `npm install -g pnpm`
- **(Optional)** OpenAI API key for cloud models

### Installation

```bash
# Clone the repository
git clone https://github.com/nerva-project/nerva.git
cd nerva

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Configuration

```bash
# (Optional) Set your API key for cloud models
export OPENAI_API_KEY="sk-..."

# Or use local models only (no API key needed)
```

### Run Nerva

```bash
# Start the interactive shell
pnpm start

# Or run directly
node dist/packages/cli/index.js
```

### First Commands

```
› read package.json
› list files in src/
› search for "TODO" in the codebase
› help
```

**That's it!** You're now running Nerva.

---

## 🎯 What is Nerva?

Nerva reimagines the operating system with an LLM at its core:

| Traditional OS | Nerva OS |
|----------------|----------|
| CPU executes code | LLM interprets intent |
| RAM stores data | Context window is memory |
| System calls | Tool invocations |
| Applications | Agents |
| Files | Knowledge |

### Core Concepts

- **Kernel** — The LLM that interprets user intent and orchestrates execution
- **Tools** — Capabilities like filesystem, web, and process execution
- **Agents** — Planner, Executor, and Summarizer that handle complex tasks
- **Memory** — Context management with automatic summarization

---

## 🛠️ Features

### Interactive Shell

- **Input line** with streaming output
- **Command palette** (Ctrl+K) for quick actions
- **Thread management** (Ctrl+T) for multiple conversations
- **Scratchpad** (Ctrl+P) for notes
- **History** with persistence

### Built-in Tools

| Tool | Description |
|------|-------------|
| `fs` | File operations (read, write, list, search) |
| `web` | HTTP requests and web search |
| `process` | Execute system commands |

### Security

- **Sandboxed filesystem** — Only access allowed directories
- **Command whitelist** — Only approved commands can run
- **Rate limiting** — Protection against runaway requests
- **Secret redaction** — Sensitive data never logged

---

## ⚙️ Configuration

Configuration files live in `config/`:

```
config/
├── models.yaml      # Model definitions
├── tools.yaml       # Tool settings
└── policies.yaml    # Security policies
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `NERVA_LOG_LEVEL` | Logging level (debug, info, warn, error) |
| `NERVA_CONFIG_DIR` | Custom config directory |

### Example: Change Default Model

Edit `config/models.yaml`:

```yaml
default:
  local: llama-3-8b
  cloud: gpt-4
```

### Example: Add Filesystem Root

Edit `config/policies.yaml`:

```yaml
filesystem:
  allow_roots:
    - ./workspace
    - ./scratch
    - /home/user/projects  # Add your directory
```

---

## 📖 CLI Commands

```bash
nerva                    # Start the shell
nerva run                # Start with options
nerva run -l debug       # Enable debug logging
nerva run -c ./my-config # Use custom config directory

nerva config             # Show current configuration
nerva model list         # List available models
nerva model pull <name>  # Download a model

nerva help               # Show help
nerva version            # Show version
```

---

## 🏗️ Project Structure

```
nerva/
├── apps/
│   └── shell/           # Interactive TUI
├── core/
│   ├── kernel/          # Intent parsing, routing, orchestration
│   ├── agents/          # Planner, Executor, Summarizer
│   ├── tools/           # Filesystem, Web, Process tools
│   ├── models/          # LLM adapters (Local, OpenAI, Fallback)
│   ├── memory/          # Context manager, Vector store, Logger
│   └── config/          # Configuration system
├── packages/
│   └── cli/             # Command-line interface
├── config/              # Default configuration files
├── test/                # Unit and E2E tests
└── docs/                # Documentation
```

---

## 🧪 Development

### Run Tests

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:e2e          # End-to-end tests
pnpm test:coverage     # With coverage report
```

### Development Mode

```bash
pnpm dev               # Watch mode with auto-rebuild
```

### Linting & Formatting

```bash
pnpm lint              # Run ESLint
pnpm lint:fix          # Fix linting issues
pnpm format            # Format with Prettier
```

---

## 🔧 Extending Nerva

### Add a Custom Tool

```typescript
// core/tools/my-tool.ts
import type { Tool, ToolResult } from "./types";

export class MyTool implements Tool {
  name = "my-tool";
  description = "Does something useful";
  parameters = {
    type: "object",
    properties: {
      input: { type: "string" }
    }
  };

  async execute(input: unknown): Promise<ToolResult> {
    // Implementation
    return {
      success: true,
      output: "Result",
      metadata: { duration_ms: 10 }
    };
  }
}
```

### Add a Custom Agent

See `core/agents/` for examples of Planner, Executor, and Summarizer agents.

---

## 📚 Documentation

- [Architecture](docs/architecture.md) — System design and data flow
- [Build Plan](docs/PLAN.md) — Development roadmap
- [Prompt Templates](docs/prompts/) — LLM system prompts
- [Contributing](CONTRIBUTING.md) — How to contribute

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/nerva.git

# Create a branch
git checkout -b feature/my-feature

# Make changes and test
pnpm test

# Submit a pull request
```

---

## 📄 License

Apache License 2.0 — See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) — Local model inference
- [OpenAI](https://openai.com/) — GPT model API
- [Anthropic](https://www.anthropic.com/) — Claude model API

---

<p align="center">
  <strong>Nerva</strong> — Rethinking the OS for the AI age
</p>

