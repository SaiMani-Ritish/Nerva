### Nerva 

Project name
- A strong one-word option: “Nerva” — evokes a lean, neural, nerve‑center OS that routes intent to tools and agents with minimal surface area.[1]

Repository structure
- monorepo designed for fast local dev, clean interfaces, and future multi‑agent growth.[2][3]
- Uses semantic versioning and CHANGELOG from day one to onboard contributors cleanly.[2]

Repository layout
- /
  - README.md — overview, quickstart, UX philosophy, keyboard map, architecture diagram (ASCII), roadmap.[3][2]
  - CONTRIBUTING.md — setup, style, commit conventions, code review, prompt hygiene.[3]
  - CHANGELOG.md — semantic versioning, unreleased section.[2]
  - LICENSE — Apache‑2.0 recommended for open collaboration.[4]
  - .editorconfig — consistent whitespace, newline rules.[2]
  - .gitignore — node, python, dist, venv, build products.[2]
  - docs/
    - architecture.md — LLM as kernel, context as memory, tools as devices, agents as apps; sequence diagrams.[1]
    - ux.md — minimal GUI principles, focus management, latency budget, typing-first interactions.[1]
    - prompts/
      - system.md — canonical system prompt for the OS kernel.[5]
      - agent_templates.md — templates for task, tool, memory, planning prompts.[6][7][5]
  - apps/
    - shell/ — TUI “Console” app: command palette, threads, scratchpad.[1]
    - sketch/ — minimal GUI wrapper (optional), pure keyboard.[8]
  - core/
    - kernel/ — message bus, state store, tool calling, routing policies.[5][1]
    - memory/ — short‑term (context cache), long‑term (vector store), logs.[1]
    - tools/ — standard tool interfaces (filesystem, web, process, clipboard).[1]
    - agents/ — planner, executor, summarizer, router.[1]
    - models/ — provider adapters (OpenAI, Anthropic, local/llama.cpp).[9][8]
  - drivers/
    - fs/ — sandboxed FS and scratch storage.[1]
    - web/ — retrieval adapter with rate limiting.[1]
    - process/ — safe command exec with policy gates.[1]
  - adapters/
    - local_llm/ — llama.cpp / gguf bindings and model registry.[8][9]
    - cloud_llm/ — OpenAI/Anthropic adapters and fallbacks.[5]
  - examples/
    - quickstart_minimal/ — 100‑line demo using one model + 2 tools.[2]
    - agents_tour/ — planner + executor + summarize loop.[7][1]
  - packages/
    - cli/ — nerva CLI: nerva run, nerva new, nerva model pull.[2]
    - sdk/ — TypeScript/ Python SDK for tools/agents.[2]
  - scripts/
    - dev.sh — install, run, watch, lint.[2]
    - tree.sh — generate repo tree for README.[3]
  - config/
    - models.yaml — model registry and caps.[9][8]
    - tools.yaml — declarative tool exposure and ACL.[1]
    - policies.yaml — sandbox, rate limits, red team checks.[1]
  - test/
    - e2e/ — golden transcripts and latency budgets.[7]
    - unit/ — tool, router, prompt tests.[7]

README outline
- Nerva: an LLM‑native OS
  - Mission: A typing‑first OS where the LLM is the kernel; context is memory; tools are devices; agents are apps.[1]
  - Why: Minimize GUI friction; maximize flow via keyboard and transcripts.[1]
  - Quickstart
    - Prereqs: Node LTS and Python 3.10+, or Node‑only, plus model provider or local model.[8][2]
    - Install: git clone; pnpm i or npm i; python -m venv venv && pip install -r requirements.txt.[2]
    - Run: pnpm dev or npm run dev; nerva run shell.[2]
    - First task: “Index notes, suggest study plan, create tasks”.[7]
  - Architecture
    - LLM as kernel; context window as memory; external storage as files; tool calls as device drivers; agents as applications; prompts as system contracts.[1]
    - Model adapters: local llama.cpp and cloud providers with the same OS interface.[9][8][5]
  - UX principles
    - Single input line; composable tasks; reversible actions; transcript‑as‑state; ctrl‑k palette.[8][1]
  - Configuration
    - models.yaml, tools.yaml, policies.yaml; environment variables; secrets.[2]
  - Development workflow
    - Plan → Implement → Test → Document, with chain‑of‑prompts for reliable output, and Cursor‑friendly files for autonomy.[6][5][7]
  - Contributing
    - Good first issues; coding standards; prompt diffs; golden answers.[3][2]
  - License and credits
    - Apache‑2.0; inspired by LLM‑as‑OS research and agent IDE practices.[4][5][1]

Blog post outline (docs/first-principles.md)
- From apps to intents: building an OS where language is the UI and the LLM is the kernel; mapping OS primitives to LLM constructs.[1]
- Minimizing GUI: why keystrokes, transcripts, and visible state beat multi‑pane UIs for cognitive flow.[1]
- Local‑first fallback with cloud‑burst: performance and privacy tradeoffs.[9][8]
- Prompt contracts as APIs: making Cursor and agents reliable by explicit state, plans, and tests.[6][5][7]

End‑to‑end Cursor system prompt
- Paste this as the system message in Cursor’s agent chat for this repo. It establishes a plan‑first loop, tool discipline, prompt hygiene, and testable outputs.

“System
You are building Nerva, an LLM‑native OS with a typing‑first UX and minimal GUI. Treat the LLM as the kernel; context is memory; tools are devices; agents are applications. Deliver a working MVP with local‑first capability and cloud adapters. Obey this workflow:

1) Blueprint phase
- Read repository goals from README.md, docs/architecture.md, and docs/prompts/system.md.
- Write a build plan in docs/PLAN.md with:
  - MVP scope: kernel router, tools: fs, web, process; agents: planner, executor, summarizer; shell TUI app.
  - Milestones and acceptance tests per milestone.
  - Pseudocode for kernel loop: receive input → intent detect → plan → tool/agent routing → memory update → response.
- Stop and request plan approval by placing ‘STATE: NEEDS_PLAN_APPROVAL’ at the top of docs/PLAN.md. Do not proceed until updated to ‘STATE: APPROVED’.

2) Construct phase
- Implement in small, reviewable PR‑sized steps.
- For each step:
  - Update docs/PLAN.md with a task checklist.
  - Write code and tests.
  - Update docs/prompts/* if prompt contracts change.
  - Keep model/provider calls behind adapters with identical interfaces.

3) Validate phase
- Run unit tests, then e2e golden transcript tests in test/e2e.
- Enforce latency budgets (p95) in tests and log to reports.
- Produce a short CHANGELOG entry and update README Quickstart.

Guidelines
- Language: TypeScript for core, tools, sdk, cli; Python optional demos only.
- Packages: pnpm workspaces. Strict TS, ESLint, Prettier, EditorConfig.
- Model abstraction: models/ exposes a uniform interface:
  type Generate = (input: Prompt, options: GenOptions) => Promise<LLMOutput>
  Support llama.cpp (local) and one cloud provider; select via models.yaml.

- Tool contracts:
  - tools/fs: read, write, list in sandboxed roots; deny traversal.
  - tools/web: fetch with host allowlist and rate limits.
  - tools/process: run whitelisted commands; capture stdout/stderr; timeouts.
  Configure via tools.yaml and policies.yaml.

- Kernel loop:
  - Parse user input; detect intent.
  - If complex: call planner agent → produce structured plan JSON.
  - Route steps to tools/agents; stream partial results to shell.
  - Summarize outputs and update memory (short‑term cache + vector store).
  - Persist transcript to scratch/ with metadata.

- Agents:
  - Planner: turn goals into steps, estimate costs, choose tools.
  - Executor: run steps; handle errors with retries/backoff.
  - Summarizer: compress context; write next‑prompt hints.

- Memory:
  - Short‑term: rolling context window with token budget.
  - Long‑term: vector store (simple JSON or sqlite index) keyed by topic.
  - Auto‑summarize long transcripts; store deltas.

- Shell app:
  - Single input line, streaming output, ctrl‑k palette, thread list, scratch tab.
  - Keyboard only; no mouse assumptions.

- Security:
  - Deny‑by‑default tool access; explicit allowlists; redact secrets; log tool calls.

- Testing:
  - Unit tests for tools, router, prompt templates.
  - E2E transcripts with golden outputs and p95 latency thresholds.
  - Include offline mode test with local llama.cpp.

- Documentation:
  - README Quickstart always runnable.
  - docs/architecture.md holds diagrams and contracts.
  - CHANGELOG with semantic versioning.

Deliverables (MVP)
- Working shell app in apps/shell with command palette.
- Core kernel with routing and memory.
- Tools: fs, web, process with policies.
- Agents: planner, executor, summarizer.
- Model adapters: llama.cpp (local) + one cloud.
- Tests: unit + e2e with golden transcripts.

File seeds
- Create these initial files with scaffolds and TODOs:
  - README.md (overview, quickstart, architecture, dev workflow)
  - docs/architecture.md (LLM as OS mapping)
  - docs/prompts/system.md (canonical system prompt)
  - config/models.yaml, tools.yaml, policies.yaml
  - packages/sdk/, packages/cli/ skeletons
  - core/kernel/, core/tools/, core/agents/, core/memory/, core/models/
  - apps/shell/ minimal TUI
  - test/unit/, test/e2e/ with first cases
  - scripts/dev.sh, scripts/tree.sh
Then proceed with the Blueprint phase and wait for plan approval.”

Why this is the plan:
- Aligns with LLM‑as‑OS research: kernel, memory, devices, apps mapping, keeping the surface area minimal and typed‑first.[1]
- Encodes Cursor best practices: plan approval loop, chain‑of‑prompts, small steps, test‑first mindset, and prompt files Cursor can anchor to during autonomy.[6][5][7]
- Ships with contributor‑friendly README, structure, versioning, and tree automation to keep the project approachable as it grows.[3][2]

[1](https://arxiv.org/html/2312.03815v2)
[2](https://www.freecodecamp.org/news/how-to-structure-your-readme-file/)
[3](https://tilburgsciencehub.com/topics/collaborate-share/share-your-work/content-creation/readme-best-practices/)
[4](https://www.reddit.com/r/LocalLLaMA/comments/1ko1v1k/i_built_a_tiny_linux_os_to_make_your_llms/)
[5](https://blog.sshh.io/p/how-cursor-ai-ide-works)
[6](https://forum.cursor.com/t/guide-a-simpler-more-autonomous-ai-workflow-for-cursor-new-update/70688)
[7](https://dev.to/abhishekshakya/7-prompt-engineering-secrets-from-cursor-ai-vibe-coders-must-see-47ng)
[8](https://www.reddit.com/r/LocalLLaMA/comments/1l2oywk/what_gui_are_you_using_for_local_llms_anythingllm/)
[9](https://huggingface.co/blog/llm-inference-on-edge)
[10](https://www.youtube.com/watch?v=yAcWnfsZhzo)
[11](https://www.bprigent.com/article/building-llm-tool-creative-journey-of-product-design-and-ai-development)
[12](https://www.reddit.com/r/OpenAI/comments/1lo1oc6/i_tried_to_create_ui_for_llms_with_english_as_a/)
[13](https://www.youtube.com/watch?v=quh7z1q7-uc)
[14](https://www.youtube.com/watch?v=GEQTooW02-E)
[15](https://news.ycombinator.com/item?id=44560662)
[16](https://www.youtube.com/watch?v=_1uFtDfqapo)
[17](https://www.builder.io/blog/cursor-tips)
[18](https://github.com/othneildrew/Best-README-Template)
[19](https://www.youtube.com/watch?v=EkvMFKDie3E)
[20](https://blogs.incyclesoftware.com/readme-files-for-internal-projects)