# Web Driver

HTTP client with allowlist and rate limiting.

## Security

- Host allowlist (with wildcard support)
- Rate limiting per window
- Timeout enforcement
- User agent control

## Operations

- HTTP GET/POST/PUT/DELETE
- Web search (via search API)
- Content extraction (future)
- Screenshot capture (future)

## Configuration

Configured via `config/policies.yaml`:

```yaml
network:
  allowed_hosts:
    - "*.wikipedia.org"
    - "api.github.com"
  rate_limit: 10/minute
  timeout: 30s
```

