# Nerva Shell

Terminal UI (TUI) for interacting with Nerva OS.

## Features

- Single input line with streaming output
- Command palette (Ctrl+K)
- Thread management (Ctrl+T)
- Scratchpad (Ctrl+P)
- Keyboard-only navigation
- Status bar with context info

## Architecture

Built with:
- `blessed` or `ink` for TUI rendering
- Streaming output display
- Async event handling

## Usage

```bash
nerva run shell
```

## Key Bindings

| Key | Action |
|-----|--------|
| Ctrl+K | Command palette |
| Ctrl+T | Thread list |
| Ctrl+N | New thread |
| Ctrl+P | Scratchpad |
| Ctrl+C | Cancel operation |
| Ctrl+D | Exit |

