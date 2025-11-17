# Models

Model adapters provide a unified interface for different LLM providers.

## Adapters

- `adapter.ts` - Base adapter interface
- `local-adapter.ts` - llama.cpp integration (local models)
- `openai-adapter.ts` - OpenAI API
- `anthropic-adapter.ts` - Anthropic API
- `fallback-adapter.ts` - Local-first with cloud fallback

## Interface

All adapters implement `ModelAdapter`:

```typescript
interface ModelAdapter {
  generate(prompt: Prompt, options: GenOptions): Promise<LLMOutput>;
  embed(text: string): Promise<Embedding>;
  getCapabilities(): ModelCapabilities;
}
```

## Usage

```typescript
import { LocalAdapter } from "./local-adapter";

const adapter = new LocalAdapter({ modelPath: "./models/llama-3-8b.gguf" });
const output = await adapter.generate({ messages: [...] }, { maxTokens: 1000 });
```

