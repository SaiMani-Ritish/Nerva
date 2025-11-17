# Process Driver

Safe command execution with whitelist.

## Security

- Command whitelist (no arbitrary execution)
- Timeout enforcement
- Working directory restrictions
- Environment variable filtering
- Output size limits

## Operations

- Execute whitelisted commands
- Capture stdout/stderr
- Kill processes
- Process status (future)

## Configuration

Configured via `config/policies.yaml`:

```yaml
commands:
  whitelist:
    - git
    - npm
    - python
    - node
  timeout: 30s
  max_output_size: 1MB
```

