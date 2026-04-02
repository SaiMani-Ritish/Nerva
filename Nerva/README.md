# Nerva

**An LLM-native Agent Runtime** — Uses an OS-inspired architecture where the LLM acts as a kernel, context is memory, tools are devices, and agents are applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## Quickstart (< 5 minutes)

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** or **pnpm** — Comes with Node.js
- **Ollama** — [Download](https://ollama.com/) for local LLM inference

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
# Pull a local model with Ollama (recommended: small & fast)
ollama pull qwen2.5:1.5b

# Copy the example environment file
cp .env.example .env

# Edit .env to set your model (default: qwen2.5:1.5b)
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

## What is Nerva?

Nerva is an agent runtime that uses an OS-inspired architecture with an LLM at its core:

| OS Metaphor | Nerva |
|-------------|-------|
| CPU executes code | LLM interprets intent |
| RAM stores data | Context window is memory |
| System calls | Tool invocations |
| Applications | Agents |
| Files | Knowledge |

### Core Concepts

- **Kernel** — The LLM that interprets user intent and orchestrates execution
- **Tools** — 15 capabilities including filesystem, web, git, code analysis, and more
- **Agents** — Planner, Executor, and Summarizer that handle complex tasks
- **Memory** — Context management with automatic summarization

---

## What Can Nerva Do?

### File Operations
```
read package.json
list files in src/
search for "TODO" in the codebase
write "hello world" to notes.txt
```

### Web Requests
```
fetch https://api.github.com/users/octocat
search the web for "TypeScript best practices"
```

### System Commands
```
run ls -la
execute npm --version
```

### Git Version Control
```
git status
commit my changes with message "fix bug"
diff
log
branch feature/new-tool
checkout main
```

### Code Analysis
```
analyze src/kernel.ts
lint src/tools/fs.ts
show complexity of core/kernel/router.ts
list dependencies
refactor src/utils.ts "rename X to Y"
```

### Clipboard
```
paste                        (read clipboard)
copy "hello world"           (write to clipboard)
```

### Docker Management
```
list containers
docker images
docker logs my-container
stop my-container
```

### Database Queries
```
connect to ./workspace/data.db
show tables
query SELECT * FROM users
schema users
```

### PDF Reading
```
read document.pdf
extract pages 1-5 from report.pdf
pdf metadata manual.pdf
```

### SSH Remote Commands
```
ssh user@server.com uptime
remote user@prod df -h
```

### Email
```
send email to john@example.com subject "Meeting" body "See you at 3pm"
list emails
```

### Calendar
```
what's on my calendar today?
schedule meeting "Team standup" tomorrow at 10am
```

### Image Analysis
```
describe screenshot.png
ocr document-scan.jpg
analyze photo.png "what color is the car?"
```

### Audio
```
transcribe recording.mp3
speak "Hello, world!"
analyze audio.wav
```

### Screenshot
```
take a screenshot
capture region 0 0 800 600
```

### Conversational AI
```
Hello, what can you do?
Help me understand this project
Explain how the kernel works
```

### Shell Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `Ctrl+T` | Thread selector (multiple conversations) |
| `Ctrl+P` | Scratchpad for notes |
| `↑` / `↓` | Browse command history |
| `?` | Help menu |
| `Ctrl+C` | Exit Nerva |

---

## 🛠️ Features

### Interactive Shell

- **Input line** with streaming output
- **Command palette** (Ctrl+K) for quick actions
- **Thread management** (Ctrl+T) for multiple conversations
- **Scratchpad** (Ctrl+P) for notes
- **History** with persistence

### Built-in Tools (15 total)

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

> **Enabled** = works out of the box. **Opt-in** = needs external setup (toggle in `config/tools.yaml`).

### Security

- **Sandboxed filesystem** — Only access allowed directories
- **Command whitelist** — Only approved commands can run
- **Git push disabled by default** — Prevents accidental pushes
- **Database read-only by default** — No accidental writes
- **SSH hosts must be whitelisted** — No surprise connections
- **Email send disabled by default** — No spam risk
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
| `OLLAMA_MODEL` | Ollama model name (e.g., `qwen2.5:1.5b`, `llama3:8b`) |
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |
| `NERVA_LOG_LEVEL` | Logging level (debug, info, warn, error) |
| `NERVA_CONFIG_DIR` | Custom config directory |

### Example: Change Default Model

Edit your `.env` file:

```bash
# Use a different Ollama model
OLLAMA_MODEL=llama3:8b

# Or use phi3 for even faster responses
OLLAMA_MODEL=phi3:mini
```

Available models: [Ollama Library](https://ollama.com/library)

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

## CLI Commands

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

## Project Structure

```
nerva/
├── apps/
│   └── shell/           # Interactive TUI
├── core/
│   ├── kernel/          # Intent parsing, routing, orchestration
│   ├── agents/          # Planner, Executor, Summarizer
│   ├── tools/           # Filesystem, Web, Process tools
│   ├── models/          # LLM adapters (Ollama, Local, Fallback)
│   ├── memory/          # Context manager, Vector store, Logger
│   └── config/          # Configuration system
├── packages/
│   └── cli/             # Command-line interface
├── config/              # Default configuration files
├── test/                # Unit and E2E tests
└── docs/                # Documentation
```

---

## Development

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

## Extending Nerva

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

## Contributing

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

## License

Apache License 2.0 — See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Ollama](https://ollama.com/) — Local LLM server
- [Qwen](https://qwenlm.github.io/) — Efficient open-weight models
- [llama.cpp](https://github.com/ggerganov/llama.cpp) — Local model inference

---

<p align="center">
  <strong>Nerva</strong> — Rethinking the OS for the AI age
</p>

