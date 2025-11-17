# End-to-End Tests

Complete user flows tested with real LLMs and golden transcripts.

## Golden Transcripts

Golden transcripts are recorded successful interactions that serve as regression tests:

```typescript
test("golden: simple file listing", async () => {
  const transcript = loadGoldenTranscript("simple-file-listing");
  
  for (const turn of transcript.turns) {
    const output = await shell.execute(turn.input);
    expect(output).toMatchSnapshot();
  }
});
```

## Latency Budgets

E2E tests enforce latency requirements:

```typescript
test("simple query under 500ms (local model)", async () => {
  const start = Date.now();
  await shell.execute("list files");
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(500);
});
```

## Running Tests

```bash
# All e2e tests
pnpm test:e2e

# With specific model
MODEL=local pnpm test:e2e

# Update snapshots
pnpm test:e2e --update-snapshots
```

## Test Organization

- `simple/` - Single-step queries
- `complex/` - Multi-step planning tasks
- `error/` - Error handling and recovery
- `security/` - Security policy enforcement

