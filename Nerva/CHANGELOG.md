# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-23

### Added

#### New Tools (12 tools, bringing total to 15)
- **Git Tool**: status, commit, push, pull, diff, log, branch, checkout, add, clone — with push disabled by default
- **Docker Tool**: ps, images, logs, start, stop, restart, build, pull, exec — with build/exec disabled by default
- **Code Tool**: analyze, refactor, explain, lint, dependencies, complexity — zero-dependency code analysis
- **Clipboard Tool**: cross-platform read/write using native OS commands (pbcopy, xclip, PowerShell)
- **Database Tool**: SQLite queries via sqlite3 CLI — read-only by default, SQL injection protection
- **PDF Tool**: read, extract, metadata, summarize — using poppler-utils (pdftotext/pdfinfo)
- **SSH Tool**: remote exec, upload, download via ssh/scp — hosts must be explicitly whitelisted
- **Email Tool**: send, read, list, search — SMTP/IMAP with send disabled by default and confirmation required
- **Calendar Tool**: Google Calendar integration — list, create, update, delete events
- **Image Tool**: analyze, describe, OCR, compare — via Ollama vision models (llava)
- **Audio Tool**: transcribe (Whisper), speak (native TTS), analyze (ffprobe) — cross-platform
- **Screenshot Tool**: full screen, window, region capture — using platform-native commands

#### Configuration
- Added security policies for all 12 new tools in `policies.yaml`
- Added tool enable/disable flags in `tools.yaml` (opt-in for tools needing external setup)
- Added policy type definitions for all new tools in config types
- Config loader now parses all new policy sections from YAML with sensible defaults

#### Kernel Integration
- Intent parser recognizes 40+ new action verbs (commit, push, query, transcribe, screenshot, etc.)
- Router maps all new actions to appropriate tools with correct input parameter mapping
- Kernel system prompt updated to describe all 15 tool capabilities
- Default tool descriptions updated for LLM-assisted routing

### Security
- Git push disabled by default (`allow_push: false`), force push always blocked
- Database queries read-only by default, DROP/TRUNCATE/ALTER blocked
- SSH requires explicit host whitelisting (empty allowlist = disabled)
- Email sending disabled by default with mandatory confirmation
- Docker exec/build disabled by default
- Screenshot rate-limited (10/minute)
- All tools respect sandboxing and size limits

---

## [0.1.0] - 2025-01-10

### Added

#### Core Kernel
- Intent parser with LLM-based and heuristic fallback parsing
- Router with simple/complex classification and tool/agent delegation
- State store for task lifecycle management
- Message bus for event-driven communication
- Full kernel orchestration loop with error handling

#### Agent System
- **Planner Agent**: Goal decomposition, step generation, dependency management
- **Executor Agent**: Plan execution with retry logic, parallel step support
- **Summarizer Agent**: Text compression, conversation summarization, key point extraction
- Agent prompt templates with structured JSON output

#### Memory System
- Context manager with token budget and automatic pruning
- Vector store with cosine similarity search
- Conversation logger with transcript persistence
- Memory manager for coordinated memory operations
- Embedding generation support

#### Model Adapters
- **Local Adapter**: llama.cpp integration (mock for MVP)
- **OpenAI Adapter**: GPT-4 and GPT-3.5 support with streaming
- **Fallback Adapter**: Automatic failover with configurable timeout
- Model capability detection (context length, streaming, embedding)

#### Tools
- **Filesystem Tool**: Read, write, list, search with sandboxing
- **Web Tool**: HTTP fetch with rate limiting and host filtering
- **Process Tool**: Command execution with whitelist enforcement
- Tool registry with dynamic registration

#### Shell TUI
- Interactive input with readline support
- Streaming output with ANSI escape codes
- Command palette (Ctrl+K) for quick actions
- Thread management (Ctrl+T) for multiple conversations
- Scratchpad (Ctrl+P) for notes
- Status bar with model and thread info
- Command history with persistence

#### Configuration System
- YAML configuration loading (models.yaml, tools.yaml, policies.yaml)
- Environment variable overrides for all settings
- Sensible defaults for all configurations
- Configuration validation with helpful error messages
- Logger with log levels and secret redaction

#### CLI
- `nerva run` - Start the interactive shell
- `nerva config` - Display current configuration
- `nerva model list` - List available models
- `nerva model pull` - Download models (placeholder)
- `nerva help` - Show help information
- `nerva version` - Show version information

#### Testing
- Unit tests for all core modules (221+ tests)
- E2E tests for kernel flow and security
- Latency benchmark tests
- Test coverage > 80% on core modules

#### Documentation
- Comprehensive README with quickstart guide
- Architecture documentation
- Build plan with milestones
- Prompt templates for agents
- Contributing guidelines

### Security

- Sandboxed filesystem access with configurable allow roots
- Path traversal prevention
- Hidden file/directory blocking
- Command whitelist and blacklist enforcement
- Network host allow/block lists
- Rate limiting for web requests
- Request timeout enforcement
- Secret redaction in logs
- SSRF prevention (blocks localhost, internal networks)

### Developer Experience

- TypeScript with strict mode
- ESLint and Prettier configuration
- pnpm workspace for monorepo
- Vitest for fast testing
- Development scripts (build, test, lint)

---

## [Unreleased]

### Planned
- Real llama.cpp integration (currently mock)
- Model downloading implementation
- Additional LLM providers (Anthropic Claude)
- Plugin system for custom tools
- Web UI alternative to TUI
- Persistent thread storage
- Multi-user support

---

## Release Notes Format

Each release should include:
- **Version number**: Following semver (MAJOR.MINOR.PATCH)
- **Release date**: YYYY-MM-DD
- **Categories**: Added, Changed, Deprecated, Removed, Fixed, Security
- **Breaking changes**: Clearly marked with ⚠️
- **Migration guide**: For breaking changes

[0.1.0]: https://github.com/nerva-project/nerva/releases/tag/v0.1.0
[Unreleased]: https://github.com/nerva-project/nerva/compare/v0.1.0...HEAD
