# Nerva UX Design

## Philosophy

Nerva's UX is built on the principle that **typing is thinking**. The interface should disappear, leaving only the conversation between the user and the system.

## Design Principles

### 1. Minimal GUI

**Why**: Every pixel of UI is a potential distraction. The best interface is the one you don't notice.

**Implementation**:
- Single input line at the bottom
- Streaming text output above
- No sidebars, toolbars, or chrome
- Monospace font for consistency
- High contrast for readability

### 2. Keyboard-First

**Why**: The mouse breaks flow. Hands should never leave the keyboard.

**Key Bindings**:

| Action | Binding | Description |
|--------|---------|-------------|
| Command palette | `Ctrl+K` | Access all commands |
| New thread | `Ctrl+N` | Start fresh conversation |
| Switch thread | `Ctrl+T` | Navigate between threads |
| Search history | `Ctrl+R` | Fuzzy search past inputs |
| Cancel operation | `Ctrl+C` | Stop current execution |
| Clear input | `Ctrl+U` | Clear current line |
| Scroll up/down | `Ctrl+E/Y` | Navigate output |
| Copy output | `Ctrl+Shift+C` | Copy to clipboard |
| Scratchpad | `Ctrl+P` | Toggle scratch space |

### 3. Composable Tasks

**Why**: Complex workflows should be expressible in simple language.

**Examples**:
```
# Simple
"list files in src/"

# Composed
"find all TODOs in TypeScript files and create issues"

# Multi-step
"search my notes for machine learning topics, summarize them, and create a study plan"

# Conditional
"if tests pass, deploy to staging; otherwise show me the failures"
```

### 4. Reversible Actions

**Why**: Users should feel safe to experiment without fear of breaking things.

**Implementation**:
- All file operations create backups automatically
- Undo stack for recent actions
- Dry-run mode for destructive operations
- Explicit confirmation for irreversible actions

**Examples**:
```
> delete workspace/old-files/
⚠️ This will delete 47 files (2.3 MB). Continue? [y/N]

> git push --force
⚠️ Force push is destructive. This requires explicit confirmation.
Type 'yes, force push to main' to continue:
```

### 5. Transcript as State

**Why**: The conversation history is the most natural way to understand what happened.

**Features**:
- Every interaction is logged
- Transcripts are searchable
- Threads can be bookmarked and resumed
- Export transcripts as markdown

### 6. Visible State

**Why**: Users should always know what's happening and why.

**Status Indicators**:
```
[Thinking...] ← LLM is processing
[Executing: fs.search] ← Tool is running
[Step 2/5] ← Progress in multi-step task
[Using local model] ← Model selection
[Cached result] ← Using cached output
```

### 7. Latency Budget

**Why**: Every second of waiting breaks flow. The system must feel instant for common tasks.

**Targets**:
- **< 100ms**: Instant (keyboard input, UI updates)
- **< 300ms**: Fast (simple local queries)
- **< 1s**: Acceptable (simple cloud queries)
- **< 3s**: Tolerable (complex planning)
- **> 3s**: Must show progress indicator

## Interface Components

### Main Shell

```
┌────────────────────────────────────────────┐
│  Nerva Shell                    [Ctrl+K]   │
├────────────────────────────────────────────┤
│                                            │
│  > list files in src/                      │
│  Found 23 files:                           │
│  - src/index.ts                            │
│  - src/kernel/router.ts                    │
│  - src/tools/fs.ts                         │
│  ...                                       │
│                                            │
│  > search for TODOs                        │
│  [Step 1/2] Searching files...            │
│  [Step 2/2] Extracting TODOs...           │
│  Found 12 TODOs across 8 files:           │
│  1. src/kernel/router.ts:45               │
│     TODO: Add caching for intent parsing  │
│  ...                                       │
│                                            │
│  >█                                        │
├────────────────────────────────────────────┤
│  [Using: local-llama] [Thread: work]      │
└────────────────────────────────────────────┘
```

### Command Palette (`Ctrl+K`)

```
┌────────────────────────────────────────────┐
│  Command Palette                           │
├────────────────────────────────────────────┤
│  > switch th█                              │
├────────────────────────────────────────────┤
│  → Switch Thread                           │
│    Switch Model                            │
│    Show Thread History                     │
│    Export Thread                           │
│    Theme Settings                          │
└────────────────────────────────────────────┘
```

### Thread List (`Ctrl+T`)

```
┌────────────────────────────────────────────┐
│  Threads                                   │
├────────────────────────────────────────────┤
│  ★ work                        [active]    │
│    "search for TODOs..."                   │
│    2 hours ago                             │
│                                            │
│  • personal                                │
│    "summarize my notes..."                 │
│    1 day ago                               │
│                                            │
│  • research                                │
│    "explain transformers..."               │
│    3 days ago                              │
├────────────────────────────────────────────┤
│  [n] New  [d] Delete  [r] Rename          │
└────────────────────────────────────────────┘
```

### Scratchpad (`Ctrl+P`)

```
┌────────────────────────────────────────────┐
│  Scratchpad                    [Save: ^S]  │
├────────────────────────────────────────────┤
│  # Ideas for next feature                  │
│  - Add voice input                         │
│  - Collaborative threads                   │
│  - Mobile app                              │
│                                            │
│  # Commands to try                         │
│  nerva model pull llama-3-8b               │
│  nerva config set temperature 0.7          │
│                                            │
│█                                           │
└────────────────────────────────────────────┘
```

## Interaction Patterns

### Streaming Output

For long-running operations, stream output as it arrives:

```
> explain how transformers work

[Generating...] ← Shows immediately

Transformers are neural network architectures...← Streams word by word

The key innovation is the attention mechanism...

[Generated in 2.3s | 450 tokens | $0.003]
```

### Multi-Step Progress

For complex plans, show step-by-step progress:

```
> index my notes and create a study plan

[Planning...] ← Planner agent
Created 4-step plan:
1. Search for markdown files
2. Extract topics and concepts  
3. Analyze knowledge gaps
4. Generate study schedule

[Step 1/4] Searching for markdown files...
Found 23 notes (45,000 words)

[Step 2/4] Extracting topics...
Identified 12 main topics

[Step 3/4] Analyzing gaps...
Found 3 areas to focus on

[Step 4/4] Generating schedule...
Created 5-week plan

✓ Complete | View plan: workspace/study-plan.md
```

### Error Handling

Errors should be actionable:

```
> run python analyze.py

✗ Error: Command not in whitelist

The 'python' command is not allowed by current policies.

Suggestions:
1. Add 'python' to config/policies.yaml whitelist
2. Use the built-in Python tool: python.run("analyze.py")
3. Review allowed commands: nerva config show policies.commands

Learn more: docs/security.md#command-execution
```

### Ambiguity Resolution

When intent is unclear, ask for clarification:

```
> deploy

🤔 I need more information:

- Deploy to which environment? (staging, production)
- Deploy which service? (api, web, worker)

Example: "deploy api to staging"
```

### Confirmations

For destructive actions, require explicit confirmation:

```
> delete all log files older than 30 days

This will delete approximately 150 files (2.1 GB).

⚠️  Warning: This action cannot be undone.

Affected directories:
- logs/
- workspace/logs/

Continue? (y/N): 
```

## Focus Management

Nerva maintains focus on the current task while allowing quick context switches.

### Focus States

1. **Input Focus** (default): Typing commands
2. **Output Focus**: Reading/selecting output
3. **Palette Focus**: Command palette open
4. **Thread Focus**: Thread switcher open
5. **Scratch Focus**: Scratchpad open

### Focus Transitions

```
Input Focus
  ↓ Ctrl+K
Palette Focus
  ↓ Enter
Input Focus (command executed)
  ↓ Ctrl+T
Thread Focus
  ↓ Enter (select thread)
Input Focus (new thread)
  ↓ Ctrl+P
Scratch Focus
  ↓ Esc
Input Focus
```

## Visual Language

### Typography

- **Monospace font**: Ensures alignment and consistency
- **Font size**: 14px (adjustable)
- **Line height**: 1.6 for readability
- **Font family**: Preferred order:
  1. JetBrains Mono
  2. Fira Code
  3. SF Mono
  4. Menlo
  5. Consolas

### Color Scheme

**Dark Mode** (default):
```
Background:  #1e1e1e
Foreground:  #d4d4d4
Input:       #569cd6 (blue)
Output:      #d4d4d4 (light gray)
Error:       #f48771 (red)
Success:     #4ec9b0 (teal)
Warning:     #dcdcaa (yellow)
Dim:         #6a6a6a (gray)
```

**Light Mode**:
```
Background:  #ffffff
Foreground:  #333333
Input:       #0066cc (blue)
Output:      #333333 (dark gray)
Error:       #cc0000 (red)
Success:     #008800 (green)
Warning:     #aa6600 (orange)
Dim:         #999999 (gray)
```

### Icons and Symbols

Use ASCII/Unicode symbols for universal compatibility:
- `>` Input prompt
- `•` List item
- `→` Suggestion
- `✓` Success
- `✗` Error
- `⚠️` Warning
- `★` Favorite/starred
- `█` Cursor
- `...` Loading/thinking

## Accessibility

### Screen Readers

- All output is semantic text
- Status updates announced
- Progress indicators readable
- Error messages descriptive

### Keyboard Navigation

- No mouse required
- Tab navigation for all elements
- Clear focus indicators
- Customizable keybindings

### Visual Accessibility

- High contrast mode
- Adjustable font sizes
- Reduced motion option
- Color-blind friendly palette

## Performance

### Rendering

- Virtual scrolling for long output
- Debounced input handling
- Lazy loading of history
- Efficient terminal rendering (use blessed.js or similar)

### Perceived Performance

- Optimistic UI updates
- Instant input feedback
- Skeleton screens for loading
- Chunked output rendering

## Mobile Considerations

While Nerva is desktop-first, basic mobile support:

- Responsive layout for tablet
- Touch-friendly command palette
- Swipe gestures for navigation
- Virtual keyboard optimization

## Examples

### Example 1: Research Flow

```
> search arxiv for "transformer attention mechanisms"
[Searching arxiv...] ✓ Found 127 papers

> show top 5 by citations
1. "Attention Is All You Need" (65,000 citations)
2. "BERT: Pre-training..." (45,000 citations)
...

> summarize paper 1
[Fetching paper...] ✓
[Reading 8 pages...] ✓
[Generating summary...] ✓

Summary: The paper introduces the Transformer architecture...
[Read more: workspace/paper-summaries/attention-is-all-you-need.md]

> add this to my reading list with priority high
✓ Added to reading-list.md with priority: high
```

### Example 2: Development Flow

```
> what tests are failing?
[Running test suite...] ✓

3 tests failing:
1. kernel/router.test.ts:45 - Intent parsing for ambiguous input
2. tools/fs.test.ts:89 - Path traversal prevention
3. agents/planner.test.ts:120 - Cost estimation accuracy

> show me test 1
[Reading test file...] ✓

```typescript
test("should handle ambiguous intent", () => {
  const intent = parseIntent("run script");
  expect(intent.clarification_needed).toBe(true);
});
```

Failure: Expected true but got undefined

> fix this test
[Analyzing code...] ✓
[Generating fix...] ✓

Suggested fix: The router doesn't set clarification_needed flag.
Apply fix to core/kernel/router.ts? (y/N): y

[Applying fix...] ✓
[Running test...] ✓

✓ Test now passing!
```

## Future UX Enhancements

- Voice input/output
- Collaborative threads (multi-user)
- Visual diff viewer for file changes
- Integrated note-taking
- Timeline view of operations
- Graph visualization of task dependencies
- Customizable themes and layouts

