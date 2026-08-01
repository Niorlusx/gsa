# Grok API integration (GSA)

GSA talks to xAI (and other OpenAI-compatible providers) over **stdlib HTTP**.
See **[LLM_CONNECTOR.md](LLM_CONNECTOR.md)** for multi-provider config.

## Default client (xAI)

Config (`connectors.llm`):

```json
{
  "provider": "xai",
  "api_base": "https://api.x.ai/v1",
  "model": "grok-4.5",
  "temperature": 0.4,
  "api_key_env": ["GROK_API_KEY", "XAI_API_KEY"]
}
```

Equivalent raw call:

```http
POST https://api.x.ai/v1/chat/completions
Authorization: Bearer $GROK_API_KEY
Content-Type: application/json

{
  "model": "grok-4.5",
  "temperature": 0.4,
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ]
}
```

## Call semantics

- Endpoint: `POST /v1/chat/completions` (under `api_base`)
- Default model: `grok-4.5`
- Temperature: `0.4` (config)
- System: worker role constraints + Phase 1 project memory
- User: brief from CLI
- No `openai` Python package

## Env

| Variable | Required |
|----------|----------|
| `GROK_API_KEY` or `XAI_API_KEY` | Yes (for provider `xai`) |
| `GROK_LICENSE` | Yes (to run workers) |

## Docs

- https://docs.x.ai/developers/quickstart
- https://docs.x.ai/developers/rest-api-reference/inference/chat
