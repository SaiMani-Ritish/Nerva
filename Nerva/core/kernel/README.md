# Kernel

The kernel is the heart of Nerva, responsible for:
- Parsing natural language intent
- Routing requests to tools or agents
- Orchestrating multi-step operations
- Managing the message bus
- Maintaining state

## Components

- `kernel.ts` - Main orchestration loop
- `router.ts` - Intent classification and routing
- `intent-parser.ts` - Natural language to structured intent
- `message-bus.ts` - Event-driven communication
- `state-store.ts` - In-memory task state

## Usage

```typescript
import { Kernel } from "./kernel";

const kernel = new Kernel(config);
const response = await kernel.process("list files in src/");
```

