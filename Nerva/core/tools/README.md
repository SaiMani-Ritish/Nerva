# Tools

Standard tools for Nerva, analogous to device drivers in a traditional OS.

## Available Tools

- `fs.ts` - Filesystem operations (read, write, list, search)
- `web.ts` - HTTP requests and web scraping
- `process.ts` - Command execution
- `clipboard.ts` - Clipboard access (future)
- `system.ts` - System information (future)

## Tool Interface

All tools implement the `Tool` interface:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(input: unknown): Promise<ToolResult>;
}
```

## Security

All tools respect policies defined in `config/policies.yaml`:
- Filesystem: sandboxed to allowed roots
- Web: allowlist and rate limiting
- Process: command whitelist and timeouts

