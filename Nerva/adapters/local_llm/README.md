# Local LLM Adapter

Integration with llama.cpp for local model execution.

## Features

- GGUF model support
- CPU and GPU acceleration
- Streaming generation
- Embedding generation
- Model hot-swapping

## Dependencies

- `node-llama-cpp` or similar bindings
- llama.cpp compiled with appropriate backends

## Usage

```typescript
import { LocalLLMAdapter } from "./adapter";

const adapter = new LocalLLMAdapter({
  modelPath: "./models/llama-3-8b-q4.gguf",
  contextSize: 8192,
  gpuLayers: 35,
});

const output = await adapter.generate({ messages: [...] });
```

## Model Registry

Models are defined in `config/models.yaml`:

```yaml
models:
  - name: llama-3-8b
    path: ./models/llama-3-8b-q4.gguf
    context_size: 8192
    gpu_layers: 35
```

