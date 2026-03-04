# Nerva v0.2.0 — New Tools Implementation Plan

## Overview

Add 12 new tools to Nerva, expanding it from 3 tools (fs, web, process) to 15. Each tool follows the existing `Tool` interface pattern and plugs into the kernel via intent parsing, routing, and the tool registry.

---

## Architecture: How a Tool Plugs In

Every new tool touches **6 integration points**:

```
┌──────────────────────────────────────────────────────────────┐
│  1. core/tools/<name>.ts        — Tool implementation        │
│  2. core/tools/index.ts         — Register in createTools()  │
│  3. config/tools.yaml           — Enable/disable + settings  │
│  4. config/policies.yaml        — Security policy (if any)   │
│  5. core/kernel/intent-parser.ts — Action verbs recognition  │
│  6. core/kernel/router.ts       — Action → tool mapping      │
│  7. test/unit/tools/<name>.test.ts — Unit tests              │
└──────────────────────────────────────────────────────────────┘
```

### Tool Interface (already exists)

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: unknown;              // JSON Schema
  execute(input: unknown): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: ToolError;
  metadata: { duration_ms: number; tokens_used?: number; cost?: number };
}
```

---

## Implementation Tiers

Tools are grouped by dependency complexity and implementation effort.

### Tier 1 — CLI Wrappers (Week 1)
Zero or minimal new npm dependencies. Use `child_process` under the hood.

| Tool | npm deps | Est. effort |
|------|----------|-------------|
| `git` | none (wraps git CLI) | 1 day |
| `docker` | none (wraps docker CLI) | 1 day |
| `code` | none (uses existing fs + LLM) | 1.5 days |

### Tier 2 — Lightweight Native Deps (Week 2)
Each needs one focused npm package.

| Tool | npm deps | Est. effort |
|------|----------|-------------|
| `clipboard` | `clipboardy` | 0.5 day |
| `database` | `better-sqlite3` | 1 day |
| `pdf` | `pdf-parse` | 0.5 day |

### Tier 3 — External Service Integrations (Week 3)
Need API keys, OAuth, or network access.

| Tool | npm deps | Est. effort |
|------|----------|-------------|
| `ssh` | `ssh2` | 1.5 days |
| `email` | `nodemailer`, `imapflow` | 1.5 days |
| `calendar` | `googleapis` | 2 days |

### Tier 4 — Model-Dependent / Platform-Specific (Week 4)
Require specific Ollama models or platform APIs.

| Tool | npm deps | Est. effort |
|------|----------|-------------|
| `image` | none (Ollama + llava model) | 1 day |
| `audio` | `node-whisper` or Ollama | 1.5 days |
| `screenshot` | `screenshot-desktop` | 0.5 day |

---

## Detailed Tool Specifications

---

### 1. `git` Tool

**File:** `core/tools/git.ts`

**Actions:** `status`, `commit`, `push`, `pull`, `diff`, `log`, `branch`, `checkout`, `add`, `clone`

**Input interface:**
```typescript
interface GitInput {
  action: "status" | "commit" | "push" | "pull" | "diff" | "log" | "branch" | "checkout" | "add" | "clone";
  message?: string;      // for commit
  branch?: string;       // for checkout/branch
  remote?: string;       // for push/pull (default: "origin")
  path?: string;         // for add/diff (default: ".")
  count?: number;        // for log (default: 10)
  url?: string;          // for clone
}
```

**Security policy (policies.yaml):**
```yaml
git:
  allow_push: false          # disable push by default (safety)
  allow_force_push: false    # never allow --force
  allowed_remotes: ["origin"]
  max_log_count: 100
```

**Router mappings:**
```typescript
commit:   { tool: "git", operation: "commit" }
push:     { tool: "git", operation: "push" }
pull:     { tool: "git", operation: "pull" }
diff:     { tool: "git", operation: "diff" }
log:      { tool: "git", operation: "log" }
branch:   { tool: "git", operation: "branch" }
checkout: { tool: "git", operation: "checkout" }
stage:    { tool: "git", operation: "add" }
clone:    { tool: "git", operation: "clone" }
```

**Intent parser verbs:**
`commit`, `push`, `pull`, `diff`, `log`, `branch`, `checkout`, `stage`, `clone`

**Implementation notes:**
- Wraps `child_process.execFile("git", [...args])` with the same timeout/output-size limits from process policy
- `status` returns parsed object: `{ branch, staged, modified, untracked }`
- `log` returns array of `{ hash, author, date, message }`
- `diff` returns raw diff string
- `push` gated behind `allow_push` policy flag
- Force push always blocked

---

### 2. `docker` Tool

**File:** `core/tools/docker.ts`

**Actions:** `ps`, `images`, `logs`, `start`, `stop`, `restart`, `build`, `pull`, `exec`

**Input interface:**
```typescript
interface DockerInput {
  action: "ps" | "images" | "logs" | "start" | "stop" | "restart" | "build" | "pull" | "exec";
  container?: string;    // container name/id
  image?: string;        // image name
  command?: string;      // for exec
  tail?: number;         // for logs (default: 100)
  all?: boolean;         // for ps --all
}
```

**Security policy:**
```yaml
docker:
  allow_start: true
  allow_stop: true
  allow_build: false       # disabled by default
  allow_exec: false        # disabled by default (security risk)
  allow_remove: false
  max_log_lines: 500
```

**Implementation notes:**
- Wraps `docker` CLI via `child_process`
- `ps` returns parsed JSON (`docker ps --format json`)
- `logs` streams last N lines
- `exec` requires explicit policy opt-in

---

### 3. `code` Tool

**File:** `core/tools/code.ts`

**Actions:** `analyze`, `refactor`, `explain`, `lint`, `dependencies`, `complexity`

**Input interface:**
```typescript
interface CodeInput {
  action: "analyze" | "refactor" | "explain" | "lint" | "dependencies" | "complexity";
  path: string;           // file or directory
  language?: string;      // auto-detected if omitted
  instruction?: string;   // for refactor ("rename X to Y", "extract function")
}
```

**Implementation notes:**
- Uses existing `FilesystemTool` to read files
- Sends code + instruction to LLM for analysis/refactor
- `lint` runs `eslint` or language-appropriate linter via child_process
- `dependencies` parses package.json/requirements.txt/Cargo.toml
- `complexity` computes cyclomatic complexity heuristics (function count, nesting depth, LOC)
- No new npm deps — combines fs + LLM + child_process

---

### 4. `clipboard` Tool

**File:** `core/tools/clipboard.ts`

**Actions:** `read`, `write`

**Input interface:**
```typescript
interface ClipboardInput {
  action: "read" | "write";
  content?: string;       // for write
}
```

**npm dependency:** `clipboardy` (cross-platform clipboard access)

**Security policy:**
```yaml
clipboard:
  allow_read: true
  allow_write: true
  max_content_size: 1048576   # 1MB
```

**Implementation notes:**
- `clipboardy.read()` / `clipboardy.write(text)`
- Size check before writing
- Simple, lightweight tool

---

### 5. `database` Tool

**File:** `core/tools/database.ts`

**Actions:** `query`, `execute`, `tables`, `schema`, `connect`

**Input interface:**
```typescript
interface DatabaseInput {
  action: "query" | "execute" | "tables" | "schema" | "connect";
  sql?: string;           // for query/execute
  table?: string;         // for schema
  database?: string;      // path to SQLite file (default: ./workspace/nerva.db)
  limit?: number;         // max rows returned (default: 100)
}
```

**npm dependency:** `better-sqlite3`

**Security policy:**
```yaml
database:
  allowed_databases: ["./workspace/*.db", "./scratch/*.db"]
  read_only: true              # default: read-only mode
  allow_write: false           # must be explicitly enabled
  max_rows: 1000
  blocked_operations: ["DROP", "TRUNCATE", "ALTER"]
  max_query_time_seconds: 10
```

**Implementation notes:**
- Default read-only mode for safety
- SQL injection protection via parameterized queries where possible
- `tables` lists all tables (`SELECT name FROM sqlite_master WHERE type='table'`)
- `schema` describes table columns and types
- Blocked keywords checked before execution (DROP, TRUNCATE, ALTER when disallowed)
- Database path validated against `allowed_databases` glob patterns

---

### 6. `pdf` Tool

**File:** `core/tools/pdf.ts`

**Actions:** `read`, `extract`, `summarize`, `metadata`

**Input interface:**
```typescript
interface PdfInput {
  action: "read" | "extract" | "summarize" | "metadata";
  path: string;           // path to PDF file
  pages?: number[];       // specific pages (for extract)
  maxPages?: number;      // limit pages processed
}
```

**npm dependency:** `pdf-parse`

**Security policy:**
- Inherits filesystem sandbox (path must be in allowRoots)
- `max_file_size` from filesystem policy applies

**Implementation notes:**
- `read` extracts all text
- `extract` pulls specific pages
- `summarize` sends extracted text to LLM for summarization
- `metadata` returns page count, author, title, creation date

---

### 7. `ssh` Tool

**File:** `core/tools/ssh.ts`

**Actions:** `connect`, `exec`, `upload`, `download`, `tunnel`

**Input interface:**
```typescript
interface SshInput {
  action: "exec" | "upload" | "download" | "tunnel";
  host: string;
  command?: string;       // for exec
  localPath?: string;     // for upload/download
  remotePath?: string;    // for upload/download
  port?: number;          // default: 22
  username?: string;      // from config or input
  keyPath?: string;       // SSH key path
}
```

**npm dependency:** `ssh2`

**Security policy:**
```yaml
ssh:
  allowed_hosts: []            # must be explicitly configured
  blocked_commands: ["rm -rf", "dd", "mkfs", "fdisk"]
  timeout_seconds: 30
  allow_upload: false
  allow_download: true
  max_transfer_size: 52428800  # 50MB
```

**Implementation notes:**
- Hosts must be explicitly whitelisted (empty = disabled)
- Key-based auth preferred; password auth discouraged
- Commands checked against blocklist before execution
- File transfer size limits enforced
- Connection pooling for repeated commands to same host

---

### 8. `email` Tool

**File:** `core/tools/email.ts`

**Actions:** `send`, `read`, `list`, `search`, `reply`

**Input interface:**
```typescript
interface EmailInput {
  action: "send" | "read" | "list" | "search" | "reply";
  to?: string;            // for send
  subject?: string;       // for send
  body?: string;          // for send/reply
  messageId?: string;     // for read/reply
  query?: string;         // for search
  folder?: string;        // INBOX, Sent, etc. (default: INBOX)
  limit?: number;         // for list (default: 10)
}
```

**npm dependencies:** `nodemailer` (SMTP send), `imapflow` (IMAP read)

**Configuration (environment variables):**
```env
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=user@gmail.com
EMAIL_SMTP_PASS=app-password
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
```

**Security policy:**
```yaml
email:
  allow_send: false            # must be explicitly enabled
  allowed_recipients: []       # empty = any (when send enabled)
  blocked_recipients: []
  max_attachment_size: 10485760
  require_confirmation: true   # prompt user before sending
```

**Implementation notes:**
- Sending disabled by default; requires explicit opt-in
- `require_confirmation: true` means the tool returns a confirmation prompt before actually sending
- App passwords recommended (not real passwords)
- `list` returns message summaries (from, subject, date)
- `read` returns full message body

---

### 9. `calendar` Tool

**File:** `core/tools/calendar.ts`

**Actions:** `list`, `create`, `update`, `delete`, `today`, `week`

**Input interface:**
```typescript
interface CalendarInput {
  action: "list" | "create" | "update" | "delete" | "today" | "week";
  title?: string;         // for create/update
  date?: string;          // ISO date string
  time?: string;          // HH:MM
  duration?: number;      // minutes (default: 60)
  eventId?: string;       // for update/delete
  description?: string;
}
```

**npm dependency:** `googleapis` (Google Calendar API)

**Configuration:**
```env
GOOGLE_CALENDAR_CREDENTIALS=path/to/credentials.json
GOOGLE_CALENDAR_TOKEN=path/to/token.json
```

**Security policy:**
```yaml
calendar:
  allow_create: true
  allow_delete: false          # disabled by default
  allow_update: true
  max_events_fetch: 50
  default_calendar: "primary"
```

**Implementation notes:**
- OAuth2 flow for initial setup (one-time)
- `today` is shorthand for listing today's events
- `week` shows next 7 days
- Natural language date parsing ("next Tuesday at 3pm") handled by LLM before reaching the tool
- Falls back to basic date parsing if LLM unavailable

---

### 10. `image` Tool

**File:** `core/tools/image.ts`

**Actions:** `analyze`, `describe`, `ocr`, `compare`

**Input interface:**
```typescript
interface ImageInput {
  action: "analyze" | "describe" | "ocr" | "compare";
  path: string;            // path to image file
  question?: string;       // for analyze ("what color is the car?")
  comparePath?: string;    // for compare (second image)
}
```

**npm dependency:** none (uses Ollama with a vision model)

**Configuration:**
```yaml
image:
  model: "llava:7b"           # Ollama vision model
  max_image_size: 20971520    # 20MB
  supported_formats: ["jpg", "jpeg", "png", "gif", "webp", "bmp"]
```

**Implementation notes:**
- Requires user to `ollama pull llava:7b` (or similar vision model)
- Reads image file as base64, sends to Ollama vision API
- `analyze` answers questions about the image
- `describe` provides a general description
- `ocr` extracts text from images (best-effort via vision model)
- `compare` describes differences between two images
- Falls back with helpful error if vision model not available

---

### 11. `audio` Tool

**File:** `core/tools/audio.ts`

**Actions:** `transcribe`, `speak`, `analyze`

**Input interface:**
```typescript
interface AudioInput {
  action: "transcribe" | "speak" | "analyze";
  path?: string;           // audio file path (for transcribe/analyze)
  text?: string;           // text to speak (for speak)
  language?: string;       // language hint (default: "en")
  outputPath?: string;     // output file for speak
}
```

**npm dependency:** Uses Ollama with whisper model, or `openai` whisper API as fallback

**Configuration:**
```yaml
audio:
  transcription_model: "whisper"    # or Ollama model name
  tts_enabled: false                # text-to-speech disabled by default
  max_audio_size: 26214400          # 25MB
  supported_formats: ["mp3", "wav", "ogg", "m4a", "flac"]
```

**Implementation notes:**
- `transcribe` converts speech to text
- `speak` converts text to speech audio file (if tts_enabled)
- `analyze` provides audio metadata (duration, format, sample rate) via `ffprobe` if available
- Can use Ollama if a whisper-compatible model is available, or fallback to OpenAI Whisper API
- Platform-native TTS as a lightweight alternative for `speak`

---

### 12. `screenshot` Tool

**File:** `core/tools/screenshot.ts`

**Actions:** `capture`, `window`, `region`

**Input interface:**
```typescript
interface ScreenshotInput {
  action: "capture" | "window" | "region";
  outputPath?: string;     // where to save (default: ./scratch/screenshot-<timestamp>.png)
  windowTitle?: string;    // for window capture
  region?: { x: number; y: number; width: number; height: number }; // for region
}
```

**npm dependency:** `screenshot-desktop`

**Security policy:**
```yaml
screenshot:
  allow_capture: true
  output_directory: "./scratch"
  max_captures_per_minute: 10
```

**Implementation notes:**
- `capture` takes full screen screenshot
- `window` captures a specific window by title
- `region` captures a rectangular region
- Saved to scratch directory by default
- Can be piped to `image` tool for analysis ("take a screenshot and describe what's on screen")

---

## Integration Changes (All Tools)

### 1. Intent Parser Updates (`core/kernel/intent-parser.ts`)

Add to `extractAction()` verb list:
```typescript
const actionVerbs = [
  // ... existing verbs ...
  // Git
  "commit", "push", "pull", "diff", "log", "branch", "checkout", "stage", "clone",
  // Docker
  "deploy", "container", "docker",
  // Code
  "analyze", "refactor", "lint",
  // Clipboard
  "copy", "paste", "clipboard",
  // Database
  "query", "select", "insert", "update",
  // PDF
  "pdf", "extract",
  // SSH
  "ssh", "remote",
  // Email
  "email", "send", "mail",
  // Calendar
  "schedule", "meeting", "calendar", "appointment",
  // Image
  "describe", "ocr", "image",
  // Audio
  "transcribe", "speak", "record",
  // Screenshot
  "screenshot", "capture",
];
```

### 2. Router Updates (`core/kernel/router.ts`)

Add to `actionMapping`:
```typescript
const actionMapping: Record<string, { tool: string; operation: string }> = {
  // ... existing mappings ...

  // Git operations
  commit:   { tool: "git",        operation: "commit" },
  push:     { tool: "git",        operation: "push" },
  pull:     { tool: "git",        operation: "pull" },
  diff:     { tool: "git",        operation: "diff" },
  log:      { tool: "git",        operation: "log" },
  branch:   { tool: "git",        operation: "branch" },
  checkout: { tool: "git",        operation: "checkout" },
  stage:    { tool: "git",        operation: "add" },
  clone:    { tool: "git",        operation: "clone" },

  // Docker operations
  container: { tool: "docker",    operation: "ps" },
  deploy:    { tool: "docker",    operation: "build" },

  // Code operations
  analyze:  { tool: "code",       operation: "analyze" },
  refactor: { tool: "code",       operation: "refactor" },
  lint:     { tool: "code",       operation: "lint" },

  // Clipboard operations
  paste:    { tool: "clipboard",  operation: "read" },

  // Database operations
  query:    { tool: "database",   operation: "query" },
  select:   { tool: "database",   operation: "query" },
  insert:   { tool: "database",   operation: "execute" },

  // SSH operations
  ssh:      { tool: "ssh",        operation: "exec" },
  remote:   { tool: "ssh",        operation: "exec" },

  // Email operations
  email:    { tool: "email",      operation: "list" },
  send:     { tool: "email",      operation: "send" },
  mail:     { tool: "email",      operation: "send" },

  // Calendar operations
  schedule: { tool: "calendar",   operation: "create" },
  meeting:  { tool: "calendar",   operation: "create" },

  // Image operations
  ocr:      { tool: "image",      operation: "ocr" },

  // Audio operations
  transcribe: { tool: "audio",    operation: "transcribe" },
  speak:      { tool: "audio",    operation: "speak" },

  // Screenshot operations
  screenshot: { tool: "screenshot", operation: "capture" },
  capture:    { tool: "screenshot", operation: "capture" },
};
```

### 3. Tool Registration (`core/tools/index.ts`)

```typescript
import { GitTool } from "./git.js";
import { DockerTool } from "./docker.js";
import { CodeTool } from "./code.js";
import { ClipboardTool } from "./clipboard.js";
import { DatabaseTool } from "./database.js";
import { PdfTool } from "./pdf.js";
import { SshTool } from "./ssh.js";
import { EmailTool } from "./email.js";
import { CalendarTool } from "./calendar.js";
import { ImageTool } from "./image.js";
import { AudioTool } from "./audio.js";
import { ScreenshotTool } from "./screenshot.js";

export async function createTools(): Promise<Tool[]> {
  const config = await loadConfig();
  const tools: Tool[] = [
    new FilesystemTool(config.policies.filesystem as any),
    new WebTool(config.policies.network as any),
    new ProcessTool(config.policies.commands as any),
  ];

  // Conditionally load tools based on config
  if (config.tools?.git?.enabled !== false) {
    tools.push(new GitTool(config.policies.git));
  }
  if (config.tools?.docker?.enabled !== false) {
    tools.push(new DockerTool(config.policies.docker));
  }
  // ... same pattern for all tools
  return tools;
}
```

### 4. Config Updates

**`config/tools.yaml` additions:**
```yaml
tools:
  # ... existing ...
  git:
    enabled: true
    description: "Git version control operations"
  docker:
    enabled: false
    description: "Docker container management"
  code:
    enabled: true
    description: "Code analysis and refactoring"
  clipboard:
    enabled: true
    description: "System clipboard read/write"
  database:
    enabled: false
    description: "SQLite database queries"
  pdf:
    enabled: true
    description: "PDF reading and extraction"
  ssh:
    enabled: false
    description: "Remote server commands via SSH"
  email:
    enabled: false
    description: "Email send/read"
  calendar:
    enabled: false
    description: "Calendar management"
  image:
    enabled: false
    description: "Image analysis via vision models"
  audio:
    enabled: false
    description: "Audio transcription and text-to-speech"
  screenshot:
    enabled: false
    description: "Screen capture"
```

> **Convention:** Tools that need external setup (API keys, services, models) default to `enabled: false`. Tools that work out of the box default to `enabled: true`.

### 5. New npm Dependencies

```bash
# Tier 1 — no new deps needed

# Tier 2
pnpm add clipboardy better-sqlite3 pdf-parse
pnpm add -D @types/better-sqlite3

# Tier 3
pnpm add ssh2 nodemailer imapflow googleapis
pnpm add -D @types/ssh2 @types/nodemailer

# Tier 4
pnpm add screenshot-desktop
```

---

## Implementation Order (Recommended)

### Phase 1 — Foundation (Day 1)
1. Update `config/tools.yaml` and `config/policies.yaml` with all tool entries
2. Update `core/kernel/intent-parser.ts` with all new action verbs
3. Update `core/kernel/router.ts` with all new action→tool mappings
4. Update `core/tools/index.ts` with conditional tool loading pattern
5. Update `core/config/types.ts` to support new policy types

### Phase 2 — Tier 1 Tools (Days 2-5)
6. **`git` tool** — highest value, most requested
7. **`code` tool** — leverages existing LLM + fs
8. **`docker` tool** — straightforward CLI wrapper

### Phase 3 — Tier 2 Tools (Days 6-8)
9. **`clipboard` tool** — simplest implementation
10. **`database` tool** — very useful for data tasks
11. **`pdf` tool** — common use case

### Phase 4 — Tier 3 Tools (Days 9-13)
12. **`ssh` tool** — remote operations
13. **`email` tool** — communication integration
14. **`calendar` tool** — most complex (OAuth)

### Phase 5 — Tier 4 Tools (Days 14-16)
15. **`screenshot` tool** — platform utility
16. **`image` tool** — requires vision model
17. **`audio` tool** — requires whisper/TTS

### Phase 6 — Polish (Days 17-18)
18. Update README with all new tool examples
19. Update CHANGELOG
20. Full test suite pass
21. Update shell help/command-palette with new tool hints

---

## Testing Strategy

Each tool needs:

1. **Unit tests** (`test/unit/tools/<name>.test.ts`)
   - All actions tested
   - Policy enforcement tested (blocked operations return errors)
   - Edge cases (missing params, invalid input, timeouts)
   - Mock external dependencies (child_process, network, etc.)

2. **Integration tests** (optional, for Tier 3+)
   - Tests with real services (skipped in CI, run manually)
   - Marked with `describe.skip` or `@integration` tag

3. **E2E tests** (`test/e2e/`)
   - Natural language → intent → tool execution flow
   - "commit my changes" → git.commit
   - "what's on my calendar today?" → calendar.today

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| git push data loss | High | `allow_push: false` default, no force push ever |
| SQL injection | High | Parameterized queries, blocked keywords, read-only default |
| SSH remote damage | High | Empty allowlist = disabled, command blocklist |
| Email spam | Medium | `allow_send: false` default, confirmation required |
| Large file processing (PDF/audio) | Medium | Size limits in policy |
| Missing external tools (git, docker) | Low | Graceful error with install instructions |
| OAuth token expiry (calendar) | Low | Auto-refresh with refresh token |

---

## Success Criteria

- [ ] All 12 tools implemented and passing unit tests
- [ ] All tools loadable via `config/tools.yaml` enable/disable
- [ ] Security policies enforced for every tool
- [ ] Natural language routing works for all tool actions
- [ ] README updated with examples for each tool
- [ ] No regressions in existing 221+ tests
- [ ] Build passes cleanly (`pnpm build && pnpm test:unit`)
