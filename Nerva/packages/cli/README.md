# Nerva CLI

Command-line interface for Nerva.

## Commands

```bash
# Run the shell
nerva run shell

# Manage models
nerva model list
nerva model pull llama-3-8b
nerva model info llama-3-8b

# Configuration
nerva config show
nerva config set key value
nerva config get key

# Threads
nerva thread list
nerva thread show <id>
nerva thread export <id> output.md

# Utilities
nerva version
nerva doctor  # Check system requirements
```

## Installation

```bash
npm install -g @nerva/cli
# or
pnpm add -g @nerva/cli
```

## Development

```bash
cd packages/cli
pnpm install
pnpm build
pnpm link
```

