# Cloud LLM Adapters

Integrations with cloud LLM providers.

## Supported Providers

- OpenAI (GPT-4, GPT-3.5-turbo)
- Anthropic (Claude 3.5 Sonnet, etc.)
- Future: Google (Gemini), Cohere, etc.

## Configuration

API keys via environment variables:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

Or in `.env` file (not committed):

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```typescript
import { OpenAIAdapter } from "./openai";

const adapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4",
});

const output = await adapter.generate({ messages: [...] });
```

