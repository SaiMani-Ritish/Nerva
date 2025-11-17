# Nerva SDK

TypeScript/JavaScript SDK for building custom tools and agents.

## Installation

```bash
npm install @nerva/sdk
# or
pnpm add @nerva/sdk
```

## Usage

### Creating a Custom Tool

```typescript
import { Tool, ToolResult } from "@nerva/sdk";

export class MyCustomTool implements Tool {
  name = "my-tool";
  description = "Does something useful";
  parameters = {
    type: "object",
    properties: {
      input: { type: "string" },
    },
    required: ["input"],
  };

  async execute(input: { input: string }): Promise<ToolResult> {
    // Your logic here
    return {
      success: true,
      output: `Processed: ${input.input}`,
      metadata: { duration_ms: 0 },
    };
  }
}
```

### Registering a Tool

```typescript
import { Nerva } from "@nerva/sdk";
import { MyCustomTool } from "./my-tool";

const nerva = new Nerva();
nerva.registerTool(new MyCustomTool());
await nerva.start();
```

### Creating a Custom Agent

```typescript
import { Agent, Plan } from "@nerva/sdk";

export class MyAgent implements Agent {
  name = "my-agent";

  async process(input: unknown): Promise<unknown> {
    // Your agent logic
    return {};
  }
}
```

## API Documentation

See [API.md](./API.md) for full documentation.

