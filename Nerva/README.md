# Nerva: an LLM-native OS

**Mission**: A typing-first OS where the LLM is the kernel; context is memory; tools are devices; agents are apps.

## Why Nerva?

Minimize GUI friction; maximize flow via keyboard and transcripts. Traditional operating systems force you to navigate through windows, menus, and mouse clicks. Nerva lets you express intent directly through language, with the LLM routing your commands to the right tools and agents.

## Quickstart

### Prerequisites

- **Node.js** LTS (v18+)
- **Python** 3.10+ (optional, for demos)
- **Model provider**: OpenAI/Anthropic API key OR local model via llama.cpp

### Install

```bash
git clone <repository-url>
cd Nerva
pnpm install
# OR: npm install

# Optional: Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run

```bash
pnpm dev
# OR: npm run dev

nerva run shell
```

### First task

Try typing: `"Index notes, suggest study plan, create tasks"`

The LLM kernel will parse your intent, route to appropriate agents, and execute the plan.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User Input                        │
│                  (Natural Language)                  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              LLM Kernel (Core)                       │
│  • Intent Detection                                  │
│  • Plan Generation                                   │
│  • Routing & Orchestration                           │
│  • Memory Management (Context Window)                │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    ┌─────┐  ┌─────┐  ┌─────────┐
    │Tools│  │Agents│ │ Memory  │
    │(FS, │  │(Plan,│ │(Vector, │
    │Web, │  │Exec, │ │ Cache)  │
    │Proc)│  │Summ) │ │         │
    └─────┘  └─────┘  └─────────┘
```

### Core Concepts

- **LLM as kernel**: The language model is the central orchestrator
- **Context window as memory**: Active working memory with token budgets
- **External storage as files**: Persistent state in sandboxed filesystem
- **Tool calls as device drivers**: Controlled access to system capabilities
- **Agents as applications**: Higher-level task executors (planner, executor, summarizer)
- **Prompts as system contracts**: Well-defined interfaces between components
- **Model adapters**: Unified interface for local (llama.cpp) and cloud providers

## UX Principles

1. **Single input line**: Express intent directly in natural language
2. **Composable tasks**: Chain operations through planning agents
3. **Reversible actions**: All operations can be undone or rolled back
4. **Transcript-as-state**: Your conversation history is the primary UI
5. **Ctrl-K palette**: Quick access to commands and context switching
6. **Keyboard-first**: No mouse required; optimized for flow

## Configuration

### Model Configuration (`config/models.yaml`)

```yaml
models:
  - name: local-llama
    type: local
    path: ./models/llama-3-8b.gguf
  - name: gpt-4
    type: cloud
    provider: openai
```

### Tools Configuration (`config/tools.yaml`)

```yaml
tools:
  fs:
    enabled: true
    sandbox_roots: [./workspace, ./scratch]
  web:
    enabled: true
    allowed_hosts: ["*"]
    rate_limit: 10/min
```

### Policies Configuration (`config/policies.yaml`)

```yaml
policies:
  filesystem:
    deny_paths: [/etc, /usr, /System]
  commands:
    whitelist: [git, npm, python, node]
```

### Environment Variables

```bash
# Cloud providers (optional)
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...

# Local model path (optional)
export NERVA_MODEL_PATH=./models/

# Development
export NERVA_LOG_LEVEL=debug
```

## Development Workflow

### Plan → Implement → Test → Document

1. **Plan**: Write design in `docs/PLAN.md` with acceptance criteria
2. **Implement**: Build in small, reviewable increments
3. **Test**: Unit tests + e2e golden transcripts with latency budgets
4. **Document**: Update architecture docs and CHANGELOG

### Chain-of-prompts for Reliability

We use explicit prompt templates in `docs/prompts/` to ensure:
- Consistent agent behavior
- Testable outputs
- Cursor-friendly autonomous development

### Repository Structure

```
Nerva/
├── README.md               # This file
├── CONTRIBUTING.md         # Development guidelines
├── CHANGELOG.md            # Semantic versioning log
├── LICENSE                 # Apache-2.0
├── .editorconfig          # Editor settings
├── .gitignore             # Git exclusions
├── package.json           # Node workspace config
├── tsconfig.json          # TypeScript config
├── docs/                  # Documentation
│   ├── architecture.md    # System design
│   ├── ux.md             # UX principles
│   ├── first-principles.md # Blog post
│   └── prompts/          # Prompt templates
├── core/                 # Core OS components
│   ├── kernel/           # Message bus, routing
│   ├── memory/           # Context cache, vector store
│   ├── tools/            # Tool interfaces
│   ├── agents/           # Agent implementations
│   └── models/           # Provider adapters
├── apps/                 # User-facing applications
│   ├── shell/            # TUI console
│   └── sketch/           # Minimal GUI (optional)
├── drivers/              # System drivers
│   ├── fs/               # Filesystem access
│   ├── web/              # Web retrieval
│   └── process/          # Command execution
├── adapters/             # External integrations
│   ├── local_llm/        # llama.cpp bindings
│   └── cloud_llm/        # OpenAI/Anthropic
├── packages/             # Distributable packages
│   ├── cli/              # Command-line interface
│   └── sdk/              # TypeScript/Python SDK
├── examples/             # Example implementations
│   ├── quickstart_minimal/
│   └── agents_tour/
├── config/               # Configuration files
│   ├── models.yaml
│   ├── tools.yaml
│   └── policies.yaml
├── scripts/              # Development scripts
│   ├── dev.sh
│   └── tree.sh
└── test/                 # Test suites
    ├── unit/
    └── e2e/
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Setup instructions
- Code style guidelines
- Commit conventions
- Code review process
- Prompt hygiene best practices

### Good First Issues

Look for issues tagged with `good-first-issue`:
- Add new tool adapters
- Improve prompt templates
- Write e2e test cases
- Enhance documentation

## License and Credits

Licensed under [Apache-2.0](LICENSE).

Inspired by:
- LLM-as-OS research
- Agent IDE practices
- Keyboard-first developer tools
- Modern OS design principles

---

**Built with ❤️ for the age of language-native computing**

