# LLM Connector (GSA v1.5.0+)

Stdlib-only OpenAI-compatible chat client (`urllib`). **No `openai` package.**

## Config (`connectors.llm`)

In `gsa.config.json`:

```json
"connectors": {
  "llm": {
    "provider": "xai",
    "api_base": "https://api.x.ai/v1",
    "model": "grok-4.5",
    "temperature": 0.4,
    "api_key_env": ["GROK_API_KEY", "XAI_API_KEY"]
  }
}
```

| Field | Description |
|-------|-------------|
| `provider` | Preset name (`xai`, `groq`, …). Fills defaults for missing fields. |
| `api_base` | API root (no trailing slash required). Appends `/chat/completions`. |
| `model` | Model id for that provider. |
| `temperature` | Default `0.4`. |
| `api_key_env` | Ordered list of env var names to try for the Bearer token. |

## Presets

| provider | key env | default `api_base` |
|----------|---------|---------------------|
| `xai` | `GROK_API_KEY` / `XAI_API_KEY` | `https://api.x.ai/v1` |
| `openrouter` | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| `groq` | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` |
| `together` | `TOGETHER_API_KEY` | `https://api.together.xyz/v1` |
| `deepseek` | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/v1` |
| `mistral` | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` |
| `openai` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |

Minimal switch (preset supplies base URL + default model):

```json
"llm": { "provider": "groq" }
```

```bash
export GROQ_API_KEY=...
export GROK_LICENSE=GSA-DEMO-2026-LIVE
python3 gsa run
```

## Legacy fallbacks

Resolution order:

1. `connectors.llm` (preferred)
2. `connectors.xai` (legacy) → treated as provider `xai`
3. Top-level `model` / `base_url` / `api_key_env` from older configs

Example legacy block still works:

```json
"connectors": {
  "xai": {
    "base_url": "https://api.x.ai/v1",
    "model": "grok-4.5",
    "api_key_env": ["GROK_API_KEY", "XAI_API_KEY"]
  }
}
```

## Runtime

- Endpoint: `POST {api_base}/chat/completions`
- Auth: `Authorization: Bearer <key>`
- Transport: Python stdlib `urllib.request` only
- Inspect resolved settings: `python3 gsa config` → `_resolved_llm`
- Health: `python3 gsa status` / `python3 gsa doctor`

## Related

- Workers & roles: `AGENTS.md`, `python3 gsa schema`
- xAI REST reference: [docs/GROK_API.md](GROK_API.md)
