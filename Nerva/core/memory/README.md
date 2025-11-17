# Memory

Memory management for Nerva, including:
- Context window management (token budget)
- Long-term vector storage
- Conversation logging
- Automatic summarization

## Components

- `context-manager.ts` - Rolling context window with token budget
- `vector-store.ts` - Embedding and similarity search
- `logger.ts` - Conversation persistence
- `summarizer-client.ts` - Interface to summarizer agent

## Usage

```typescript
import { ContextManager } from "./context-manager";

const memory = new ContextManager({ tokenBudget: 100000 });
await memory.addMessage({ role: "user", content: "..." });
const context = await memory.getContext();
```

