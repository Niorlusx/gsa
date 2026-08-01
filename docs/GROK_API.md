# Grok API integration (GSA)

## Client

```python
from openai import OpenAI
client = OpenAI(
    api_key=os.environ["GROK_API_KEY"],  # or XAI_API_KEY
    base_url="https://api.x.ai/v1",
)
```

## Call

- Endpoint: `POST /v1/chat/completions`
- Default model: `grok-4.5`
- Temperature: `0.4` (config)
- System: worker role constraints + Phase 1 project memory
- User: brief from CLI

## Env

| Variable | Required |
|----------|----------|
| `GROK_API_KEY` or `XAI_API_KEY` | Yes |
| `GROK_LICENSE` | Yes (to run workers) |

## Docs

- https://docs.x.ai/developers/quickstart
- https://docs.x.ai/developers/rest-api-reference/inference/chat
