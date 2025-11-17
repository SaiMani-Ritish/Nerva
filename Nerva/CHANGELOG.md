# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository structure and scaffolding
- Core documentation (README, CONTRIBUTING, LICENSE)
- Architecture documentation
- Prompt templates and system prompts
- Configuration files (models.yaml, tools.yaml, policies.yaml)
- Core module scaffolds (kernel, memory, tools, agents, models)
- Shell TUI application scaffold
- Driver scaffolds (fs, web, process)
- Model adapters (local_llm, cloud_llm)
- CLI and SDK package scaffolds
- Test infrastructure (unit and e2e)
- Development scripts

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Sandboxed filesystem access with path traversal prevention
- Command execution whitelist policy
- Rate limiting for web requests
- Secret redaction in logs

---

## Release Notes Format

Each release should include:
- **Version number**: Following semver (MAJOR.MINOR.PATCH)
- **Release date**: YYYY-MM-DD
- **Categories**: Added, Changed, Deprecated, Removed, Fixed, Security
- **Breaking changes**: Clearly marked with ⚠️
- **Migration guide**: For breaking changes

Example:

## [1.0.0] - 2025-01-15

### Added
- Complete kernel implementation with intent routing
- Three-agent system (planner, executor, summarizer)
- Local llama.cpp support with gguf models
- Cloud provider support (OpenAI, Anthropic)
- Full TUI shell with command palette
- Comprehensive e2e test suite with golden transcripts

### Changed
- ⚠️ **BREAKING**: Renamed `ToolConfig` to `ToolDescriptor`
- Improved memory management with automatic summarization
- Enhanced error messages with actionable suggestions

### Fixed
- Path traversal vulnerability in fs driver
- Memory leak in context cache
- Race condition in agent orchestration

[Unreleased]: https://github.com/username/nerva/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/username/nerva/releases/tag/v1.0.0

