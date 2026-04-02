Here are all the commands to run Nerva and use each of the 15 tools:

## Starting Nerva

```bash
# Build first (if not already built)
cd Nerva
pnpm build

# Start the interactive shell
pnpm start

# Or run directly
node dist/packages/cli/index.js
```

Make sure Ollama is running with your model:
```bash
ollama serve
ollama pull qwen2.5:1.5b
```

---

## Tool Commands (type these inside the Nerva shell)

### 1. File Operations (`fs`)
```
read package.json
write "hello world" to notes.txt
list files in src/
search for "TODO" in the codebase
```

### 2. Web Requests (`web`)
```
fetch https://api.github.com/users/octocat
search the web for "TypeScript best practices"
```

### 3. System Commands (`process`)
```
run ls -la
execute npm --version
run echo "hello"
```

### 4. Git (`git`)
```
git status
commit my changes with message "fix bug"
diff
log
branch feature/new-tool
checkout main
pull
stage src/
clone https://github.com/user/repo.git
```

> Note: `push` is disabled by default. Enable it in `config/policies.yaml` by setting `git.allow_push: true`.

### 5. Code Analysis (`code`)
```
analyze core/kernel/kernel.ts
lint core/tools/fs.ts
explain core/kernel/router.ts
show complexity of core/tools/web.ts
list dependencies
refactor core/tools/fs.ts "rename read to readFile"
```

### 6. Clipboard (`clipboard`)
```
paste
copy "hello world" to clipboard
clipboard read
```

### 7. Docker (`docker`)

> Disabled by default. Enable in `config/tools.yaml` by setting `docker.enabled: true`.

```
list containers
docker images
docker logs my-container
start my-container
stop my-container
restart my-container
```

### 8. Database (`database`)

> Disabled by default. Enable in `config/tools.yaml` by setting `database.enabled: true`. Needs `sqlite3` CLI installed.

```
connect to ./workspace/data.db
show tables
query SELECT * FROM users
schema users
```

### 9. PDF (`pdf`)

> Needs `poppler-utils` installed (`brew install poppler` / `apt install poppler-utils` / `choco install poppler`).

```
read document.pdf
extract pages 1 3 5 from report.pdf
pdf metadata manual.pdf
```

### 10. SSH (`ssh`)

> Disabled by default. Enable in `config/tools.yaml` and whitelist hosts in `config/policies.yaml` under `ssh.allowed_hosts`.

```
ssh user@server.com uptime
ssh user@server.com df -h
remote user@prod ls /var/log
```

### 11. Email (`email`)

> Disabled by default. Enable in `config/tools.yaml` and set env vars:
> `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`

```
send email to john@example.com subject "Meeting" body "See you at 3pm"
list emails
email search "invoice"
```

### 12. Calendar (`calendar`)

> Disabled by default. Requires Google Calendar API credentials. Enable in `config/tools.yaml` and set `GOOGLE_CALENDAR_CREDENTIALS` env var.

```
what's on my calendar today?
calendar this week
schedule meeting "Team standup" tomorrow at 10am
```

### 13. Image Analysis (`image`)

> Disabled by default. Requires a vision model on Ollama: `ollama pull llava:7b`

```
describe screenshot.png
ocr document-scan.jpg
analyze photo.png "what color is the car?"
```

### 14. Audio (`audio`)

> Disabled by default. Requires Whisper CLI (`pip install openai-whisper`) for transcription, and `ffprobe` (ffmpeg) for analysis.

```
transcribe recording.mp3
speak "Hello, world!"
analyze audio.wav
```

### 15. Screenshot (`screenshot`)

> Disabled by default. Uses platform-native tools (screencapture on macOS, PowerShell on Windows, ImageMagick on Linux).

```
screenshot
capture region 0 0 800 600
```

---

## Quick Reference: Enabling Opt-in Tools

Edit `config/tools.yaml` and flip `enabled: false` to `enabled: true` for any tool:

```yaml
docker:
  enabled: true    # was false

database:
  enabled: true    # was false
```

Then rebuild: `pnpm build && pnpm start`