# Filesystem Driver

Sandboxed filesystem access for Nerva.

## Security

- Restricted to configured sandbox roots
- Path traversal prevention
- File size limits
- Deny patterns (e.g., .git, node_modules)

## Operations

- Read files
- Write files
- List directories
- Search with glob patterns
- Watch for changes (future)

## Configuration

Configured via `config/policies.yaml`:

```yaml
filesystem:
  allow_roots:
    - ./workspace
    - ./scratch
  deny_patterns:
    - ".*"
    - "**/node_modules/**"
  max_file_size: 10MB
```

